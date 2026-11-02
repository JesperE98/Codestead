namespace Codestead.Shell.Commands;

// Port of src/shell/commands/disks.ts – commands for disks and file systems: df, lsblk, blkid,
// mount, umount, findmnt, fdisk, swapon, sync and mkfs (mkfs.ext4, mkfs.vfat ...).
// The disk model itself is in ../Disks.cs.

public static partial class DisksCmd
{
    private static bool IsRoot(CmdCtx ctx) => ctx.Sh.CurrentUser().Uid == 0;

    private static void Tip(CmdCtx ctx, string key, params (string Name, object? Value)[] args) =>
        ctx.Err($"{UtilCmd.Color.Dim}{ctx.Sh.Msg(key, args)}{UtilCmd.Color.Reset}\n");

    /// <summary>
    /// Writes a table with columns. Cells may have several lines (\n), e.g. when a partition is
    /// mounted in several places. The last column is not padded. align is 'l' or 'r'.
    /// </summary>
    private static string Table(List<List<string>> rows, IReadOnlyList<char> align, IReadOnlyList<int>? minWidths = null)
    {
        const string sep = " ";
        minWidths ??= Array.Empty<int>();
        var widths = align.Select((_, i) =>
        {
            int w = i < minWidths.Count ? minWidths[i] : 0;
            foreach (var r in rows)
            {
                var cell = i < r.Count ? r[i] ?? "" : "";
                foreach (var s in cell.Split('\n')) w = Math.Max(w, s.Length);
            }
            return w;
        }).ToList();
        var @out = new StringBuilder();
        foreach (var row in rows)
        {
            var cells = row.Select(c => (c ?? "").Split('\n')).ToList();
            int height = cells.Count == 0 ? 0 : cells.Max(c => c.Length);
            for (int line = 0; line < height; line++)
            {
                var parts = align.Select((a, i) =>
                {
                    var text = i < cells.Count && line < cells[i].Length ? cells[i][line] : "";
                    if (i == align.Count - 1 && a == 'l') return text;
                    return a == 'r' ? text.PadLeft(widths[i]) : text.PadRight(widths[i]);
                });
                @out.Append(string.Join(sep, parts).TrimEnd()).Append('\n');
            }
        }
        return @out.ToString();
    }

    /// <summary>Tree branches drawn by lsblk and findmnt.</summary>
    private static string Branch(bool isLast) => isLast ? "└─" : "├─";

    private static string UserFromSpec(Shell sh, string spec)
    {
        if (spec == "0" || spec == "root") return "root";
        if (spec == "1000" || spec == sh.World.User) return sh.World.User;
        return spec;
    }

    private static string UidOf(Shell sh, string name) => name == "root" ? "0" : name == sh.World.User ? "1000" : name;

    /// <summary>All values for a flag that may be repeated, e.g. `df -x tmpfs -x devtmpfs`.</summary>
    private static List<string> Repeated(List<string> args, string @short, string @long)
    {
        var values = new List<string>();
        for (int i = 0; i < args.Count; i++)
        {
            var a = args[i];
            if (a == "--") break;
            if (a == $"-{@short}" || a == $"--{@long}") values.Add(++i < args.Count ? args[i] : "");
            else if (a.StartsWith($"--{@long}=", StringComparison.Ordinal)) values.Add(a.Slice(@long.Length + 3));
            else if (a.StartsWith($"-{@short}", StringComparison.Ordinal) && !a.StartsWith("--", StringComparison.Ordinal)) values.Add(a.Slice(2));
        }
        return values.SelectMany(v => v.Split(',')).Where(v => v != "").ToList();
    }

    private static Dictionary<string, string> Long(params (string Key, string Value)[] pairs) =>
        pairs.ToDictionary(p => p.Key, p => p.Value);

    // ---------- df ----------

