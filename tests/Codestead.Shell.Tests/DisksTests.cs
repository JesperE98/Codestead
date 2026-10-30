using System.Globalization;
using System.Text.RegularExpressions;
using System.Text.Json.Nodes;
using Codestead.Shell.Commands;

namespace Codestead.Shell.Tests;

// Port of src/shell/disks.test.ts
public class DisksTests
{
    private static Mount? UsbMounted(TestShell t) => t.Sh.Disks.Mounts.FirstOrDefault(m => m.Dev == DisksLib.UsbPart);

    private static Regex M(string pattern) => new(pattern, RegexOptions.Multiline | RegexOptions.CultureInvariant);

    // ---------- lsblk och blkid ----------

    [Fact(DisplayName = "lsblk visar systemdisken och den omonterade USB-stickan som ett träd")]
    public void LsblkTree()
    {
        var t = new TestShell();
        var @out = t.Run("lsblk").Out;
        Assert.Equal("NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS", @out.Split('\n')[0]);
        Assert.Contains("├─sda1   8:1    0    1G  0 part /boot/efi", @out);
        Assert.Contains("├─sda2   8:2    0   61G  0 part /", @out);
        Assert.Contains("└─sda3   8:3    0    2G  0 part [SWAP]", @out);
        Assert.Contains("sdb      8:16   1 14.9G  0 disk", @out);
        Assert.Matches(@"└─sdb1 +8:17 +1 14\.9G +0 part\n", @out);
    }

    [Fact(DisplayName = "lsblk -f visar typ, etikett och UUID")]
    public void LsblkFs()
    {
        var t = new TestShell();
        var @out = t.Run("lsblk -f").Out;
        Assert.Matches(@"^NAME +FSTYPE FSVER LABEL +UUID +FSAVAIL FSUSE% MOUNTPOINTS", @out);
        Assert.Matches(@"sdb1 vfat +FAT32 USBMINNE 7E21-9A4F\n", @out);
        Assert.Contains(DisksLib.RootUuid(DistrosLib.GetDistro("ubuntu")), @out);
    }

    [Fact(DisplayName = "lsblk -o, -d, -p och okända kolumner")]
    public void LsblkOptions()
    {
        var t = new TestShell();
        Assert.Equal("NAME  SIZE RM\nsda    64G  0\nsdb  14.9G  1\n", t.Run("lsblk -d -o NAME,SIZE,RM").Out);
        Assert.Equal("/dev/sdb\n└─/dev/sdb1\n", t.Run("lsblk -p -n -o NAME /dev/sdb").Out);
        var bad = t.Run("lsblk -o NAME,KAKA");
        Assert.Equal(1, bad.ExitCode);
        Assert.Contains("unknown column: KAKA", bad.Out);
    }

    [Fact(DisplayName = "Fedora: btrfs på både / och /home, och swap i zram")]
    public void FedoraBtrfsZram()
    {
        var t = new TestShell("fedora");
        var @out = t.Run("lsblk").Out;
        Assert.Matches(@"└─sda3 .* part /home\n +/\n", @out);
        Assert.Contains("zram0  251:0    0    2G  0 disk [SWAP]", @out);
        Assert.Contains("/dev/zram0 partition   2G   0B  100", t.Run("swapon --show").Out);
        Assert.Contains("/dev/sda3[/home] btrfs", t.Run("findmnt /home").Out);
    }

    [Fact(DisplayName = "blkid med -s, -o value, -L och -U")]
    public void Blkid()
    {
        var t = new TestShell("arch");
        Assert.Equal($"{DisksLib.UsbUuid}\n", t.Run("blkid -s UUID -o value /dev/sdb1").Out);
        Assert.Equal(
            $"/dev/sdb1: LABEL=\"USBMINNE\" UUID=\"{DisksLib.UsbUuid}\" BLOCK_SIZE=\"512\" TYPE=\"vfat\" PARTUUID=\"5d3a1c7e-01\"\n",
            t.Run("blkid /dev/sdb1").Out);
        Assert.Equal("/dev/sdb1\n", t.Run("blkid -L USBMINNE").Out);
        Assert.Equal("/dev/sda3\n", t.Run($"blkid -U {DisksLib.RootUuid(DistrosLib.GetDistro("arch"))}").Out);
        Assert.Equal(2, t.Run("blkid -L FINNSINTE").ExitCode);
    }

