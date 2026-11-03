namespace Codestead.Shell.Commands;

// The df command: show free and used space on file systems.

public static partial class DisksCmd
{
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
}
