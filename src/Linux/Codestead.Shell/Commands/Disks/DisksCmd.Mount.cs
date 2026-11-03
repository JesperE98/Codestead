namespace Codestead.Shell.Commands;

// The mount command: mount a file system into the directory tree.

public static partial class DisksCmd
{
    private static string UserFromSpec(Shell sh, string spec)
    {
        if (spec == "0" || spec == "root") return "root";
        if (spec == "1000" || spec == sh.World.User) return sh.World.User;
        return spec;
    }

    private static string UidOf(Shell sh, string name) => name == "root" ? "0" : name == sh.World.User ? "1000" : name;

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
}