    private static readonly CommandDef Df = new()
    {
        Name = "df",
        Summary = "Visar hur mycket plats som finns på filsystemen",
        SummaryEn = "Show free and used space on file systems",
        Man = DfMan,
        ManEn = DfManEn,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "hTakP",
                Values = "tx",
                Long = Long(("human-readable", "h"), ("print-type", "T"), ("all", "a"), ("type", "t"), ("exclude-type", "x"), ("portability", "P")),
            });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var sh = ctx.Sh;
            var state = sh.Disks;
            var root = sh.RootUser();
            int code = 0;
            var mounts = new List<Mount>();
            if (o.Operands.Count > 0)
            {
                foreach (var op in o.Operands)
                {
                    var block = op.StartsWith("/dev/", StringComparison.Ordinal) ? DisksLib.FindBlock(state, op) : null;
                    var byDev = block is not null ? DisksLib.MountsOf(state, block.Name).FirstOrDefault() : null;
                    if (byDev is not null)
                    {
                        mounts.Add(byDev);
                        continue;
                    }
                    var path = sh.Resolve(op);
                    if (sh.Vfs.TryLookup(path, root) is null)
                    {
                        ctx.Err($"df: {op}: No such file or directory\n");
                        code = 1;
                        continue;
                    }
                    var m = DisksLib.MountFor(state, path);
                    if (m is not null) mounts.Add(m);
                }
            }
            else
            {
                mounts = state.Mounts.Where(m => o.Flags.Contains("a") || (m.Fstype != "proc" && m.Fstype != "sysfs")).ToList();
            }
            var only = Repeated(ctx.Args, "t", "type");
            var skip = Repeated(ctx.Args, "x", "exclude-type");
            if (only.Count > 0) mounts = mounts.Where(m => only.Contains(m.Fstype)).ToList();
            if (skip.Count > 0) mounts = mounts.Where(m => !skip.Contains(m.Fstype)).ToList();
            if (mounts.Count == 0)
            {
                if (code == 0) ctx.Err("df: no file systems processed\n");
                return 1;
            }
            bool h = o.Flags.Contains("h");
            bool T = o.Flags.Contains("T");
            var header = new List<string> { "Filesystem" };
            if (T) header.Add("Type");
            header.AddRange(new[] { h ? "Size" : "1K-blocks", "Used", h ? "Avail" : "Available", "Use%", "Mounted on" });
            var rows = new List<List<string>> { header };
            foreach (var m in mounts)
            {
                var u = DisksLib.MountUsage(sh.Vfs, state, m, root);
                long size = (long)Math.Floor(u.Size / 1024);
                long used = (long)Math.Ceiling(u.Used / 1024);
                long avail = (long)Math.Floor(u.Avail / 1024);
                var pct = used + avail > 0 ? $"{(long)Math.Ceiling(used * 100 / (double)(used + avail))}%" : "-";
                string Fmt(long kb) => h ? UtilCmd.HumanSize(kb * 1024.0) : Js.Num(kb);
                var row = new List<string> { m.Source };
                if (T) row.Add(m.Fstype);
                row.AddRange(new[] { Fmt(size), Fmt(used), Fmt(avail), pct, m.Target });
                rows.Add(row);
            }
            // Minimum column widths as in GNU df.
            var align = new List<char> { 'l' };
            if (T) align.Add('l');
            align.AddRange(new[] { 'r', 'r', 'r', 'r', 'l' });
            var minWidths = new List<int> { 14 };
            if (T) minWidths.Add(4);
            minWidths.AddRange(new[] { 5, 5, 5, 4 });
            ctx.Out(Table(rows, align, minWidths));
            return code;
        },
    };

    // ---------- lsblk ----------

    private sealed class LsblkRow
    {
        public Block Block { get; init; } = null!;
        public string Prefix { get; init; } = "";
    }

    private sealed record Column<T>(char Align, Func<T, bool, string> Get);

    private static Dictionary<string, Column<LsblkRow>> LsblkColumns(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var state = sh.Disks;
        var root = sh.RootUser();
        List<string> Mountpoints(Block b)
        {
            if (b.Dev.SwapActive) return new List<string> { "[SWAP]" };
            var list = DisksLib.MountsOf(state, b.Name).Select(m => m.Target).ToList();
            list.Reverse();
            return list;
        }
        Usage? Use(Block b) => DisksLib.MountsOf(state, b.Name).Count > 0 ? DisksLib.PartitionUsage(sh.Vfs, state, b.Dev, b.Name, root) : null;
        int Minor(Block b) => b.Part is not null ? b.Disk.Minor + b.Disk.Partitions.IndexOf(b.Part) + 1 : b.Disk.Minor;
        Column<LsblkRow> C(char align, Func<LsblkRow, bool, string> get) => new(align, get);
        return new Dictionary<string, Column<LsblkRow>>
        {
            ["NAME"] = C('l', (r, full) => r.Prefix + (full ? r.Block.Path : r.Block.Name)),
            ["KNAME"] = C('l', (r, _) => r.Block.Name),
            ["PATH"] = C('l', (r, _) => r.Block.Path),
            ["MAJ:MIN"] = C('l', (r, _) => $"{Js.Num(r.Block.Disk.Major).PadLeft(3)}:{Js.Num(Minor(r.Block)).PadRight(3)}"),
            ["RM"] = C('r', (r, _) => r.Block.Disk.Removable ? "1" : "0"),
            ["SIZE"] = C('r', (r, _) => DisksLib.LsblkSize(DisksLib.BlockSize(r.Block.Dev))),
            ["RO"] = C('r', (_, _) => "0"),
            ["TYPE"] = C('l', (r, _) => r.Block.Part is not null ? "part" : "disk"),
            ["MOUNTPOINT"] = C('l', (r, _) => Mountpoints(r.Block).FirstOrDefault() ?? ""),
            ["MOUNTPOINTS"] = C('l', (r, _) => string.Join("\n", Mountpoints(r.Block))),
            ["FSTYPE"] = C('l', (r, _) => r.Block.Dev.Fstype ?? ""),
            ["FSVER"] = C('l', (r, _) => r.Block.Dev.Fsver ?? ""),
            ["LABEL"] = C('l', (r, _) => r.Block.Dev.Label ?? ""),
            ["UUID"] = C('l', (r, _) => r.Block.Dev.Uuid ?? ""),
            ["PARTUUID"] = C('l', (r, _) => r.Block.Part?.Partuuid ?? ""),
            ["PTTYPE"] = C('l', (r, _) => r.Block.Disk.Pttype ?? ""),
            ["FSSIZE"] = C('r', (r, _) => Use(r.Block) is { } u ? DisksLib.LsblkSize(u.Size) : ""),
            ["FSUSED"] = C('r', (r, _) => Use(r.Block) is { } u ? DisksLib.LsblkSize(u.Used) : ""),
            ["FSAVAIL"] = C('r', (r, _) => Use(r.Block) is { } u ? DisksLib.LsblkSize(u.Avail) : ""),
            ["FSUSE%"] = C('r', (r, _) =>
            {
                var u = Use(r.Block);
                return u is not null ? $"{(u.Used + u.Avail != 0 ? Js.Num(Math.Ceiling(u.Used * 100 / (u.Used + u.Avail))) : "0")}%" : "";
            }),
            ["MODEL"] = C('l', (r, _) => r.Block.Part is not null ? "" : r.Block.Disk.Model),
            ["TRAN"] = C('l', (r, _) => r.Block.Part is not null ? "" : r.Block.Disk.Tran),
            ["HOTPLUG"] = C('r', (r, _) => r.Block.Disk.Removable ? "1" : "0"),
        };
    }

    private static readonly Regex LeadingPlus = new(@"^\+", RegexOptions.CultureInvariant);

    private static readonly CommandDef Lsblk = new()
    {
        Name = "lsblk",
        Summary = "Listar diskar och partitioner (blockenheter)",
        SummaryEn = "List disks and partitions (block devices)",
        Man = LsblkMan,
        ManEn = LsblkManEn,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "fdplnab",
                Values = "o",
                Long = Long(("fs", "f"), ("nodeps", "d"), ("paths", "p"), ("list", "l"), ("noheadings", "n"), ("all", "a"), ("bytes", "b"), ("output", "o")),
            });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var state = ctx.Sh.Disks;
            var cols = LsblkColumns(ctx);
            var defaults = o.Flags.Contains("f")
                ? new List<string> { "NAME", "FSTYPE", "FSVER", "LABEL", "UUID", "FSAVAIL", "FSUSE%", "MOUNTPOINTS" }
                : new List<string> { "NAME", "MAJ:MIN", "RM", "SIZE", "RO", "TYPE", "MOUNTPOINTS" };
            var names = defaults;
            var oVal = o.Values.Get("o");
            if (oVal is not null)
            {
                var list = LeadingPlus.Replace(oVal, "", 1).Split(',').Select(s => s.Trim().ToUpperInvariant()).Where(s => s != "").ToList();
                names = oVal.StartsWith('+') ? defaults.Concat(list).ToList() : list;
            }
            foreach (var n in names)
            {
                if (!cols.ContainsKey(n))
                {
                    ctx.Err($"lsblk: unknown column: {n}\n");
                    return 1;
                }
            }
            var disks = state.Disks;
            Partition? onlyPart = null;
            int code = 0;
            if (o.Operands.Count > 0)
            {
                disks = new List<Disk>();
                foreach (var op in o.Operands)
                {
                    var b = op.StartsWith('/') ? DisksLib.FindBlock(state, op) : null;
                    if (b is null)
                    {
                        ctx.Err($"lsblk: {op}: not a block device\n");
                        code = 32;
                        continue;
                    }
                    if (b.Part is not null) onlyPart = b.Part;
                    if (!disks.Contains(b.Disk)) disks.Add(b.Disk);
                }
                if (disks.Count == 0) return code;
            }
            var rows = new List<LsblkRow>();
            bool tree = !o.Flags.Contains("l");
            foreach (var disk in disks)
            {
                if (onlyPart is not null && disk.Partitions.Contains(onlyPart))
                {
                    rows.Add(new LsblkRow { Block = DisksLib.AllBlocks(state).First(b => b.Part == onlyPart), Prefix = "" });
                    continue;
                }
                rows.Add(new LsblkRow { Block = new Block { Path = $"/dev/{disk.Name}", Name = disk.Name, Disk = disk, Dev = disk }, Prefix = "" });
                if (o.Flags.Contains("d")) continue;
                for (int i = 0; i < disk.Partitions.Count; i++)
                {
                    var p = disk.Partitions[i];
                    var prefix = tree ? Branch(i == disk.Partitions.Count - 1) : "";
                    rows.Add(new LsblkRow { Block = new Block { Path = $"/dev/{p.Name}", Name = p.Name, Disk = disk, Part = p, Dev = p }, Prefix = prefix });
                }
            }
            bool full = o.Flags.Contains("p");
            var table = rows.Select(r => names.Select(n => cols[n].Get(r, full)).ToList()).ToList();
            if (!o.Flags.Contains("n")) table.Insert(0, names.ToList());
            ctx.Out(Table(table, names.Select(n => cols[n].Align).ToList()));
            return code;
        },
    };

    // ---------- blkid ----------

    private static readonly Regex Leading0x = new(@"^0x", RegexOptions.CultureInvariant);

    private static List<(string Key, string Value)> BlkidTags(Block b)
    {
        var d = b.Dev;
        var tags = new List<(string, string)>();
        if (string.IsNullOrEmpty(d.Fstype))
        {
            if (b.Part is null && !string.IsNullOrEmpty(b.Disk.Pttype))
            {
                tags.Add(("PTUUID", b.Disk.Pttype == "dos" ? Leading0x.Replace(b.Disk.DiskId!, "", 1) : b.Disk.DiskId!.ToLowerInvariant()));
                tags.Add(("PTTYPE", b.Disk.Pttype));
            }
            return tags;
        }
        if (!string.IsNullOrEmpty(d.Label)) tags.Add(("LABEL", d.Label));
        if (!string.IsNullOrEmpty(d.Uuid)) tags.Add(("UUID", d.Uuid));
        if (d.Fstype != "swap") tags.Add(("BLOCK_SIZE", d.Fstype == "vfat" ? "512" : "4096"));
        tags.Add(("TYPE", d.Fstype));
        if (b.Part is not null) tags.Add(("PARTUUID", b.Part.Partuuid));
        return tags;
    }

    private static readonly CommandDef Blkid = new()
    {
        Name = "blkid",
        Summary = "Visar filsystemens typ, etikett och UUID",
        SummaryEn = "Show the type, label and UUID of file systems",
        Man = BlkidMan,
        ManEn = BlkidManEn,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "cp",
                Values = "soLU",
                Long = Long(("match-tag", "s"), ("output", "o"), ("label", "L"), ("uuid", "U")),
            });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var state = ctx.Sh.Disks;
            var L = o.Values.Get("L");
            var U = o.Values.Get("U");
            if (L is not null || U is not null)
            {
                var b = DisksLib.FindBlock(state, L is not null ? $"LABEL={L}" : $"UUID={U}");
                if (b is null) return 2;
                ctx.Out(b.Path + "\n");
                return 0;
            }
            var format = o.Values.Get("o") ?? "full";
            if (!new[] { "full", "value", "export", "device", "list" }.Contains(format))
            {
                ctx.Err($"blkid: unsupported output format {format}\n");
                return 2;
            }
            List<Block> blocks;
            if (o.Operands.Count > 0)
            {
                blocks = new List<Block>();
                foreach (var op in o.Operands)
                {
                    var b = DisksLib.FindBlock(state, op);
                    if (b is not null) blocks.Add(b);
                }
            }
            else
            {
                blocks = DisksLib.AllBlocks(state).Where(b => !string.IsNullOrEmpty(b.Dev.Fstype)).ToList();
            }
            bool found = false;
            var s = o.Values.Get("s");
            foreach (var b in blocks)
            {
                var tags = BlkidTags(b);
                if (!string.IsNullOrEmpty(s)) tags = tags.Where(t => t.Key == s.ToUpperInvariant()).ToList();
                if (tags.Count == 0) continue;
                found = true;
                if (format == "value") foreach (var (_, v) in tags) ctx.Out(v + "\n");
                else if (format == "device") ctx.Out(b.Path + "\n");
                else if (format == "export") ctx.Out($"DEVNAME={b.Path}\n{string.Concat(tags.Select(t => $"{t.Key}={t.Value}\n"))}\n");
                else ctx.Out($"{b.Path}: {string.Join(" ", tags.Select(t => $"{t.Key}=\"{t.Value}\""))}\n");
            }
            return found ? 0 : 2;
        },
    };

    // ---------- mount / umount ----------

    private const string VfatExtra = "codepage=437,iocharset=ascii,shortname=mixed,utf8,errors=remount-ro";
    private static readonly HashSet<string> Generic = new() { "nosuid", "nodev", "noexec", "noatime", "sync", "dirsync", "nodiratime" };

    private sealed class ParsedOpts
    {
        public bool Ro;
        public string? Uid;
        public string? Gid;
        public int Fmask = Js.Oct(22);
        public int Dmask = Js.Oct(22);
        public double? Size;
        public List<string> Generic = new();
        public bool User;
        public bool Noauto;
    }

    private static readonly Regex SizeRe = new(@"^([0-9]+)([kKmMgG%]?)\z", RegexOptions.CultureInvariant);

    /// <summary>parseInt(v, 8) || 0</summary>
    private static int OctOrZero(string v)
    {
        var n = Js.ParseInt(v, 8);
        return double.IsNaN(n) ? 0 : (int)n;
    }

    private static ParsedOpts ParseMountOptions(Shell sh, IEnumerable<string> list)
    {
        var p = new ParsedOpts();
        foreach (var opt in list.SelectMany(l => l.Split(',')).Where(s => s != ""))
        {
            var kv = opt.Split('=');
            var k = kv[0];
            var v = kv.Length > 1 ? kv[1] : "";
            if (k == "ro") p.Ro = true;
            else if (k == "rw") p.Ro = false;
            else if (k == "uid") p.Uid = UserFromSpec(sh, v);
            else if (k == "gid") p.Gid = UserFromSpec(sh, v);
            else if (k == "umask") p.Fmask = p.Dmask = OctOrZero(v);
            else if (k == "fmask") p.Fmask = OctOrZero(v);
            else if (k == "dmask") p.Dmask = OctOrZero(v);
            else if (k == "size")
            {
                var m = SizeRe.Match(v);
                if (m.Success)
                {
                    double n = Js.Number(m.Groups[1].Value);
                    var unit = m.Groups[2].Value.ToLowerInvariant();
                    p.Size = unit == "k" ? n * 1024 : unit == "m" ? n * Math.Pow(1024, 2) : unit == "g" ? n * Math.Pow(1024, 3) : n;
                }
            }
            else if (k == "user" || k == "users") p.User = true;
            else if (k == "noauto") p.Noauto = true;
            else if (Generic.Contains(k)) p.Generic.Add(k);
        }
        return p;
    }

    /// <summary>n.toString(8).padStart(4, '0')</summary>
    private static string Oct4(int n) =>
        (n < 0 ? "-" + Convert.ToString(-(long)n, 8) : Convert.ToString(n, 8)).PadLeft(4, '0');

    private static string OptionString(Shell sh, string fstype, ParsedOpts p)
    {
        var head = new List<string> { p.Ro ? "ro" : "rw" };
        head.AddRange(p.Generic);
        head.Add("relatime");
        switch (fstype)
        {
            case "vfat":
            {
                var ids = new List<string>();
                if (!string.IsNullOrEmpty(p.Uid)) ids.Add($"uid={UidOf(sh, p.Uid)}");
                if (!string.IsNullOrEmpty(p.Gid)) ids.Add($"gid={UidOf(sh, p.Gid)}");
                return string.Join(",", head.Concat(ids).Concat(new[] { $"fmask={Oct4(p.Fmask)}", $"dmask={Oct4(p.Dmask)}", VfatExtra }));
            }
            case "tmpfs":
            {
                var parts = new List<string>(head);
                if (p.Size is double size && size != 0 && !double.IsNaN(size)) parts.Add($"size={Js.Num(Math.Floor(size / 1024))}k");
                parts.Add("inode64");
                return string.Join(",", parts);
            }
            default:
                return string.Join(",", head);
        }
    }

    /// <summary>FAT has no permissions in Linux: all files get the same owner and permissions when mounted.</summary>
    private static void ApplyFatOwnership(FsNode node, string owner, string group, int fileMode, int dirMode)
    {
        node.Owner = owner;
        node.Group = group;
        node.Mode = node.Type == "dir" ? dirMode : fileMode;
        if (node.Children is not null)
            foreach (var child in node.Children.Values) ApplyFatOwnership(child, owner, group, fileMode, dirMode);
    }

    private static int WrongFs(CmdCtx ctx, string target, string source)
    {
        ctx.Err(
            $"mount: {target}: wrong fs type, bad option, bad superblock on {source}, missing codepage or helper program, or other error.\n" +
            "       dmesg(1) may have more information after failed mount system call.\n");
        return 32;
    }

    private sealed class FstabEntry
    {
        public string Spec = "";
        public string File = "";
        public string Type = "";
        public string Options = "";
    }

    private static readonly Regex Whitespace = new(@"\s+", RegexOptions.CultureInvariant);

    private static List<FstabEntry> ReadFstab(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var text = sh.Vfs.TryLookup("/etc/fstab", sh.RootUser())?.Content ?? "";
        var entries = new List<FstabEntry>();
        foreach (var raw in text.Split('\n'))
        {
            var line = raw.Trim();
            if (line == "" || line.StartsWith('#')) continue;
            var f = Whitespace.Split(line);
            var spec = f[0];
            var file = f.Length > 1 ? f[1] : "";
            var type = f.Length > 2 ? f[2] : "auto";
            var options = f.Length > 3 ? f[3] : "defaults";
            if (spec != "" && file != "") entries.Add(new FstabEntry { Spec = spec, File = file == "none" ? file : VfsLib.NormalizePath(file), Type = type, Options = options });
        }
        return entries;
    }

    private static readonly Regex SpecPrefix = new(@"^(LABEL|UUID|PARTUUID)=", RegexOptions.CultureInvariant);
    private static readonly Regex LabelUuidPrefix = new(@"^(LABEL|UUID)=", RegexOptions.CultureInvariant);
    private static readonly string[] KnownFs = { "ext2", "ext3", "ext4", "vfat", "btrfs", "xfs", "ntfs", "ntfs3", "exfat", "iso9660" };

    /// <summary>Mounts a device (or tmpfs) on a directory. Returns the exit status.</summary>
    private static int DoMount(CmdCtx ctx, string sourceSpec, string targetArg, string? type, ParsedOpts opts, bool verbose, bool fromFstab = false)
    {
        var sh = ctx.Sh;
        var state = sh.Disks;
        var root = sh.RootUser();
        var target = sh.Resolve(targetArg);
        if (!IsRoot(ctx) && !(fromFstab && opts.User))
        {
            ctx.Err($"mount: {target}: must be superuser to use mount.\n");
            return 1;
        }
        var node = sh.Vfs.TryLookup(target, root);
        if (node is null)
        {
            ctx.Err($"mount: {target}: mount point does not exist.\n       dmesg(1) may have more information after failed mount system call.\n");
            return 32;
        }
        if (node.Type != "dir")
        {
            ctx.Err($"mount: {target}: mount point is not a directory.\n");
            return 32;
        }
        var busyTarget = state.Mounts.FirstOrDefault(m => m.Target == target);

        // tmpfs: a new, empty file system in RAM.
        if (type == "tmpfs")
        {
            if (busyTarget is not null)
            {
                ctx.Err($"mount: {target}: {sourceSpec} already mounted or mount point busy.\n");
                return 32;
            }
            var fresh = VfsLib.MakeDir("root", Js.Oct(1777));
            var (tdir, tname) = sh.Vfs.Parent(target, root);
            var tunder = tdir.Children!.Get(tname);
            tdir.Children![tname] = fresh;
            state.Mounts.Add(new Mount
            {
                Source = sourceSpec,
                Target = target,
                Fstype = "tmpfs",
                Options = OptionString(ctx.Sh, "tmpfs", opts),
                Size = opts.Size is double sz ? (long)sz : 8_073_420 / 2 * 1024L,
                Under = tunder,
            });
            DisksLib.WriteProcMounts(sh.Vfs, state);
            if (verbose) ctx.Out($"mount: {sourceSpec} mounted on {target}.\n");
            return 0;
        }

        var block = DisksLib.FindBlock(state, sourceSpec);
        if (block is null)
        {
            if (SpecPrefix.IsMatch(sourceSpec)) ctx.Err($"mount: {target}: can't find {sourceSpec}.\n");
            else ctx.Err($"mount: {target}: special device {sourceSpec} does not exist.\n       dmesg(1) may have more information after failed mount system call.\n");
            return 32;
        }
        var dev = block.Dev;
        if (dev.Fstype == "swap")
        {
            ctx.Err($"mount: {target}: unknown filesystem type 'swap'.\n       dmesg(1) may have more information after failed mount system call.\n");
            return 32;
        }
        if (string.IsNullOrEmpty(dev.Fstype))
        {
            var code = WrongFs(ctx, target, block.Path);
            if (block.Part is null && block.Disk.Partitions.Count > 0)
            {
                var suffix = block.Disk.Partitions[0].Name.Slice(block.Disk.Name.Length);
                Tip(ctx, "disks.wholeDiskTip", ("disk", block.Path), ("suffix", suffix));
            }
            return code;
        }
        var fstype = dev.Fstype;
        var wanted = type == "auto" ? null : type == "msdos" || type == "fat" ? "vfat" : type;
        if (!string.IsNullOrEmpty(wanted) && wanted != fstype)
        {
            if (!KnownFs.Contains(wanted))
            {
                ctx.Err($"mount: {target}: unknown filesystem type '{type}'.\n       dmesg(1) may have more information after failed mount system call.\n");
                return 32;
            }
            return WrongFs(ctx, target, block.Path);
        }
        var already = DisksLib.MountsOf(state, block.Name);
        if (already.Count > 0)
        {
            ctx.Err($"mount: {target}: {block.Path} already mounted on {already[^1].Target}.\n       dmesg(1) may have more information after failed mount system call.\n");
            return 32;
        }
        if (busyTarget is not null)
        {
            ctx.Err($"mount: {target}: {block.Path} already mounted or mount point busy.\n");
            return 32;
        }
        var fsRoot = dev.Root ?? VfsLib.MakeDir();
        dev.Root = null;
        if (fstype == "vfat")
        {
            var owner = opts.Uid ?? (fromFstab && opts.User ? sh.CurrentUser().Name : "root");
            var group = opts.Gid ?? (owner == "root" ? "root" : owner);
            ApplyFatOwnership(fsRoot, owner, group, Js.Oct(777) & ~opts.Fmask, Js.Oct(777) & ~opts.Dmask);
        }
        var (dir, name) = sh.Vfs.Parent(target, root);
        var under = dir.Children!.Get(name);
        dir.Children![name] = fsRoot;
        state.Mounts.Add(new Mount { Source = block.Path, Target = target, Fstype = fstype, Options = OptionString(ctx.Sh, fstype, opts), Dev = block.Name, Under = under });
        DisksLib.WriteProcMounts(sh.Vfs, state);
        if (verbose) ctx.Out($"mount: {block.Path} mounted on {target}.\n");
        return 0;
    }

    private static int ListMounts(CmdCtx ctx, string? types, bool labels)
    {
        var state = ctx.Sh.Disks;
        var only = types?.Split(',');
        foreach (var m in state.Mounts)
        {
            if (only is not null && !only.Contains(m.Fstype)) continue;
            var label = labels && m.Dev is not null ? DisksLib.FindBlock(state, m.Dev)?.Dev.Label : null;
            ctx.Out($"{m.Source} on {m.Target} type {m.Fstype} ({m.Options}){(!string.IsNullOrEmpty(label) ? $" [{label}]" : "")}\n");
        }
        return 0;
    }

    private static readonly CommandDef MountCmd = new()
    {
        Name = "mount",
        Summary = "Monterar ett filsystem i katalogträdet",
        SummaryEn = "Mount a file system into the directory tree",
        Man = MountMan,
        ManEn = MountManEn,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "alvrwnf",
                Values = "to",
                Long = Long(("all", "a"), ("show-labels", "l"), ("verbose", "v"), ("read-only", "r"), ("rw", "w"), ("read-write", "w"), ("types", "t"), ("options", "o"), ("fake", "f")),
            });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var sh = ctx.Sh;
            var optList = new List<string>();
            var oVal = o.Values.Get("o");
            if (!string.IsNullOrEmpty(oVal)) optList.Add(oVal);
            if (o.Flags.Contains("r")) optList.Add("ro");
            if (o.Flags.Contains("w")) optList.Add("rw");
            bool verbose = o.Flags.Contains("v");
            if (o.Flags.Contains("a"))
            {
                if (!IsRoot(ctx))
                {
                    ctx.Err("mount: only root can use \"--all\" option\n");
                    return 1;
                }
                int code = 0;
                foreach (var e in ReadFstab(ctx))
                {
                    if (e.Type == "swap" || e.File == "none") continue;
                    var opts = ParseMountOptions(ctx.Sh, new[] { e.Options });
                    if (opts.Noauto) continue;
                    var b = DisksLib.FindBlock(sh.Disks, e.Spec);
                    if (b is not null && DisksLib.MountsOf(sh.Disks, b.Name).Any(m => m.Target == e.File)) continue;
                    if (b is null && e.Type != "tmpfs" && sh.Disks.Mounts.Any(m => m.Target == e.File)) continue;
                    var r = DoMount(ctx, e.Spec, e.File, e.Type == "auto" ? null : e.Type, opts, verbose, true);
                    if (r != 0) code = r;
                }
                return code;
            }
            if (o.Operands.Count == 0) return ListMounts(ctx, o.Values.Get("t"), o.Flags.Contains("l"));
            if (o.Operands.Count == 1)
            {
                var arg = o.Operands[0];
                var entries = ReadFstab(ctx);
                var path = sh.Resolve(arg);
                var b = DisksLib.FindBlock(sh.Disks, arg);
                var e = entries.FirstOrDefault(x =>
                    x.File == path || x.Spec == arg || (b is not null && DisksLib.FindBlock(sh.Disks, x.Spec)?.Name == b.Name));
                if (e is null)
                {
                    if (!IsRoot(ctx)) ctx.Err($"mount: {path}: must be superuser to use mount.\n");
                    else ctx.Err($"mount: {arg}: can't find in /etc/fstab.\n");
                    return 1;
                }
                var opts = ParseMountOptions(ctx.Sh, new[] { e.Options }.Concat(optList));
                return DoMount(ctx, e.Spec, e.File, o.Values.Get("t") ?? (e.Type == "auto" ? null : e.Type), opts, verbose, true);
            }
            if (o.Operands.Count > 2) return UtilCmd.BadOption(ctx, "bad usage");
            return DoMount(ctx, o.Operands[0], o.Operands[1], o.Values.Get("t"), ParseMountOptions(ctx.Sh, optList), verbose);
        },
    };

    private static readonly CommandDef Umount = new()
    {
        Name = "umount",
        Summary = "Avmonterar ett filsystem",
        SummaryEn = "Unmount a file system",
        Man = UmountMan,
        ManEn = UmountManEn,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "vfl", Long = Long(("verbose", "v"), ("force", "f"), ("lazy", "l")) });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            if (o.Operands.Count == 0)
            {
                ctx.Err("umount: bad usage\nTry 'umount --help' for more information.\n");
                return 1;
            }
            var sh = ctx.Sh;
            var state = sh.Disks;
            var root = sh.RootUser();
            int code = 0;
            foreach (var arg in o.Operands)
            {
                var block = arg.StartsWith("/dev/", StringComparison.Ordinal) || LabelUuidPrefix.IsMatch(arg) ? DisksLib.FindBlock(state, arg) : null;
                Mount? m;
                string shown;
                if (block is not null)
                {
                    shown = block.Path;
                    m = DisksLib.MountsOf(state, block.Name).LastOrDefault();
                }
                else
                {
                    var target = sh.Resolve(arg);
                    shown = target;
                    m = state.Mounts.LastOrDefault(x => x.Target == target);
                    if (m is null && sh.Vfs.TryLookup(target, root) is null)
                    {
                        ctx.Err($"umount: {arg}: no mount point specified.\n");
                        code = 1;
                        continue;
                    }
                }
                if (!IsRoot(ctx))
                {
                    ctx.Err($"umount: {shown}: must be superuser to use umount.\n");
                    code = 1;
                    continue;
                }
                if (m is null)
                {
                    ctx.Err($"umount: {shown}: not mounted.\n");
                    code = 32;
                    continue;
                }
                var t = m.Target;
                bool Inside(string p) => p == t || p.StartsWith(t == "/" ? "/" : t + "/", StringComparison.Ordinal);
                var nested = state.Mounts.Any(x => x != m && x.Target != t && Inside(x.Target));
                if (m.System || nested || Inside(sh.Cwd))
                {
                    ctx.Err($"umount: {t}: target is busy.\n");
                    if (Inside(sh.Cwd) && !m.System)
                    {
                        Tip(ctx, "disks.shellInsideDir");
                    }
                    code = 32;
                    continue;
                }
                var (dir, name) = sh.Vfs.Parent(t, root);
                var fsRoot = dir.Children!.Get(name);
                if (m.Dev is not null)
                {
                    var b = DisksLib.FindBlock(state, m.Dev);
                    if (b is not null) b.Dev.Root = fsRoot?.Type == "dir" ? fsRoot : VfsLib.MakeDir();
                }
                if (m.Under is not null) dir.Children![name] = m.Under;
                else dir.Children![name] = VfsLib.MakeDir();
                var removed = m;
                state.Mounts = state.Mounts.Where(x => x != removed).ToList();
                DisksLib.WriteProcMounts(sh.Vfs, state);
                if (o.Flags.Contains("v")) ctx.Out($"umount: {t} unmounted\n");
            }
            return code;
        },
    };

    // ---------- findmnt ----------

    private static readonly CommandDef Findmnt = new()
    {
        Name = "findmnt",
        Summary = "Visar monterade filsystem som ett träd",
        SummaryEn = "Show mounted file systems as a tree",
        Man = FindmntMan,
        ManEn = FindmntManEn,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "lnr",
                Values = "toT",
                Long = Long(("list", "l"), ("noheadings", "n"), ("raw", "r"), ("types", "t"), ("output", "o"), ("target", "T")),
            });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var sh = ctx.Sh;
            var state = sh.Disks;
            var root = sh.RootUser();
            Column<Mount> C(char align, Func<Mount, string> get) => new(align, (m, _) => get(m));
            var cols = new Dictionary<string, Column<Mount>>
            {
                ["TARGET"] = C('l', m => m.Target),
                ["SOURCE"] = C('l', m => m.Subvol is not null ? $"{m.Source}[{m.Subvol}]" : m.Source),
                ["FSTYPE"] = C('l', m => m.Fstype),
                ["OPTIONS"] = C('l', m => m.Options),
                ["UUID"] = C('l', m => m.Dev is not null ? DisksLib.FindBlock(state, m.Dev)?.Dev.Uuid ?? "" : ""),
                ["LABEL"] = C('l', m => m.Dev is not null ? DisksLib.FindBlock(state, m.Dev)?.Dev.Label ?? "" : ""),
                ["SIZE"] = C('r', m => DisksLib.LsblkSize(DisksLib.MountUsage(sh.Vfs, state, m, root).Size)),
                ["USED"] = C('r', m => DisksLib.LsblkSize(DisksLib.MountUsage(sh.Vfs, state, m, root).Used)),
                ["AVAIL"] = C('r', m => DisksLib.LsblkSize(DisksLib.MountUsage(sh.Vfs, state, m, root).Avail)),
                ["USE%"] = C('r', m =>
                {
                    var u = DisksLib.MountUsage(sh.Vfs, state, m, root);
                    return u.Size != 0 ? $"{Js.Num(Math.Ceiling(u.Used * 100 / Math.Max(1, u.Used + u.Avail)))}%" : "0%";
                }),
            };
            var names = (o.Values.Get("o") ?? "TARGET,SOURCE,FSTYPE,OPTIONS").Split(',').Select(s => s.Trim().ToUpperInvariant()).Where(s => s != "").ToList();
            foreach (var n in names)
            {
                if (!cols.ContainsKey(n))
                {
                    ctx.Err($"findmnt: unknown column: {n}\n");
                    return 1;
                }
            }
            var mounts = state.Mounts;
            bool tree = !o.Flags.Contains("l") && !o.Flags.Contains("r");
            var tVal = o.Values.Get("t");
            if (!string.IsNullOrEmpty(tVal))
            {
                var types = tVal.Split(',');
                mounts = mounts.Where(m => types.Contains(m.Fstype)).ToList();
                tree = false;
            }
            var TVal = o.Values.Get("T");
            var pick = TVal ?? (o.Operands.Count > 0 ? o.Operands[0] : null);
            if (pick is not null)
            {
                tree = false;
                if (TVal is not null)
                {
                    var m = DisksLib.MountFor(state, sh.Resolve(pick));
                    mounts = m is not null ? new List<Mount> { m } : new List<Mount>();
                }
                else
                {
                    var b = pick.StartsWith("/dev/", StringComparison.Ordinal) || LabelUuidPrefix.IsMatch(pick) ? DisksLib.FindBlock(state, pick) : null;
                    var path = sh.Resolve(pick);
                    mounts = mounts.Where(m => m.Target == path || (b is not null && m.Dev == b.Name)).ToList();
                }
            }
            if (mounts.Count == 0) return 1;
            var rows = new List<(Mount M, string Prefix)>();
            if (tree)
            {
                var all = mounts;
                Mount? ParentOf(Mount m)
                {
                    Mount? best = null;
                    foreach (var p in all)
                    {
                        if (p == m) continue;
                        bool under = p.Target == "/" ? m.Target != "/" : m.Target.StartsWith(p.Target + "/", StringComparison.Ordinal);
                        if (under && (best is null || p.Target.Length > best.Target.Length)) best = p;
                    }
                    return best;
                }
                List<Mount> Children(Mount? p) => all.Where(m => ParentOf(m) == p).ToList();
                void Walk(Mount m, string indent, bool isLast, bool top)
                {
                    rows.Add((m, top ? "" : indent + Branch(isLast)));
                    var kids = Children(m);
                    for (int i = 0; i < kids.Count; i++)
                        Walk(kids[i], top ? "" : indent + (isLast ? "  " : "│ "), i == kids.Count - 1, false);
                }
                foreach (var top in Children(null)) Walk(top, "", true, true);
            }
            else
            {
                foreach (var m in mounts) rows.Add((m, ""));
            }
            var @out = rows.Select(r => names.Select((n, i) => (i == 0 && n == "TARGET" ? r.Prefix : "") + cols[n].Get(r.M, false)).ToList()).ToList();
            if (!o.Flags.Contains("n")) @out.Insert(0, names.ToList());
            ctx.Out(Table(@out, names.Select(n => cols[n].Align).ToList()));
            return 0;
        },
    };

    // ---------- fdisk ----------

    private static string FdiskSize(double bytes)
    {
        string[] units = { "B", "KiB", "MiB", "GiB", "TiB" };
        double v = bytes;
        int u = 0;
        while (v >= 1024 && u < units.Length - 1)
        {
            v /= 1024;
            u++;
        }
        return $"{Js.Num(Js.Number(Js.ToFixed(v, 2)))} {units[u]}";
    }

    private static string FdiskList(Disk disk)
    {
        long bytes = disk.Sectors * DisksLib.Sector;
        var @out =
            $"Disk /dev/{disk.Name}: {FdiskSize(bytes)}, {bytes} bytes, {disk.Sectors} sectors\n" +
            (disk.Model != "" ? $"Disk model: {disk.Model.PadRight(16)}\n" : "") +
            "Units: sectors of 1 * 512 = 512 bytes\n" +
            $"Sector size (logical/physical): 512 bytes / {(disk.Tran == "usb" || disk.Tran == "" ? 512 : 4096)} bytes\n" +
            $"I/O size (minimum/optimal): {(disk.Tran == "sata" ? 4096 : 512)} bytes / {(disk.Tran == "sata" ? 4096 : 512)} bytes\n";
        if (string.IsNullOrEmpty(disk.Pttype)) return @out;
        @out += $"Disklabel type: {disk.Pttype}\nDisk identifier: {disk.DiskId}\n\n";
        bool dos = disk.Pttype == "dos";
        var rows = new List<List<string>>
        {
            dos ? new List<string> { "Device", "Boot", "Start", "End", "Sectors", "Size", "Id", "Type" } : new List<string> { "Device", "Start", "End", "Sectors", "Size", "Type" },
        };
        foreach (var p in disk.Partitions)
        {
            var nums = new[] { Js.Num(p.Start), Js.Num(p.Start + p.Sectors - 1), Js.Num(p.Sectors), DisksLib.LsblkSize(p.Sectors * DisksLib.Sector) };
            var row = new List<string> { $"/dev/{p.Name}" };
            if (dos) row.Add("");
            row.AddRange(nums);
            if (dos) row.Add(p.PtypeId ?? "83");
            row.Add(p.Ptype);
            rows.Add(row);
        }
        @out += Table(rows, dos ? new[] { 'l', 'l', 'r', 'r', 'r', 'r', 'r', 'l' } : new[] { 'l', 'r', 'r', 'r', 'r', 'l' });
        return @out;
    }

    private static readonly CommandDef Fdisk = new()
    {
        Name = "fdisk",
        Summary = "Visar och ändrar partitionstabeller",
        SummaryEn = "Show and change partition tables",
        Man = FdiskMan,
        ManEn = FdiskManEn,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "l", Long = Long(("list", "l")) });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var state = ctx.Sh.Disks;
            if (!o.Flags.Contains("l"))
            {
                if (o.Operands.Count != 1)
                {
                    ctx.Err(" fdisk: bad usage\nTry 'fdisk --help' for more information.\n");
                    return 1;
                }
                var b = DisksLib.FindBlock(state, o.Operands[0]);
                if (b is null || !IsRoot(ctx))
                {
                    ctx.Err($"fdisk: cannot open {o.Operands[0]}: {(b is not null ? "Permission denied" : "No such file or directory")}\n");
                    return 1;
                }
                ctx.Out("\nWelcome to fdisk (util-linux 2.39.3).\nChanges will remain in memory only, until you decide to write them.\nBe careful before using the write command.\n\n");
                Tip(ctx, "disks.noPartitionChanges");
                return 1;
            }
            var disks = state.Disks;
            if (o.Operands.Count > 0)
            {
                disks = new List<Disk>();
                foreach (var op in o.Operands)
                {
                    var b = DisksLib.FindBlock(state, op);
                    if (b is null)
                    {
                        ctx.Err($"fdisk: cannot open {op}: No such file or directory\n");
                        continue;
                    }
                    if (!disks.Contains(b.Disk)) disks.Add(b.Disk);
                }
            }
            if (!IsRoot(ctx))
            {
                foreach (var d in disks) ctx.Err($"fdisk: cannot open /dev/{d.Name}: Permission denied\n");
                return 1;
            }
            ctx.Out(string.Join("\n\n", disks.Select(FdiskList)));
            return 0;
        },
    };

    // ---------- swapon ----------

    private static readonly CommandDef Swapon = new()
    {
        Name = "swapon",
        Summary = "Visar och slår på swap",
        SummaryEn = "Show and enable swap",
        Man = SwaponMan,
        ManEn = SwaponManEn,
        Run = ctx =>
        {
            var args = ctx.Args;
            var state = ctx.Sh.Disks;
            var active = DisksLib.AllBlocks(state).Where(b => b.Dev.SwapActive).ToList();
            var a0 = args.Count > 0 ? args[0] : null;
            if (args.Count == 0 || a0 == "--show" || a0 == "-s" || a0 == "--summary")
            {
                if (a0 == "-s" || a0 == "--summary")
                {
                    ctx.Out("Filename\t\t\t\tType\t\tSize\t\tUsed\t\tPriority\n");
                    foreach (var b in active)
                        ctx.Out($"{b.Path.PadRight(40)}partition\t{Js.Num(DisksLib.BlockSize(b.Dev) / 1024.0)}\t\t0\t\t{(b.Disk.Tran != "" ? -2 : 100)}\n");
                    return 0;
                }
                var rows = new List<List<string>> { new() { "NAME", "TYPE", "SIZE", "USED", "PRIO" } };
                foreach (var b in active)
                    rows.Add(new List<string> { b.Path, "partition", DisksLib.LsblkSize(DisksLib.BlockSize(b.Dev)), "0B", b.Disk.Tran != "" ? "-2" : "100" });
                ctx.Out(Table(rows, new[] { 'l', 'l', 'r', 'r', 'r' }));
                return 0;
            }
            if (a0 == "-a" || a0 == "--all") return IsRoot(ctx) ? 0 : 1;
            var blk = DisksLib.FindBlock(state, a0!);
            if (blk is null)
            {
                ctx.Err($"swapon: cannot open {a0}: No such file or directory\n");
                return 1;
            }
            if (!IsRoot(ctx))
            {
                ctx.Err($"swapon: {blk.Path}: swapon failed: Operation not permitted\n");
                return 1;
            }
            if (blk.Dev.SwapActive) ctx.Err($"swapon: {blk.Path}: swapon failed: Device or resource busy\n");
            else ctx.Err($"swapon: {blk.Path}: read swap header failed\n");
            return 1;
        },
    };

    // ---------- sync ----------

    private static readonly CommandDef Sync = new()
    {
        Name = "sync",
        Summary = "Skriver allt som väntar i minnet till diskarna",
        SummaryEn = "Write everything waiting in memory to the disks",
        Man = SyncMan,
        ManEn = SyncManEn,
        Run = _ => 0,
    };

    // ---------- mkfs ----------

    /// <summary>Creates a new, empty file system on a partition – everything that was there is lost. fstype: ext2, ext3, ext4 or vfat.</summary>
    private static int MakeFs(CmdCtx ctx, string fstype, string? spec, string? label, bool force)
    {
        bool ext = fstype != "vfat";
        var prog = ext ? $"mkfs.{fstype}" : "mkfs.fat";
        if (ext) ctx.Out(ctx.Sh.Distro.Family == "debian" ? "mke2fs 1.47.0 (5-Feb-2023)\n" : "mke2fs 1.47.3 (8-Jul-2025)\n");
        else ctx.Out("mkfs.fat 4.2 (2021-01-31)\n");
        if (string.IsNullOrEmpty(spec))
        {
            ctx.Err(ext ? "Usage: mke2fs [-L volume-label] [-t fs-type] [-F] device [blocks-count]\n" : "No device specified.\nUsage: mkfs.fat [OPTIONS] TARGET [BLOCKS]\n");
            return 1;
        }
        var state = ctx.Sh.Disks;
        var b = DisksLib.FindBlock(state, spec);
        if (b is null)
        {
            ctx.Err(ext ? $"The file {spec} does not exist and no size was specified.\n" : $"mkfs.fat: unable to open {spec}: No such file or directory\n");
            return 1;
        }
        if (!IsRoot(ctx))
        {
            ctx.Err(ext ? $"{prog}: Permission denied while trying to determine filesystem size\n" : $"mkfs.fat: unable to open {b.Path}: Permission denied\n");
            return 1;
        }
        var dev = b.Dev;
        if (DisksLib.MountsOf(state, b.Name).Count > 0)
        {
            ctx.Err(ext ? $"{b.Path} is mounted; will not make a filesystem here!\n" : $"mkfs.fat: {b.Path} contains a mounted filesystem.\n");
            return 1;
        }
        if (dev.SwapActive)
        {
            ctx.Err(ext ? $"{b.Path} is apparently in use by the system; will not make a filesystem here!\n" : $"mkfs.fat: unable to open {b.Path}: Device or resource busy\n");
            return 1;
        }
        if (b.Part is null && b.Disk.Partitions.Count > 0)
        {
            ctx.Out($"Found a {b.Disk.Pttype} partition table in {b.Path}\n");
            Tip(ctx, "disks.formatPartitionsOnly");
            return 1;
        }
        var sh = ctx.Sh;
        int Finish(Sink io)
        {
            var uuid = DisksLib.NewUuid(fstype);
            dev.Fstype = fstype;
            dev.Fsver = ext ? "1.0" : "FAT32";
            dev.Uuid = uuid;
            dev.Label = string.IsNullOrEmpty(label) ? null : label;
            dev.Base = 0;
            var fresh = VfsLib.MakeDir("root", Js.Oct(755));
            if (ext)
            {
                var children = Js.Obj<FsNode>();
                children["lost+found"] = VfsLib.MakeDir("root", Js.Oct(700));
                fresh.Children = children;
            }
            dev.Root = fresh;
            if (ext)
            {
                long blocks = DisksLib.BlockSize(dev) / 4096;
                io.Out(
                    $"Creating filesystem with {blocks} 4k blocks and {blocks / 4 / 8192 * 8192} inodes\n" +
                    $"Filesystem UUID: {uuid}\n" +
                    "Superblock backups stored on blocks: \n\t32768, 98304, 163840, 229376, 294912, 819200, 884736, 1605632, 2654208\n\n" +
                    "Allocating group tables: done                            \n" +
                    "Writing inode tables: done                            \n" +
                    (fstype == "ext2" ? "" : "Creating journal (16384 blocks): done\n") +
                    "Writing superblocks and filesystem accounting information: done   \n\n");
            }
            else if (!string.IsNullOrEmpty(label) && label != label.ToUpperInvariant())
            {
                io.Err("mkfs.fat: Warning: lowercase labels might not work properly on some systems\n");
            }
            return 0;
        }
        if (ext && !string.IsNullOrEmpty(dev.Fstype) && !force)
        {
            ctx.Out($"{b.Path} contains a {dev.Fstype} file system{(!string.IsNullOrEmpty(dev.Label) ? $" labelled '{dev.Label}'" : "")}\n");
            sh.Ask("Proceed anyway? (y,N) ", false, (yes, io) => yes ? Finish(io) : 1);
            return 0;
        }
        return Finish(ctx);
    }

    private static readonly string[] ExtTypes = { "ext2", "ext3", "ext4" };

    private static Func<CmdCtx, int> MkfsExt(string? @fixed = null) => ctx =>
    {
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "Fqv", Values = "Ltb", Long = Long(("label", "L"), ("type", "t")) });
        if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
        var type = @fixed ?? o.Values.Get("t") ?? "ext2";
        if (!ExtTypes.Contains(type))
        {
            ctx.Err($"mke2fs: invalid fs type '{type}'\n");
            return 1;
        }
        return MakeFs(ctx, type, o.Operands.FirstOrDefault(), o.Values.Get("L"), o.Flags.Contains("F"));
    };

    private static int MkfsVfatRun(CmdCtx ctx)
    {
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "cIv", Values = "nFs" });
        if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
        var label = o.Values.Get("n");
        if (!string.IsNullOrEmpty(label) && label.Length > 11)
        {
            ctx.Err("mkfs.fat: Label can be no longer than 11 characters\n");
            return 1;
        }
        return MakeFs(ctx, "vfat", o.Operands.FirstOrDefault(), label, true);
    }

    private static CommandDef MkfsDef(string name, Func<CmdCtx, int> run) => new()
    {
        Name = name,
        Summary = "Skapar ett filsystem på en partition (formaterar)",
        SummaryEn = "Make a file system on a partition (format)",
        Man = MkfsMan,
        ManEn = MkfsManEn,
        Run = run,
    };

    private static readonly CommandDef Mkfs = MkfsDef("mkfs", ctx =>
    {
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "FqvV", Values = "tLn", Long = Long(("type", "t")) });
        if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
        var type = o.Values.Get("t") ?? "ext2";
        if (type == "vfat" || type == "fat" || type == "msdos")
        {
            return MakeFs(ctx, "vfat", o.Operands.FirstOrDefault(), o.Values.Get("n"), true);
        }
        if (ExtTypes.Contains(type)) return MakeFs(ctx, type, o.Operands.FirstOrDefault(), o.Values.Get("L"), o.Flags.Contains("F"));
        ctx.Err($"mkfs: failed to execute mkfs.{type}: No such file or directory\n");
        return 1;
    });

    public static List<CommandDef> All { get; } = new()
    {
        Df,
        Lsblk,
        Blkid,
        MountCmd,
        Umount,
        Findmnt,
        Fdisk,
        Swapon,
        Sync,
        Mkfs,
        MkfsDef("mkfs.ext4", MkfsExt("ext4")),
        MkfsDef("mke2fs", MkfsExt()),
        MkfsDef("mkfs.vfat", MkfsVfatRun),
        MkfsDef("mkfs.fat", MkfsVfatRun),
    };

    // ---------- Man pages ----------

    private const string DfMan = """
        NAMN
               df - visa ledigt och använt utrymme på filsystemen (disk free)

        SYNOPSIS
               df [FLAGGA]... [FIL]...

        BESKRIVNING
               Visar storlek, använt och ledigt utrymme för varje monterat
               filsystem. Med FIL visas bara filsystemet som filen ligger på.

               Kolumnen "Mounted on" är monteringspunkten: var i katalogträdet
               filsystemet syns. På ext4 reserveras 5 % åt root, därför blir
               Used + Avail lite mindre än Size.

        FLAGGOR
               -h, --human-readable   läsbara storlekar (1.6M, 49G)
               -T, --print-type       visa filsystemets typ (ext4, vfat, tmpfs ...)
               -t, --type=TYP         visa bara filsystem av typen TYP
               -x, --exclude-type=TYP visa inte filsystem av typen TYP
               -a, --all              visa även låtsasfilsystem som proc och sysfs

        EXEMPEL
               df -h                  allt, med läsbara storlekar
               df -hT                 med typen
               df -h ~                hur mycket plats finns där hemkatalogen ligger?
               df -h -x tmpfs         bara riktiga diskar
        """;

    private const string DfManEn = """
        NAME
               df - report file system disk space usage (disk free)

        SYNOPSIS
               df [OPTION]... [FILE]...

        DESCRIPTION
               Shows size, used and available space for every mounted file
               system. With FILE, only the file system that FILE is on is shown.

               The "Mounted on" column is the mount point: where in the directory
               tree the file system appears. ext4 reserves 5 % for root, so
               Used + Avail is a little less than Size.

        OPTIONS
               -h, --human-readable   human-readable sizes (1.6M, 49G)
               -T, --print-type       show the file system type (ext4, vfat, tmpfs ...)
               -t, --type=TYPE        only show file systems of type TYPE
               -x, --exclude-type=TYPE  do not show file systems of type TYPE
               -a, --all              also show pseudo file systems such as proc and sysfs

        EXAMPLES
               df -h                  everything, human-readable
               df -hT                 with the type
               df -h ~                how much space is there where my home is?
               df -h -x tmpfs         only real disks
        """;

    private const string LsblkMan = """
        NAMN
               lsblk - lista blockenheter: diskar och partitioner

        SYNOPSIS
               lsblk [FLAGGA]... [ENHET]...

        BESKRIVNING
               Visar diskarna som ett träd, med partitionerna under varje disk.
               RM = 1 betyder en löstagbar enhet (t.ex. en USB-sticka), TYPE är
               disk eller part, och MOUNTPOINTS visar var filsystemet är monterat
               ([SWAP] betyder att partitionen används som swap).

        FLAGGOR
               -f, --fs           visa filsystemen: typ, etikett, UUID och ledigt
               -o, --output LISTA välj kolumner, t.ex. NAME,SIZE,FSTYPE,MOUNTPOINTS
                                  (+UUID lägger till en kolumn till standardlistan)
               -d, --nodeps       bara diskarna, inte partitionerna
               -p, --paths        visa hela sökvägen (/dev/sda1)
               -l, --list         lista i stället för träd
               -n, --noheadings   ingen rubrikrad

        KOLUMNER
               NAME SIZE TYPE FSTYPE FSVER LABEL UUID PARTUUID MOUNTPOINTS
               FSSIZE FSUSED FSAVAIL FSUSE% MODEL TRAN RM RO MAJ:MIN PATH

        EXEMPEL
               lsblk
               lsblk -f
               lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINTS
               lsblk /dev/sdb
        """;

    private const string LsblkManEn = """
        NAME
               lsblk - list block devices: disks and partitions

        SYNOPSIS
               lsblk [OPTION]... [DEVICE]...

        DESCRIPTION
               Shows the disks as a tree, with the partitions under each disk.
               RM = 1 means a removable device (such as a USB stick), TYPE is
               disk or part, and MOUNTPOINTS shows where the file system is
               mounted ([SWAP] means the partition is used as swap).

        OPTIONS
               -f, --fs           show file systems: type, label, UUID and free space
               -o, --output LIST  choose columns, e.g. NAME,SIZE,FSTYPE,MOUNTPOINTS
                                  (+UUID adds a column to the default list)
               -d, --nodeps       only the disks, not the partitions
               -p, --paths        print full paths (/dev/sda1)
               -l, --list         list instead of tree
               -n, --noheadings   no header line

        COLUMNS
               NAME SIZE TYPE FSTYPE FSVER LABEL UUID PARTUUID MOUNTPOINTS
               FSSIZE FSUSED FSAVAIL FSUSE% MODEL TRAN RM RO MAJ:MIN PATH

        EXAMPLES
               lsblk
               lsblk -f
               lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINTS
               lsblk /dev/sdb
        """;

    private const string BlkidMan = """
        NAMN
               blkid - visa attribut för blockenheter (typ, etikett, UUID)

        SYNOPSIS
               blkid [FLAGGA]... [ENHET]...
               blkid -L ETIKETT | -U UUID

        BESKRIVNING
               Visar vilket filsystem som finns på varje partition: TYPE (ext4,
               vfat, btrfs, swap ...), LABEL (etiketten) och UUID – ett unikt id
               som skapas när filsystemet skapas. UUID används i /etc/fstab
               eftersom det inte ändras om diskarna byter namn (sda/sdb).

        FLAGGOR
               -s TAGG          visa bara taggen TAGG (t.ex. UUID eller TYPE)
               -o FORMAT        value (bara värdet), full, export eller device
               -L ETIKETT       vilken enhet har etiketten?
               -U UUID          vilken enhet har detta UUID?

        EXEMPEL
               blkid
               blkid /dev/sdb1
               blkid -s UUID -o value /dev/sdb1
               blkid -L USBSTICK
        """;

    private const string BlkidManEn = """
        NAME
               blkid - locate/print block device attributes (type, label, UUID)

        SYNOPSIS
               blkid [OPTION]... [DEVICE]...
               blkid -L LABEL | -U UUID

        DESCRIPTION
               Shows which file system is on each partition: TYPE (ext4, vfat,
               btrfs, swap ...), LABEL and UUID – a unique id created together
               with the file system. /etc/fstab uses the UUID because it does not
               change if the disks get new names (sda/sdb).

        OPTIONS
               -s TAG           only show the tag TAG (e.g. UUID or TYPE)
               -o FORMAT        value (just the value), full, export or device
               -L LABEL         which device has this label?
               -U UUID          which device has this UUID?

        EXAMPLES
               blkid
               blkid /dev/sdb1
               blkid -s UUID -o value /dev/sdb1
               blkid -L USBSTICK
        """;

    private const string MountMan = """
        NAMN
               mount - montera ett filsystem

        SYNOPSIS
               mount
               mount [-t TYP] [-o FLAGGOR] ENHET KATALOG
               mount KATALOG | ENHET
               mount -a

        BESKRIVNING
               I Linux finns bara ett katalogträd, som börjar i /. Att montera
               betyder att filsystemet på en enhet (en partition, en USB-sticka)
               kopplas in i trädet på en katalog – monteringspunkten. Efteråt
               syns filerna på enheten i den katalogen. Det som låg i katalogen
               innan döljs tills filsystemet avmonteras med umount.

               Utan argument listas allt som är monterat. Att montera kräver
               root (sudo). ENHET kan vara /dev/sdb1, LABEL=ETIKETT eller
               UUID=... Anges bara KATALOG eller ENHET hämtas resten från
               /etc/fstab.

        FLAGGOR
               -t TYP       filsystemets typ (ext4, vfat, tmpfs ...). Behövs
                            sällan – mount känner igen typen själv.
               -o FLAGGOR   kommaseparerade monteringsflaggor, t.ex.
                            ro (skrivskyddat), uid=1000,gid=1000 (vem som äger
                            filerna på FAT), noexec, size=100M (tmpfs)
               -a           montera allt i /etc/fstab som inte redan är monterat
               -l           visa etiketter när allt listas
               -v           berätta vad som händer

        EXEMPEL
               mount                              lista monterade filsystem
               mount -t vfat                      bara FAT-filsystem
               sudo mkdir -p /mnt/usb
               sudo mount /dev/sdb1 /mnt/usb      montera USB-stickan
               sudo mount -o uid=1000,gid=1000 /dev/sdb1 /mnt/usb
               sudo mount -t tmpfs tmpfs /mnt/ram  ett filsystem i RAM-minnet
        """;

    private const string MountManEn = """
        NAME
               mount - mount a file system

        SYNOPSIS
               mount
               mount [-t TYPE] [-o OPTIONS] DEVICE DIRECTORY
               mount DIRECTORY | DEVICE
               mount -a

        DESCRIPTION
               Linux has only one directory tree, starting at /. Mounting means
               attaching the file system on a device (a partition, a USB stick)
               to the tree at a directory – the mount point. Afterwards the files
               on the device appear in that directory. Whatever was in the
               directory before is hidden until the file system is unmounted
               with umount.

               Without arguments, everything that is mounted is listed. Mounting
               requires root (sudo). DEVICE can be /dev/sdb1, LABEL=LABEL or
               UUID=... If only DIRECTORY or DEVICE is given, the rest is taken
               from /etc/fstab.

        OPTIONS
               -t TYPE      file system type (ext4, vfat, tmpfs ...). Rarely
                            needed – mount detects the type itself.
               -o OPTIONS   comma-separated mount options, e.g. ro (read-only),
                            uid=1000,gid=1000 (who owns the files on FAT),
                            noexec, size=100M (tmpfs)
               -a           mount everything in /etc/fstab that is not mounted yet
               -l           show labels when listing
               -v           verbose

        EXAMPLES
               mount                              list mounted file systems
               mount -t vfat                      only FAT file systems
               sudo mkdir -p /mnt/usb
               sudo mount /dev/sdb1 /mnt/usb      mount the USB stick
               sudo mount -o uid=1000,gid=1000 /dev/sdb1 /mnt/usb
               sudo mount -t tmpfs tmpfs /mnt/ram  a file system in RAM
        """;

    private const string UmountMan = """
        NAMN
               umount - avmontera ett filsystem

        SYNOPSIS
               umount KATALOG | ENHET

        BESKRIVNING
               Kopplar bort filsystemet från katalogträdet. Allt som ännu inte
               skrivits till enheten skrivs först, så att inget går förlorat.
               Avmontera alltid en USB-sticka innan du drar ut den!

               Notera stavningen: umount, utan n.

               Om något använder filsystemet – till exempel om ditt skal står i
               katalogen – vägrar umount med "target is busy". Gå då därifrån
               (cd ~) och försök igen.

        FLAGGOR
               -v           berätta vad som händer

        EXEMPEL
               sudo umount /mnt/usb
               sudo umount /dev/sdb1
        """;

    private const string UmountManEn = """
        NAME
               umount - unmount a file system

        SYNOPSIS
               umount DIRECTORY | DEVICE

        DESCRIPTION
               Detaches the file system from the directory tree. Everything that
               has not been written to the device yet is written first, so that
               nothing is lost. Always unmount a USB stick before unplugging it!

               Note the spelling: umount, without an n.

               If something is using the file system – for example if your shell
               is in the directory – umount refuses with "target is busy". Leave
               the directory (cd ~) and try again.

        OPTIONS
               -v           verbose

        EXAMPLES
               sudo umount /mnt/usb
               sudo umount /dev/sdb1
        """;

    private const string FindmntMan = """
        NAMN
               findmnt - hitta och visa monterade filsystem

        SYNOPSIS
               findmnt [FLAGGA]... [KATALOG | ENHET]

        BESKRIVNING
               Visar allt som är monterat som ett träd: varje filsystem under
               det som det är monterat i. Med en KATALOG eller ENHET visas bara
               den monteringen.

        FLAGGOR
               -l, --list         lista i stället för träd
               -n, --noheadings   ingen rubrikrad
               -t, --types TYP    bara filsystem av typen TYP (t.ex. ext4,vfat)
               -T, --target FIL   filsystemet som FIL ligger på
               -o, --output LISTA kolumner: TARGET,SOURCE,FSTYPE,OPTIONS,UUID,
                                  LABEL,SIZE,USED,AVAIL,USE%

        EXEMPEL
               findmnt
               findmnt /
               findmnt -t ext4,btrfs,vfat
               findmnt -n -o UUID /
        """;

    private const string FindmntManEn = """
        NAME
               findmnt - find and show mounted file systems

        SYNOPSIS
               findmnt [OPTION]... [DIRECTORY | DEVICE]

        DESCRIPTION
               Shows everything that is mounted as a tree: each file system below
               the one it is mounted in. With a DIRECTORY or DEVICE, only that
               mount is shown.

        OPTIONS
               -l, --list         list instead of tree
               -n, --noheadings   no header line
               -t, --types TYPE   only file systems of type TYPE (e.g. ext4,vfat)
               -T, --target FILE  the file system that FILE is on
               -o, --output LIST  columns: TARGET,SOURCE,FSTYPE,OPTIONS,UUID,
                                  LABEL,SIZE,USED,AVAIL,USE%

        EXAMPLES
               findmnt
               findmnt /
               findmnt -t ext4,btrfs,vfat
               findmnt -n -o UUID /
        """;

    private const string FdiskMan = """
        NAMN
               fdisk - visa och ändra partitionstabellen på en disk

        SYNOPSIS
               fdisk -l [DISK]...
               fdisk DISK

        BESKRIVNING
               En disk delas in i partitioner. Partitionstabellen (GPT eller den
               äldre MBR/dos) beskriver var varje partition börjar och slutar.
               fdisk -l visar tabellen. Kräver root.

               VARNING: fdisk DISK ändrar partitionstabellen. Ett misstag på ett
               riktigt system kan göra att allt på disken blir oläsbart. Kontrollera
               alltid med lsblk att du har rätt disk – och ha en backup. I
               simulatorn går det bara att lista (-l).

        FLAGGOR
               -l, --list   lista partitionstabellerna

        EXEMPEL
               sudo fdisk -l
               sudo fdisk -l /dev/sdb
        """;

    private const string FdiskManEn = """
        NAME
               fdisk - show and change the partition table of a disk

        SYNOPSIS
               fdisk -l [DISK]...
               fdisk DISK

        DESCRIPTION
               A disk is divided into partitions. The partition table (GPT or the
               older MBR/dos) describes where each partition starts and ends.
               fdisk -l shows the table. Requires root.

               WARNING: fdisk DISK changes the partition table. A mistake on a
               real system can make everything on the disk unreadable. Always
               check with lsblk that you have the right disk – and have a backup.
               The simulator can only list (-l).

        OPTIONS
               -l, --list   list the partition tables

        EXAMPLES
               sudo fdisk -l
               sudo fdisk -l /dev/sdb
        """;

    private const string SwaponMan = """
        NAMN
               swapon - visa och slå på swap

        SYNOPSIS
               swapon [--show]

        BESKRIVNING
               Swap är utrymme som används när RAM-minnet tar slut: sidor av minnet
               som inte används just nu flyttas dit. Swap kan vara en partition,
               en fil eller – som i Fedora – komprimerat RAM (zram).

               Utan argument, eller med --show, visas swap som används.

        EXEMPEL
               swapon --show
               free -h
        """;

    private const string SwaponManEn = """
        NAME
               swapon - show and enable swap

        SYNOPSIS
               swapon [--show]

        DESCRIPTION
               Swap is space used when RAM runs out: pages of memory that are not
               used right now are moved there. Swap can be a partition, a file or
               – as in Fedora – compressed RAM (zram).

               Without arguments, or with --show, the swap in use is shown.

        EXAMPLES
               swapon --show
               free -h
        """;

    private const string SyncMan = """
        NAMN
               sync - skriv cachat innehåll till diskarna

        SYNOPSIS
               sync

        BESKRIVNING
               Linux väntar ofta med att skriva till disken och samlar ändringarna
               i RAM-minnet (cache), eftersom det går mycket snabbare. sync tvingar
               fram skrivningen direkt. umount gör samma sak innan den kopplar
               bort ett filsystem.
        """;

    private const string SyncManEn = """
        NAME
               sync - write cached data to the disks

        SYNOPSIS
               sync

        DESCRIPTION
               Linux often delays writing to disk and collects the changes in RAM
               (cache), because that is much faster. sync forces the write right
               away. umount does the same thing before detaching a file system.
        """;

    private const string MkfsMan = """
        NAMN
               mkfs.ext4, mkfs.vfat - skapa ett filsystem (formatera)

        SYNOPSIS
               mkfs.ext4 [-L ETIKETT] PARTITION
               mkfs.vfat [-n ETIKETT] PARTITION
               mkfs -t TYP PARTITION

        BESKRIVNING
               Skapar ett nytt, tomt filsystem på en partition. ALLT som fanns på
               partitionen försvinner. Partitionen får ett nytt UUID.

               VARNING: på ett riktigt system är det här ett av de farligaste
               kommandona som finns. Kontrollera alltid med lsblk -f att du har
               rätt enhet (sdb är inte alltid USB-stickan!) och att partitionen
               inte är monterad.

               ext4 är standard i Linux. vfat (FAT32) fungerar i Windows, macOS
               och nästan alla andra prylar, men har inga Linux-rättigheter och
               klarar inte filer större än 4 GiB.

        FLAGGOR
               -L ETIKETT   etikett för ext4 (mkfs.ext4)
               -n ETIKETT   etikett för FAT, högst 11 tecken (mkfs.vfat)
               -F           (mkfs.ext4) fråga inte, även om det finns ett filsystem
               -t TYP       (mkfs) ext2, ext3, ext4 eller vfat

        EXEMPEL
               sudo umount /mnt/usb
               sudo mkfs.ext4 -L BACKUP /dev/sdb1
               sudo mkfs.vfat -n USBSTICK /dev/sdb1
        """;

    private const string MkfsManEn = """
        NAME
               mkfs.ext4, mkfs.vfat - make a file system (format)

        SYNOPSIS
               mkfs.ext4 [-L LABEL] PARTITION
               mkfs.vfat [-n LABEL] PARTITION
               mkfs -t TYPE PARTITION

        DESCRIPTION
               Creates a new, empty file system on a partition. EVERYTHING that was
               on the partition is lost. The partition gets a new UUID.

               WARNING: on a real system this is one of the most dangerous commands
               there is. Always check with lsblk -f that you have the right device
               (sdb is not always the USB stick!) and that the partition is not
               mounted.

               ext4 is the Linux standard. vfat (FAT32) works in Windows, macOS
               and almost every other gadget, but has no Linux permissions and
               cannot store files larger than 4 GiB.

        OPTIONS
               -L LABEL     label for ext4 (mkfs.ext4)
               -n LABEL     label for FAT, at most 11 characters (mkfs.vfat)
               -F           (mkfs.ext4) do not ask, even if there is a file system
               -t TYPE      (mkfs) ext2, ext3, ext4 or vfat

        EXAMPLES
               sudo umount /mnt/usb
               sudo mkfs.ext4 -L BACKUP /dev/sdb1
               sudo mkfs.vfat -n USBSTICK /dev/sdb1
        """;

}
