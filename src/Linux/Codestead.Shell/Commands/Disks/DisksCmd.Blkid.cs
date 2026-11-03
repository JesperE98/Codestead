namespace Codestead.Shell.Commands;

// The blkid command: show the type, label and UUID of file systems.

public static partial class DisksCmd
{
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
}
