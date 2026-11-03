namespace Codestead.Shell.Commands;

// The mkfs.ext4, mke2fs, mkfs.vfat, mkfs.fat and mkfs commands.

public static partial class DisksCmd
{
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
