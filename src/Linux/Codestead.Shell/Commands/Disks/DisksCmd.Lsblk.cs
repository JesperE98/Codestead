namespace Codestead.Shell.Commands;

// The lsblk command: list disks and partitions (block devices).

public static partial class DisksCmd
{
    private sealed class LsblkRow
    {
        public Block Block { get; init; } = null!;
        public string Prefix { get; init; } = "";
    }

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
}