    public static IEnumerable<object[]> DistroIds() => DistrosLib.Distros.Select(d => new object[] { d.Id });

    [Theory(DisplayName = "alla UUID i /etc/fstab finns på diskarna")]
    [MemberData(nameof(DistroIds))]
    public void FstabUuidsExist(string id)
    {
        var t = new TestShell(id);
        var fstab = t.Run("cat /etc/fstab").Out;
        Assert.Equal(DisksLib.FstabFor(DistrosLib.GetDistro(id)), fstab);
        var uuids = M(@"^UUID=(\S+)").Matches(fstab).Select(m => m.Groups[1].Value).ToList();
        Assert.True(uuids.Count >= 2);
        var blkid = t.Run("blkid").Out;
        foreach (var u in uuids) Assert.Contains($"UUID=\"{u}\"", blkid);
        Assert.Equal($"{DisksLib.RootUuid(DistrosLib.GetDistro(id))}\n", t.Run("findmnt -n -o UUID /").Out);
    }

    // ---------- df ----------

    [Fact(DisplayName = "df -h visar monterade filsystem, även tmpfs, men inte proc")]
    public void DfHuman()
    {
        var t = new TestShell();
        var @out = t.Run("df -h").Out;
        Assert.Equal("Filesystem      Size  Used Avail Use% Mounted on", @out.Split('\n')[0]);
        Assert.Matches(M(@"^/dev/sda2 +60G +\S+ +\S+ +\d+% /$"), @out);
        Assert.Matches(M(@"^tmpfs .* /run$"), @out);
        Assert.DoesNotContain("/proc", @out);
    }

    [Fact(DisplayName = "df -T, -x och en sökväg")]
    public void DfTypeExcludePath()
    {
        var t = new TestShell("debian");
        Assert.Matches(M(@"^/dev/sda1 +vfat "), t.Run("df -hT").Out);
        // Debian 13 has /tmp in RAM.
        Assert.Matches(M(@"^tmpfs .* /tmp$"), t.Run("df /tmp").Out);
        var real = t.Run("df -x tmpfs -x devtmpfs").Out;
        Assert.DoesNotContain("tmpfs", real);
        Assert.Equal(3, real.Trim().Split('\n').Length);
        Assert.Matches(@"/dev/sda2 .* /\n\z", t.Run("df ~").Out);
        var missing = t.Run("df /finns/inte");
        Assert.Equal(1, missing.ExitCode);
        Assert.Contains("df: /finns/inte: No such file or directory", missing.Out);
    }

    [Fact(DisplayName = "stora filer syns i df")]
    public void BigFilesShowInDf()
    {
        var t = new TestShell();
        long Used() => long.Parse(Regex.Match(t.Run("df").Out, @"/dev/sda2 +[0-9]+ +([0-9]+)").Groups[1].Value, CultureInfo.InvariantCulture);
        var before = Used();
        t.Run("head -c 0 /dev/null > ~/stor.bin");
        t.Sh.Vfs.Lookup("/home/elev/stor.bin", t.Sh.RootUser()).Size = 50 * 1024 * 1024;
        Assert.Equal(50 * 1024, Used() - before);
    }

    // ---------- mount och umount ----------

