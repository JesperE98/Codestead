namespace Codestead.Content;

// The chapter "diskar" (part "admin"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Diskar() =>
        new()
        {
            Id = "diskar",
            Part = "admin",
            Title = "Diskar och filsystem",
            Tasks = new()
            {
                new()
                {
                    Id = "df",
                    Text = "Visa hur mycket plats som är använd och ledig på de monterade filsystemen – med läsbara storlekar (G, M).",
                    Hint = "`df` visar filsystemen, flaggan `-h` gör storlekarna läsbara: `df -h`.",
                    Solution = Cmds("df -h"),
                    Check = c => Ran(c, Re(@"^df\b")) && Re(@"\s-\w*h|--human").IsMatch(c.Line) && c.Output.Contains("Mounted on"),
                },
                new()
                {
                    Id = "lsblk-f",
                    Text = "Visa alla diskar och partitioner tillsammans med filsystemens typ, etikett och UUID.",
                    Hint = "`lsblk` visar diskarna som ett träd. Med `-f` kommer filsystemen med: `lsblk -f`.",
                    Solution = Cmds("lsblk -f"),
                    Check = c => Ran(c, Re(@"^lsblk\b")) && c.Output.Contains("FSTYPE") && c.Output.Contains("USBSTICK"),
                },
                new()
                {
                    Id = "fstab",
                    Text = "Visa filen `/etc/fstab`, som talar om vad som ska monteras när datorn startar.",
                    Solution = Cmds("cat /etc/fstab"),
                    Check = c => Ran(c, Re(@"\/etc\/fstab")) && c.Output.Contains("UUID="),
                },
                new()
                {
                    Id = "uuid",
                    Text = "Ta reda på UUID för filsystemet som är monterat på `/` – och bara det.",
                    Hint = "`lsblk -f` visar att `/` ligger på `/dev/sda2`. Fråga sedan `blkid /dev/sda2` – eller låt `findmnt -n -o UUID /` göra allt på en gång.",
                    Solution = Cmds("blkid /dev/sda2"),
                    Check = c => c.ExitCode == 0 && OutLines(c).Count <= 2 && c.Output.Contains(DisksLib.RootUuid(c.Distro)),
                },
                new()
                {
                    Id = "montera",
                    Text = "Skapa monteringspunkten `/mnt/usb` och montera USB-stickan (`/dev/sdb1`) där.",
                    Hint = "Både att skapa kataloger i `/mnt` och att montera kräver root: `sudo mkdir -p /mnt/usb` och sedan `sudo mount /dev/sdb1 /mnt/usb`.",
                    Solution = Cmds("sudo mkdir -p /mnt/usb", "sudo mount /dev/sdb1 /mnt/usb"),
                    Check = c => c.Sh.Disks.Mounts.Any(m => m.Dev == DisksLib.UsbPart && m.Target == "/mnt/usb"),
                },
                new()
                {
                    Id = "fran-usb",
                    Text = "Kopiera `{{report}}` från USB-stickan till din hemkatalog.",
                    Hint = "Stickans filer finns nu i `/mnt/usb`: `cp /mnt/usb/{{report}} ~`.",
                    Solution = Cmds("cp /mnt/usb/{{report}} ~"),
                    Check = c => Content(c, "~/{{report}}").StartsWith("%PDF", StringComparison.Ordinal),
                },
                new()
                {
                    Id = "till-usb",
                    Text = "Spara en kopia av `~/{{documents}}/{{fruits}}` på USB-stickan.",
                    Hint = "Filerna på stickan ägs av root – FAT har inga Linux-rättigheter – så du behöver `sudo`: `sudo cp ~/{{documents}}/{{fruits}} /mnt/usb/`.",
                    Solution = Cmds("sudo cp ~/{{documents}}/{{fruits}} /mnt/usb/"),
                    Check = c => DisksLib.PartitionRoot(c.Sh.Vfs, c.Sh.Disks, DisksLib.UsbPart, c.Sh.RootUser())?.Children?.Get(W(c)["fruits"]) is not null,
                },
                new()
                {
                    Id = "avmontera",
                    Text = "Avmontera USB-stickan, så att den är säker att dra ut.",
                    Hint = "`sudo umount /mnt/usb` – utan n! Får du *target is busy* står ditt skal i katalogen: gå därifrån med `cd ~` först.",
                    Solution = Cmds("cd ~", "sudo umount /mnt/usb"),
                    Check = c => Ran(c, Re(@"\bumount\b")) && !c.Sh.Disks.Mounts.Any(m => m.Dev == DisksLib.UsbPart),
                },
            },
        };
}
