namespace Codestead.Shell.Commands;

// The fdisk command: show and change partition tables.

public static partial class DisksCmd
{
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
}