    [Fact(DisplayName = "montera kräver root och en befintlig monteringspunkt")]
    public void MountRequiresRootAndMountPoint()
    {
        var t = new TestShell();
        var r = t.Run("mount /dev/sdb1 /mnt/usb");
        Assert.Equal(1, r.ExitCode);
        Assert.Contains("mount: /mnt/usb: must be superuser to use mount.", r.Out);
        r = t.Run("sudo mount /dev/sdb1 /mnt/usb");
        Assert.Equal(32, r.ExitCode);
        Assert.Contains("mount: /mnt/usb: mount point does not exist.", r.Out);
        t.Run("sudo mkdir /mnt/usb");
        r = t.Run("sudo mount /dev/sdb /mnt/usb");
        Assert.Contains("wrong fs type, bad option, bad superblock on /dev/sdb", r.Out);
        Assert.Contains("prova /dev/sdb1", r.Out);
        r = t.Run("sudo mount /dev/sdc1 /mnt/usb");
        Assert.Contains("special device /dev/sdc1 does not exist", r.Out);
        Assert.Contains("unknown filesystem type 'swap'", t.Run("sudo mount /dev/sda3 /mnt/usb").Out);
        Assert.Contains("/dev/sda1 already mounted on /boot/efi.", t.Run("sudo mount /dev/sda1 /mnt/usb").Out);
        Assert.Contains("wrong fs type", t.Run("sudo mount -t ext4 /dev/sdb1 /mnt/usb").Out);
        Assert.Null(UsbMounted(t));
    }

    [Fact(DisplayName = "filerna dyker upp vid mount och försvinner vid umount – ändringar sparas på stickan")]
    public void MountShowsFilesAndUmountSavesThem()
    {
        var t = new TestShell();
        t.Run("sudo mkdir -p /mnt/usb");
        t.Run("sudo touch /mnt/usb/gömd.txt");
        Assert.Equal(0, t.Run("sudo mount /dev/sdb1 /mnt/usb").ExitCode);
        Assert.Equal("/mnt/usb", UsbMounted(t)?.Target);
        Assert.Equal("att-gora.txt\nrapport.pdf\nsemester.jpg\n", t.Run("ls -1 /mnt/usb").Out);
        // What was in the directory before is hidden.
        Assert.Null(t.Node("/mnt/usb/gömd.txt"));

        // FAT: everything is owned by whoever mounted it, and ordinary users may not write.
        Assert.Equal("root", t.Node("/mnt/usb/rapport.pdf")?.Owner);
        Assert.Equal(1, t.Run("cp ~/dokument/frukter.txt /mnt/usb/").ExitCode);
        Assert.Equal(0, t.Run("sudo cp ~/dokument/frukter.txt /mnt/usb/").ExitCode);
        Assert.Equal(0, t.Run("cp /mnt/usb/rapport.pdf ~").ExitCode);
        Assert.Contains("%PDF", t.Node("~/rapport.pdf")?.Content);
        Assert.Contains("/dev/sdb1 /mnt/usb vfat rw,relatime,fmask=0022", t.Run("cat /proc/mounts").Out);

        Assert.Equal(0, t.Run("sudo umount /mnt/usb").ExitCode);
        Assert.Null(UsbMounted(t));
        Assert.Equal("gömd.txt\n", t.Run("ls -1 /mnt/usb").Out);
        Assert.DoesNotContain("sdb1", t.Run("cat /proc/mounts").Out);

        // Mounted again – with the label and owned by elev.
        Assert.Equal(0, t.Run("sudo mount -o uid=1000,gid=1000 LABEL=USBMINNE /mnt/usb").ExitCode);
        Assert.Equal("att-gora.txt\nfrukter.txt\nrapport.pdf\nsemester.jpg\n", t.Run("ls -1 /mnt/usb").Out);
        Assert.Equal("elev", t.Node("/mnt/usb/frukter.txt")?.Owner);
        Assert.Equal(0, t.Run("touch /mnt/usb/egen.txt").ExitCode);
        Assert.Contains("/dev/sdb1 on /mnt/usb type vfat (rw,relatime,uid=1000,gid=1000,", t.Run("mount -t vfat").Out);
        Assert.Equal("umount: /mnt/usb unmounted\n", t.Run("sudo umount -v /dev/sdb1").Out);
    }

    [Fact(DisplayName = "umount: target is busy, not mounted och systemets filsystem")]
    public void UmountBusyNotMountedSystem()
    {
        var t = new TestShell();
        t.Run("sudo mkdir -p /mnt/usb && sudo mount /dev/sdb1 /mnt/usb");
        t.Run("cd /mnt/usb");
        var r = t.Run("sudo umount /mnt/usb");
        Assert.Equal(32, r.ExitCode);
        Assert.Contains("umount: /mnt/usb: target is busy.", r.Out);
        Assert.NotNull(UsbMounted(t));
        r = t.Run("umount /mnt/usb");
        Assert.Contains("must be superuser to use umount", r.Out);
        t.Run("cd ~");
        Assert.Equal(0, t.Run("sudo umount /mnt/usb").ExitCode);
        Assert.Contains("umount: /mnt/usb: not mounted.", t.Run("sudo umount /mnt/usb").Out);
        Assert.Contains("no mount point specified", t.Run("sudo umount /mnt/finnsinte").Out);
        Assert.Contains("umount: /: target is busy.", t.Run("sudo umount /").Out);
        Assert.Equal(32, t.Run("sudo umount /boot/efi").ExitCode);
    }

    [Fact(DisplayName = "samma partition kan inte monteras två gånger, och en upptagen monteringspunkt vägras")]
    public void NoDoubleMount()
    {
        var t = new TestShell();
        t.Run("sudo mkdir -p /mnt/usb /mnt/b");
        t.Run("sudo mount /dev/sdb1 /mnt/usb");
        Assert.Contains("/dev/sdb1 already mounted on /mnt/usb.", t.Run("sudo mount /dev/sdb1 /mnt/b").Out);
        Assert.Contains("already mounted or mount point busy", t.Run("sudo mount -t tmpfs tmpfs /mnt/usb").Out);
    }

    [Fact(DisplayName = "mount utan argument och findmnt")]
    public void MountListAndFindmnt()
    {
        var t = new TestShell("arch");
        var list = t.Run("mount").Out;
        Assert.Contains("/dev/sda3 on / type ext4 (rw,relatime)", list);
        Assert.Contains("/dev/sda1 on /boot type vfat", list);
        Assert.Contains("proc on /proc type proc", list);
        var tree = t.Run("findmnt").Out;
        Assert.Matches(@"^TARGET +SOURCE +FSTYPE +OPTIONS\z", tree.Split('\n')[0]);
        Assert.Matches(M(@"^/ +/dev/sda3 +ext4"), tree);
        Assert.Matches(M(@"^├─/proc +proc +proc"), tree);
        Assert.Matches(M(@"^│ └─/dev/shm +tmpfs"), tree);
        Assert.Equal("/boot vfat\n", t.Run("findmnt -n -o TARGET,FSTYPE -t vfat").Out);
        Assert.Equal(1, t.Run("findmnt /mnt").ExitCode);
    }

    [Fact(DisplayName = "tmpfs finns bara i RAM-minnet")]
    public void TmpfsOnlyInRam()
    {
        var t = new TestShell();
        t.Run("sudo mkdir /mnt/ram");
        Assert.Equal(0, t.Run("sudo mount -t tmpfs -o size=100M tmpfs /mnt/ram").ExitCode);
        Assert.Matches(M(@"^tmpfs +100M .* /mnt/ram$"), t.Run("df -h /mnt/ram").Out);
        t.Run("echo hej > /mnt/ram/fil.txt");
        Assert.Equal("hej\n", t.Node("/mnt/ram/fil.txt")?.Content);
        Assert.Equal(0, t.Run("sudo umount /mnt/ram").ExitCode);
        Assert.Null(t.Node("/mnt/ram/fil.txt"));
    }

    [Fact(DisplayName = "/etc/fstab: mount -a och en rad med user")]
    public void FstabMountAllAndUser()
    {
        var t = new TestShell("fedora");
        t.Run("sudo mkdir -p /mnt/usb");
        t.Run("echo 'LABEL=USBMINNE /mnt/usb vfat noauto,user,uid=1000,gid=1000 0 0' | sudo tee -a /etc/fstab");
        // noauto: mount -a skips it, and everything else is already mounted.
        Assert.Equal(0, t.Run("sudo mount -a").ExitCode);
        Assert.Null(UsbMounted(t));
        // user: ordinary users may mount it.
        Assert.Equal(0, t.Run("mount /mnt/usb").ExitCode);
        Assert.Equal("/mnt/usb", UsbMounted(t)?.Target);
        Assert.Equal(0, t.Run("touch /mnt/usb/egen.txt").ExitCode);
        t.Run("sudo umount /mnt/usb");
        t.Run("sudo sed -i 's/noauto,//' /etc/fstab");
        Assert.Equal(0, t.Run("sudo mount -a").ExitCode);
        Assert.Equal("/mnt/usb", UsbMounted(t)?.Target);
        Assert.Contains("can't find in /etc/fstab", t.Run("sudo mount /mnt/finnsinte").Out);
    }

    // ---------- fdisk, swapon och mkfs ----------

    [Fact(DisplayName = "fdisk -l kräver root och visar partitionstabellerna")]
    public void FdiskList()
    {
        var t = new TestShell();
        Assert.Contains("fdisk: cannot open /dev/sda: Permission denied", t.Run("fdisk -l").Out);
        var @out = t.Run("sudo fdisk -l").Out;
        Assert.Contains("Disk /dev/sda: 64 GiB, 68719476736 bytes, 134217728 sectors", @out);
        Assert.Contains("Disklabel type: gpt", @out);
        Assert.Matches(@"/dev/sda1 +2048 +2099199 +2097152 +1G EFI System", @out);
        Assert.Contains("Disk /dev/sdb: 14.91 GiB", @out);
        Assert.Matches(@"/dev/sdb1 +2048 31277231 31275184 14\.9G  c W95 FAT32 \(LBA\)", @out);
        var interactive = t.Run("sudo fdisk /dev/sdb");
        Assert.Equal(1, interactive.ExitCode);
        Assert.Contains("Welcome to fdisk", interactive.Out);
    }

    [Fact(DisplayName = "swapon visar swap-partitionen")]
    public void Swapon()
    {
        var t = new TestShell("debian");
        Assert.Equal("NAME      TYPE      SIZE USED PRIO\n/dev/sda3 partition   2G   0B   -2\n", t.Run("swapon").Out);
    }

    [Fact(DisplayName = "mkfs.ext4 frågar först, och formaterar sedan bort allt")]
    public void MkfsExt4AsksThenFormats()
    {
        var t = new TestShell();
        Assert.Contains("Permission denied", t.Run("mkfs.ext4 /dev/sdb1").Out);
        var r = t.Run("sudo mkfs.ext4 -L BACKUP /dev/sdb1");
        Assert.Contains("/dev/sdb1 contains a vfat file system labelled 'USBMINNE'", r.Out);
        Assert.True(r.Pending);
        Assert.Equal(1, t.Run("n").ExitCode);
        Assert.Equal("vfat\n", t.Run("blkid -s TYPE -o value /dev/sdb1").Out);
        t.Run("sudo mkfs.ext4 -L BACKUP /dev/sdb1");
        r = t.Run("y");
        Assert.Equal(0, r.ExitCode);
        Assert.Contains("Creating journal (16384 blocks): done", r.Out);
        Assert.Matches(@"sdb1 ext4 +1\.0 +BACKUP ", t.Run("lsblk -f /dev/sdb1").Out);
        Assert.NotEqual(DisksLib.UsbUuid, t.Sh.Disks.Disks[1].Partitions[0].Uuid);
        t.Run("sudo mkdir -p /mnt/usb && sudo mount /dev/sdb1 /mnt/usb");
        Assert.Equal("lost+found\n", t.Run("ls -A /mnt/usb").Out);
        // Mounted and active partitions cannot be formatted.
        Assert.Contains("/dev/sdb1 is mounted; will not make a filesystem here!", t.Run("sudo mkfs.ext4 /dev/sdb1").Out);
        Assert.Contains("is mounted", t.Run("sudo mkfs.ext4 /dev/sda2").Out);
        Assert.Contains("apparently in use by the system", t.Run("sudo mkfs.ext4 /dev/sda3").Out);
        t.Run("sudo umount /mnt/usb");
        Assert.Equal(0, t.Run("sudo mkfs.vfat -n USBMINNE /dev/sdb1").ExitCode);
        Assert.Equal("USBMINNE\n", t.Run("blkid -s LABEL -o value /dev/sdb1").Out);
        Assert.Contains("failed to execute mkfs.xfs", t.Run("sudo mkfs -t xfs /dev/sdb1").Out);
    }

    [Fact(DisplayName = "mkfs.vfat följer inte med Arch från början")]
    public void MkfsVfatNotOnArch()
    {
        var t = new TestShell("arch");
        Assert.Contains("command not found", t.Run("sudo mkfs.vfat /dev/sdb1").Out);
        Assert.Equal(0, t.Run("which mkfs.ext4").ExitCode);
    }

    // ---------- sparat tillstånd ----------

    [Fact(DisplayName = "monteringar och stickans innehåll överlever snapshot/restore")]
    public void MountsSurviveSnapshot()
    {
        var t = new TestShell();
        t.Run("sudo mkdir -p /mnt/usb && sudo mount /dev/sdb1 /mnt/usb && sudo cp ~/dokument/frukter.txt /mnt/usb/");
        var copy = Shell.RestoreJson(t.Sh.SnapshotJson())!;
        Assert.Contains(copy.Disks.Mounts, m => m.Dev == DisksLib.UsbPart && m.Target == "/mnt/usb");
        Assert.Equal(0, copy.Execute("sudo umount /mnt/usb").ExitCode);
        var again = Shell.RestoreJson(copy.SnapshotJson())!;
        again.Execute("sudo mount /dev/sdb1 /mnt/usb");
        Assert.Contains("frukter.txt", UtilCmd.StripAnsi(again.Execute("ls /mnt/usb").Output));
    }

    [Fact(DisplayName = "ett gammalt sparat skal utan diskar får diskar, ny fstab och de nya kommandona")]
    public void OldSnapshotGetsDisks()
    {
        var t = new TestShell("fedora");
        var old = JsonNode.Parse(t.Sh.SnapshotJson())!.AsObject();
        old.Remove("disks");
        var flags = old["flags"]!.AsObject();
        foreach (var k in flags.Select(kv => kv.Key).ToList()) if (k.StartsWith("default:cmd:", StringComparison.Ordinal)) flags.Remove(k);
        var etc = old["fs"]!["children"]!["etc"]!["children"]!;
        etc["fstab"]!["content"] = "# <file system>  <mount point>  <type>  <options>  <dump>  <pass>\nUUID=1234-abcd   /              ext4    defaults   0       1\n";
        var bin = old["fs"]!["children"]!["usr"]!["children"]!["bin"]!["children"]!.AsObject();
        foreach (var cmd in new[] { "lsblk", "mount", "umount", "df", "mkfs.ext4" }) bin.Remove(cmd);
        bin.Remove("mkfs.vfat");
        old["fs"]!["children"]!["dev"]!["children"]!.AsObject().Remove("sdb1");

        var restored = Shell.RestoreJson(old.ToJsonString())!;
        Assert.Equal(new[] { "sda", "sdb", "zram0" }, restored.Disks.Disks.Select(d => d.Name));
        Assert.Contains("sdb1", UtilCmd.StripAnsi(restored.Execute("lsblk").Output));
        Assert.Contains("btrfs", UtilCmd.StripAnsi(restored.Execute("cat /etc/fstab").Output));
        Assert.Equal(0, restored.Execute("ls /dev/sdb1").ExitCode);
        Assert.Equal(0, restored.Execute("df -h").ExitCode);
        Assert.Equal(0, restored.Execute("which mkfs.vfat").ExitCode);
    }
}
