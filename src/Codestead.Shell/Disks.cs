using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Port of src/shell/disks.ts – the disks in the simulated computer: a system disk with partitions
// and a USB stick the student can mount.
//
// Mounting a file system here means that the directory in the VFS (e.g. /mnt/usb) is replaced by
// the file system's root directory. The directory that was there is saved and put back on umount,
// and the file system's content is then saved in the partition – just like for real, the files
// disappear from the tree but are still on the stick.

/// <summary>A file system (or swap) on a partition or a whole device.</summary>
public partial class FsInfo
{
    public string? Fstype { get; set; }
    public string? Fsver { get; set; }
    public string? Label { get; set; }
    public string? Uuid { get; set; }
    /// <summary>Bytes used by things that are not in the VFS (the system's own files).</summary>
    public double? Base { get; set; }
    /// <summary>The file system's content when it is not mounted (e.g. the USB stick).</summary>
    public FsNode? Root { get; set; }
    /// <summary>In use as swap right now – cannot be mounted or formatted.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public bool SwapActive { get; set; }

    /// <summary>Copies the file system fields from another FsInfo ({ ...fs }).</summary>
    internal void CopyFsFrom(FsInfo fs)
    {
        Fstype = fs.Fstype;
        Fsver = fs.Fsver;
        Label = fs.Label;
        Uuid = fs.Uuid;
        Base = fs.Base;
        Root = fs.Root;
        SwapActive = fs.SwapActive;
    }
}

public partial class Partition : FsInfo
{
    public string Name { get; set; } = "";
    /// <summary>The first sector.</summary>
    public long Start { get; set; }
    public long Sectors { get; set; }
    /// <summary>Partition type shown by fdisk, e.g. "EFI System".</summary>
    public string Ptype { get; set; } = "";
    /// <summary>MBR type (only for dos partition tables), e.g. "c".</summary>
    public string? PtypeId { get; set; }
    public string Partuuid { get; set; } = "";
}

public partial class Disk : FsInfo
{
    public string Name { get; set; } = "";
    public long Sectors { get; set; }
    public string Model { get; set; } = "";
    public bool Removable { get; set; }
    /// <summary>Connection: sata, usb or empty (zram).</summary>
    public string Tran { get; set; } = "";
    public int Major { get; set; }
    public int Minor { get; set; }
    /// <summary>"gpt" or "dos".</summary>
    public string? Pttype { get; set; }
    public string? DiskId { get; set; }
    public List<Partition> Partitions { get; set; } = new();
}

public partial class Mount
{
    /// <summary>What `mount` shows as the source: /dev/sdb1, tmpfs, proc ...</summary>
    public string Source { get; set; } = "";
    public string Target { get; set; } = "";
    public string Fstype { get; set; } = "";
    public string Options { get; set; } = "";
    /// <summary>The device (e.g. "sdb1") when the source is a disk or partition.</summary>
    public string? Dev { get; set; }
    /// <summary>btrfs subvolume, shown as /dev/sda3[/root] by findmnt.</summary>
    public string? Subvol { get; set; }
    /// <summary>Size in bytes for file systems not on a disk (tmpfs).</summary>
    public long? Size { get; set; }
    /// <summary>Bytes used in addition to the files in the VFS.</summary>
    public double? Base { get; set; }
    /// <summary>The directory that was at the mount point before (put back on umount).</summary>
    public FsNode? Under { get; set; }
    /// <summary>The system's own mounts – cannot be unmounted.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public bool System { get; set; }
}

public partial class DiskState
{
    public List<Disk> Disks { get; set; } = new();
    public List<Mount> Mounts { get; set; } = new();
}

/// <summary>A block device lookup: a whole disk or a partition.</summary>
public partial class Block
{
    public string Path { get; set; } = "";
    public string Name { get; set; } = "";
    public Disk Disk { get; set; } = null!;
    public Partition? Part { get; set; }
    /// <summary>The partition, or the disk if it is a whole disk.</summary>
    public FsInfo Dev { get; set; } = null!;
}

public partial class Usage
{
    /// <summary>The file system's size, used and available in bytes.</summary>
    public double Size { get; set; }
    public double Used { get; set; }
    public double Avail { get; set; }
}

public static partial class DisksLib
{
    public const int Sector = 512;
    private const long MiB = 1024L * 1024;
    private const long GiB = 1024L * 1024 * 1024;
    /// <summary>RAM in KiB (the same as `free` shows).</summary>
    private const long RamKb = 8_073_420;

    public const string UsbDisk = "sdb";
    public const string UsbPart = "sdb1";
    public const string UsbLabel = "USBSTICK";
    public const string UsbUuid = "7E21-9A4F";

    private sealed class Ids
    {
        public string Efi = "";
        public string? Boot;
        public string Root = "";
        public string Swap = "";
        public string Disk = "";
    }

    /// <summary>UUIDs per family, so that /etc/fstab, blkid and lsblk agree.</summary>
    private static readonly Dictionary<string, Ids> IdsByFamily = new()
    {
        ["debian"] = new Ids
        {
            Efi = "4A1C-93E2",
            Root = "3f1c9a2e-7b4d-4e8a-9c61-2d5e8f0a4b17",
            Swap = "9a6d3e51-0c2f-4b8e-a7d4-5e1f2c3b6a90",
            Disk = "6B0E2F4A-1C3D-4E5F-8A9B-0C1D2E3F4A5B",
        },
        ["arch"] = new Ids
        {
            Efi = "C2D7-5B18",
            Root = "b84e2c61-95f3-4d0a-8e7b-1a2c3d4e5f60",
            Swap = "2e9f7a14-6c3b-4d5e-9f80-a1b2c3d4e5f6",
            Disk = "9F3A1B2C-4D5E-4F60-8172-93A4B5C6D7E8",
        },
        ["redhat"] = new Ids
        {
            Efi = "1D6B-8F2A",
            Boot = "e5a0c3b7-2d14-4f69-8b3e-7c1d2e3f4a5b",
            Root = "c7f1e2d3-a4b5-4c6d-8e9f-0a1b2c3d4e5f",
            Swap = "0b3c4d5e-6f70-4182-93a4-b5c6d7e8f901",
            Disk = "2A4C6E80-1B3D-4F5A-9C7E-8D0F1A2B3C4D",
        },
    };

    /// <summary>Sectors per GiB.</summary>
    private const long G = GiB / Sector;
    private const long DiskSectors = 64 * G;
    /// <summary>The last sector used (GPT needs room for a backup copy at the end).</summary>
    private const long Last = DiskSectors - 2049;
    private const long UsbSectors = 31_277_232;

    /// <summary>A file on the USB stick. `size` gives "binary files" (pictures, PDF) a pretend size.</summary>
    private static FsNode UsbFile(string content, long mtime, long? size = null)
    {
        var n = VfsLib.MakeFile(content, "root", Js.Oct(755));
        if (size is not null) n.Size = size;
        n.Mtime = mtime;
        return n;
    }

    /// <summary>The files on the USB stick, in the language of the student's world.</summary>
    private static FsNode UsbFiles(World w)
    {
        long t = new DateTimeOffset(2026, 7, 14, 10, 32, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();
        var root = VfsLib.MakeDir("root", Js.Oct(755));
        root.Mtime = t;
        var children = Js.Obj<FsNode>();
        children[w["vacationPic"]] = UsbFile("ÿØÿà\u0000\u0010JFIF\u0000 (simulated image)\n", t, 3_481_216);
        children[w["report"]] = UsbFile(w.File("report"), t + 3_600_000, 842_113);
        children[w["todo"]] = UsbFile(w.File("usbTodo"), t + 7_200_000);
        root.Children = children;
        return root;
    }

    private static Partition Part(string name, long start, long sectors, string ptype, string partuuid, FsInfo fs)
    {
        var p = new Partition { Name = name, Start = start, Sectors = sectors, Ptype = ptype, Partuuid = partuuid };
        p.CopyFsFrom(fs);
        return p;
    }

    private static FsInfo WithBase(FsInfo fs, double @base)
    {
        var copy = new FsInfo();
        copy.CopyFsFrom(fs);
        copy.Base = @base;
        return copy;
    }

    public static DiskState InitialDisks(Distro distro, World w)
    {
        var ids = IdsByFamily[distro.Family];
        string Pu(int n) => $"{ids.Disk.Slice(0, 8).ToLowerInvariant()}-0000-4000-8000-00000000000{n}";
        List<Partition> partitions;
        var efi = new FsInfo { Fstype = "vfat", Fsver = "FAT32", Uuid = ids.Efi };
        var swap = new FsInfo { Fstype = "swap", Fsver = "1", Uuid = ids.Swap, SwapActive = true };
        double rootBase = distro.Id switch
        {
            "ubuntu" => 9.6,
            "debian" => 3.8,
            "arch" => 3.1,
            "fedora" => 6.2,
            _ => 4,
        };
        switch (distro.Family)
        {
            case "debian":
                // The Debian installer's layout: EFI, root and swap last.
                partitions = new List<Partition>
                {
                    Part("sda1", 2048, 1 * G, "EFI System", Pu(1), WithBase(efi, 6.2 * MiB)),
                    Part("sda2", 2048 + G, Last - 2 * G - (2048 + G) + 1, "Linux filesystem", Pu(2), new FsInfo
                    {
                        Fstype = "ext4",
                        Fsver = "1.0",
                        Uuid = ids.Root,
                        Base = rootBase * GiB,
                    }),
                    Part("sda3", Last - 2 * G + 1, 2 * G, "Linux swap", Pu(3), swap),
                };
                break;
            case "arch":
                // As in the Arch wiki: the EFI partition is mounted on /boot, then swap and root.
                partitions = new List<Partition>
                {
                    Part("sda1", 2048, 1 * G, "EFI System", Pu(1), WithBase(efi, 158 * MiB)),
                    Part("sda2", 2048 + G, 2 * G, "Linux swap", Pu(2), swap),
                    Part("sda3", 2048 + 3 * G, Last - (2048 + 3 * G) + 1, "Linux filesystem", Pu(3), new FsInfo
                    {
                        Fstype = "ext4",
                        Fsver = "1.0",
                        Uuid = ids.Root,
                        Base = rootBase * GiB,
                    }),
                };
                break;
            default:
            {
                // Fedora: EFI, /boot with ext4 and the rest btrfs (the subvolumes root and home).
                // Swap is in RAM (zram), not on the disk.
                var r = IdsByFamily["redhat"];
                partitions = new List<Partition>
                {
                    Part("sda1", 2048, 1_228_800, "EFI System", Pu(1), WithBase(efi, 19.6 * MiB)),
                    Part("sda2", 1_230_848, G, "Linux extended boot", Pu(2), new FsInfo
                    {
                        Fstype = "ext4",
                        Fsver = "1.0",
                        Uuid = r.Boot,
                        Base = 286 * MiB,
                    }),
                    Part("sda3", 1_230_848 + G, Last - (1_230_848 + G) + 1, "Linux filesystem", Pu(3), new FsInfo
                    {
                        Fstype = "btrfs",
                        Fsver = "1",
                        Label = "fedora",
                        Uuid = r.Root,
                        Base = rootBase * GiB,
                    }),
                };
                break;
            }
        }
        var disks = new List<Disk>
        {
            new()
            {
                Name = "sda",
                Sectors = DiskSectors,
                Model = "QEMU HARDDISK",
                Removable = false,
                Tran = "sata",
                Major = 8,
                Minor = 0,
                Pttype = "gpt",
                DiskId = ids.Disk,
                Partitions = partitions,
            },
            new()
            {
                Name = UsbDisk,
                Sectors = UsbSectors,
                Model = "USB Flash Disk",
                Removable = true,
                Tran = "usb",
                Major = 8,
                Minor = 16,
                Pttype = "dos",
                DiskId = "0x5d3a1c7e",
                Partitions = new List<Partition>
                {
                    new()
                    {
                        Name = UsbPart,
                        Start = 2048,
                        Sectors = UsbSectors - 2048,
                        Ptype = "W95 FAT32 (LBA)",
                        PtypeId = "c",
                        Partuuid = "5d3a1c7e-01",
                        Fstype = "vfat",
                        Fsver = "FAT32",
                        Label = UsbLabel,
                        Uuid = UsbUuid,
                        Base = 0,
                        Root = UsbFiles(w),
                    },
                },
            },
        };
        if (distro.Family == "redhat")
        {
            disks.Add(new Disk
            {
                Name = "zram0",
                Sectors = 2 * G,
                Model = "",
                Removable = false,
                Tran = "",
                Major = 251,
                Minor = 0,
                Partitions = new List<Partition>(),
                Fstype = "swap",
                Fsver = "1",
                Label = "zram0",
                Uuid = IdsByFamily["redhat"].Swap,
                SwapActive = true,
            });
        }
        return new DiskState { Disks = disks, Mounts = SystemMounts(distro) };
    }

    private static List<Mount> SystemMounts(Distro distro)
    {
        static long Kb(long k) => k * 1024;
        long run = RamKb / 10;
        long half = RamKb / 2;
        static Mount Tmpfs(string target, string options, long size, double @base = 0) => new()
        {
            Source = "tmpfs",
            Target = target,
            Fstype = "tmpfs",
            Options = options,
            Size = Kb(size),
            Base = @base,
            System = true,
        };
        var devName = distro.Family switch { "debian" => "udev", "arch" => "dev", _ => "devtmpfs" };
        long devSize = distro.Family == "redhat" ? 4096 : 3_995_264;
        var m = new List<Mount>
        {
            new() { Source = "sysfs", Target = "/sys", Fstype = "sysfs", Options = "rw,nosuid,nodev,noexec,relatime", System = true },
            new() { Source = "proc", Target = "/proc", Fstype = "proc", Options = "rw,nosuid,nodev,noexec,relatime", System = true },
            new()
            {
                Source = devName,
                Target = "/dev",
                Fstype = "devtmpfs",
                Options = $"rw,nosuid,relatime,size={devSize}k,nr_inodes=998816,mode=755,inode64",
                Size = Kb(devSize),
                System = true,
            },
            Tmpfs("/run", $"rw,nosuid,nodev,noexec,relatime,size={run}k,mode=755,inode64", run, 1.6 * MiB),
        };
        switch (distro.Family)
        {
            case "debian":
                m.Add(new Mount
                {
                    Source = "/dev/sda2",
                    Target = "/",
                    Fstype = "ext4",
                    Options = "rw,relatime,errors=remount-ro",
                    Dev = "sda2",
                    System = true,
                });
                break;
            case "arch":
                m.Add(new Mount { Source = "/dev/sda3", Target = "/", Fstype = "ext4", Options = "rw,relatime", Dev = "sda3", System = true });
                break;
            case "redhat":
                m.Add(new Mount
                {
                    Source = "/dev/sda3",
                    Target = "/",
                    Fstype = "btrfs",
                    Options = "rw,relatime,seclabel,compress=zstd:1,ssd,discard=async,space_cache=v2,subvolid=257,subvol=/root",
                    Dev = "sda3",
                    Subvol = "/root",
                    System = true,
                });
                break;
        }
        m.Add(Tmpfs("/dev/shm", "rw,nosuid,nodev,inode64", half));
        if (distro.Family == "debian") m.Add(Tmpfs("/run/lock", "rw,nosuid,nodev,noexec,relatime,size=5120k,inode64", 5120, 8192));
        // Debian 13, Arch and Fedora have /tmp in RAM (tmpfs). Ubuntu has it on the disk.
        if (distro.Id != "ubuntu") m.Add(Tmpfs("/tmp", $"rw,nosuid,nodev,size={half}k,nr_inodes=1048576,inode64", half));
        const string vfatOpts = "rw,relatime,fmask=0077,dmask=0077,codepage=437,iocharset=ascii,shortname=mixed,utf8,errors=remount-ro";
        switch (distro.Family)
        {
            case "debian":
                m.Add(new Mount { Source = "/dev/sda1", Target = "/boot/efi", Fstype = "vfat", Options = vfatOpts, Dev = "sda1", System = true });
                break;
            case "arch":
                m.Add(new Mount { Source = "/dev/sda1", Target = "/boot", Fstype = "vfat", Options = vfatOpts.Replace("0077", "0022"), Dev = "sda1", System = true });
                break;
            case "redhat":
                m.Add(new Mount
                {
                    Source = "/dev/sda3",
                    Target = "/home",
                    Fstype = "btrfs",
                    Options = "rw,relatime,seclabel,compress=zstd:1,ssd,discard=async,space_cache=v2,subvolid=256,subvol=/home",
                    Dev = "sda3",
                    Subvol = "/home",
                    System = true,
                });
                m.Add(new Mount { Source = "/dev/sda2", Target = "/boot", Fstype = "ext4", Options = "rw,relatime,seclabel", Dev = "sda2", System = true });
                // vfatOpts.replace('relatime', 'relatime,seclabel') – only the first occurrence.
                m.Add(new Mount { Source = "/dev/sda1", Target = "/boot/efi", Fstype = "vfat", Options = ReplaceFirst(vfatOpts, "relatime", "relatime,seclabel"), Dev = "sda1", System = true });
                break;
        }
        m.Add(Tmpfs("/run/user/1000", $"rw,nosuid,nodev,relatime,size={run}k,nr_inodes=201808,mode=700,uid=1000,gid=1000,inode64", run, 124 * 1024));
        return m;
    }

    private static string ReplaceFirst(string s, string find, string repl)
    {
        int i = s.IndexOf(find, StringComparison.Ordinal);
        return i < 0 ? s : s[..i] + repl + s[(i + find.Length)..];
    }

    /// <summary>/etc/fstab as each distribution's installer would have written it.</summary>
    public static string FstabFor(Distro distro)
    {
        switch (distro.Family)
        {
            case "debian":
            {
                var ids = IdsByFamily["debian"];
                return "# /etc/fstab: static file system information.\n" +
                       "#\n" +
                       "# Use 'blkid' to print the universally unique identifier for a\n" +
                       "# device; this may be used with UUID= as a more robust way to name devices\n" +
                       "# that works even if disks are added and removed. See fstab(5).\n" +
                       "#\n" +
                       "# <file system> <mount point>   <type>  <options>       <dump>  <pass>\n" +
                       "# / was on /dev/sda2 during installation\n" +
                       $"UUID={ids.Root} /               ext4    errors=remount-ro 0       1\n" +
                       "# /boot/efi was on /dev/sda1 during installation\n" +
                       $"UUID={ids.Efi}  /boot/efi       vfat    umask=0077      0       1\n" +
                       "# swap was on /dev/sda3 during installation\n" +
                       $"UUID={ids.Swap} none            swap    sw              0       0\n";
            }
            case "arch":
            {
                var ids = IdsByFamily["arch"];
                return "# Static information about the filesystems.\n" +
                       "# See fstab(5) for details.\n" +
                       "\n" +
                       "# <file system> <dir> <type> <options> <dump> <pass>\n" +
                       "# /dev/sda3\n" +
                       $"UUID={ids.Root}\t/         \text4      \trw,relatime\t0 1\n" +
                       "\n" +
                       "# /dev/sda1\n" +
                       $"UUID={ids.Efi}      \t/boot     \tvfat      \trw,relatime,fmask=0022,dmask=0022,codepage=437,iocharset=ascii,shortname=mixed,utf8,errors=remount-ro\t0 2\n" +
                       "\n" +
                       "# /dev/sda2\n" +
                       $"UUID={ids.Swap}\tnone      \tswap      \tdefaults  \t0 0\n" +
                       "\n";
            }
            default:
            {
                var ids = IdsByFamily["redhat"];
                return "\n" +
                       "#\n" +
                       "# /etc/fstab\n" +
                       "# Created by anaconda on Mon Oct 20 10:02:11 2026\n" +
                       "#\n" +
                       "# Accessible filesystems, by reference, are maintained under '/dev/disk/'.\n" +
                       "# See man pages fstab(5), findfs(8), mount(8) and/or blkid(8) for more info.\n" +
                       "#\n" +
                       "# After editing this file, run 'systemctl daemon-reload' to update systemd\n" +
                       "# units generated from this file.\n" +
                       "#\n" +
                       $"UUID={ids.Root} /                       btrfs   subvol=root,compress=zstd:1 0 0\n" +
                       $"UUID={ids.Boot} /boot                   ext4    defaults        1 2\n" +
                       $"UUID={ids.Efi}          /boot/efi               vfat    umask=0077,shortname=winnt 0 2\n" +
                       $"UUID={ids.Root} /home                   btrfs   subvol=home,compress=zstd:1 0 0\n";
            }
        }
    }

    /// <summary>UUID of the file system mounted on /.</summary>
    public static string RootUuid(Distro distro) => IdsByFamily[distro.Family].Root;

    /// <summary>The old /etc/fstab from versions before the disk chapter.</summary>
    private const string OldFstab = "# <file system>  <mount point>  <type>  <options>  <dump>  <pass>\nUUID=1234-abcd   /              ext4    defaults   0       1\n";

    /// <summary>
    /// Creates the disk model for a new (or old saved) shell: device files in /dev, the mount points,
    /// /proc/mounts and an /etc/fstab that matches the disks.
    /// </summary>
    public static DiskState SetupDisks(Distro distro, VFS vfs, World w)
    {
        var state = InitialDisks(distro, w);
        var root = vfs.Root;
        FsNode? Dir(string path)
        {
            var node = root;
            foreach (var seg in path.Split('/').Where(s => s != ""))
            {
                if (node.Type != "dir" || node.Children is null) return null;
                if (!node.Children.TryGetValue(seg, out var next))
                {
                    next = VfsLib.MakeDir();
                    node.Children[seg] = next;
                }
                node = next;
            }
            return node.Type == "dir" ? node : null;
        }
        var dev = Dir("/dev");
        if (dev?.Children is not null)
        {
            foreach (var b in AllBlocks(state))
                if (!dev.Children.ContainsKey(b.Name)) dev.Children[b.Name] = VfsLib.MakeFile("", "root", Js.Oct(660), "disk");
        }
        foreach (var m in state.Mounts)
        {
            if (m.Dev is not null && m.Target != "/")
            {
                var node = Dir(m.Target);
                if (node is not null && m.Target.StartsWith("/boot", StringComparison.Ordinal))
                    node.Mode = m.Fstype == "vfat" && distro.Family != "arch" ? Js.Oct(700) : Js.Oct(755);
            }
        }
        var etc = Dir("/etc");
        var fstab = etc?.Children?.Get("fstab");
        if (etc?.Children is not null && (fstab is null || fstab.Content == OldFstab)) etc.Children["fstab"] = VfsLib.MakeFile(FstabFor(distro));
        WriteProcMounts(vfs, state);
        return state;
    }

    // ---------- Lookups ----------

    public static List<Block> AllBlocks(DiskState state)
    {
        var @out = new List<Block>();
        foreach (var disk in state.Disks)
        {
            @out.Add(new Block { Path = $"/dev/{disk.Name}", Name = disk.Name, Disk = disk, Dev = disk });
            foreach (var p in disk.Partitions) @out.Add(new Block { Path = $"/dev/{p.Name}", Name = p.Name, Disk = disk, Part = p, Dev = p });
        }
        return @out;
    }

    private static readonly Regex SpecRe = new(@"^(LABEL|UUID|PARTUUID)=(.*)\z", RegexOptions.CultureInvariant);
    private static readonly Regex QuoteRe = new(@"^[""']|[""']\z", RegexOptions.CultureInvariant);

    /// <summary>Finds a device from /dev/sdb1, LABEL=USBSTICK or UUID=...</summary>
    public static Block? FindBlock(DiskState state, string spec)
    {
        var blocks = AllBlocks(state);
        var eq = SpecRe.Match(spec);
        if (eq.Success)
        {
            var value = QuoteRe.Replace(eq.Groups[2].Value, "");
            var key = eq.Groups[1].Value;
            return blocks.FirstOrDefault(b =>
            {
                string? v = key switch
                {
                    "LABEL" => b.Dev.Label,
                    "UUID" => b.Dev.Uuid,
                    _ => (b.Dev as Partition)?.Partuuid,
                };
                return v is not null && (key == "LABEL" ? v == value : v.ToLowerInvariant() == value.ToLowerInvariant());
            });
        }
        var path = VfsLib.NormalizePath(spec.StartsWith('/') ? spec : $"/dev/{spec}");
        return blocks.FirstOrDefault(b => b.Path == path);
    }

    public static List<Mount> MountsOf(DiskState state, string devName) => state.Mounts.Where(m => m.Dev == devName).ToList();

    /// <summary>The mount the path is in (the longest matching mount point).</summary>
    public static Mount? MountFor(DiskState state, string path)
    {
        var p = VfsLib.NormalizePath(path);
        Mount? best = null;
        foreach (var m in state.Mounts)
        {
            if (m.Target == p || m.Target == "/" || p.StartsWith(m.Target + "/", StringComparison.Ordinal))
            {
                if (best is null || m.Target.Length >= best.Target.Length) best = m;
            }
        }
        return best;
    }

    public static long BlockSize(FsInfo dev) => dev switch
    {
        Disk d => d.Sectors * Sector,
        Partition p => p.Sectors * Sector,
        _ => 0,
    };

    /// <summary>Size as lsblk shows it: 64G, 14.9G, 600M.</summary>
    public static string LsblkSize(double bytes)
    {
        string[] units = { "B", "K", "M", "G", "T" };
        double v = bytes;
        int u = 0;
        while (v >= 1024 && u < units.Length - 1)
        {
            v /= 1024;
            u++;
        }
        var s = Js.ToFixed(v, 1);
        if (s.EndsWith(".0", StringComparison.Ordinal)) s = s[..^2];
        return s + units[u];
    }

    // ---------- Space ----------

    private const long BlockBytes = 4096;
    private static readonly HashSet<string> Pseudo = new() { "proc", "sysfs" };

    private static long CeilBlocks(FsNode node) => (long)Math.Ceiling(VfsLib.NodeSize(node) / (double)BlockBytes) * BlockBytes;

    private static long TreeUsage(FsNode node)
    {
        if (node.Type == "file") return CeilBlocks(node);
        long sum = BlockBytes;
        if (node.Children is not null) foreach (var child in node.Children.Values) sum += TreeUsage(child);
        return sum;
    }

    /// <summary>How much the files under a mount point take, without other mounts below it.</summary>
    private static long MountTreeUsage(VFS vfs, DiskState state, Mount m, User root)
    {
        if (Pseudo.Contains(m.Fstype)) return 0;
        var start = vfs.TryLookup(m.Target, root);
        if (start is null) return 0;
        var others = new HashSet<string>(state.Mounts.Where(o => o != m).Select(o => o.Target));
        long Walk(FsNode node, string path)
        {
            if (node.Type == "file") return CeilBlocks(node);
            long sum = BlockBytes;
            if (node.Children is not null)
            {
                foreach (var (name, child) in node.Children)
                {
                    var p = path == "/" ? $"/{name}" : $"{path}/{name}";
                    if (others.Contains(p)) continue;
                    sum += Walk(child, p);
                }
            }
            return sum;
        }
        return Walk(start, m.Target);
    }

    private static double FsOverhead(string? fstype) =>
        fstype == "ext4" || fstype == "ext2" ? 0.983 : fstype == "vfat" ? 0.999 : 1;

    /// <summary>How much a file system on a partition uses, mounted or not.</summary>
    public static Usage PartitionUsage(VFS vfs, DiskState state, FsInfo dev, string devName, User root)
    {
        double size = Math.Floor(BlockSize(dev) * FsOverhead(dev.Fstype));
        double used = dev.Base ?? 0;
        var mounts = MountsOf(state, devName);
        if (mounts.Count > 0) foreach (var m in mounts) used += MountTreeUsage(vfs, state, m, root);
        else if (dev.Root is not null) used += TreeUsage(dev.Root);
        used = Math.Min(used, size);
        double reserved = dev.Fstype == "ext4" || dev.Fstype == "ext2" ? Math.Floor(size * 0.05) : 0;
        return new Usage { Size = size, Used = used, Avail = Math.Max(0, size - used - reserved) };
    }

    /// <summary>The space for a mount (what df shows).</summary>
    public static Usage MountUsage(VFS vfs, DiskState state, Mount m, User root)
    {
        if (m.Dev is not null)
        {
            var b = FindBlock(state, m.Dev);
            if (b is not null) return PartitionUsage(vfs, state, b.Dev, b.Name, root);
        }
        double size = m.Size ?? 0;
        double used = Math.Min(size, (m.Base ?? 0) + (m.Fstype == "devtmpfs" ? 0 : MountTreeUsage(vfs, state, m, root)));
        return new Usage { Size = size, Used = used, Avail = Math.Max(0, size - used) };
    }

    // ---------- /proc/mounts ----------

    public static void WriteProcMounts(VFS vfs, DiskState state)
    {
        var proc = vfs.Root.Children?.Get("proc");
        if (proc is null || proc.Type != "dir" || proc.Children is null) return;
        var lines = string.Concat(state.Mounts.Select(m => $"{m.Source} {m.Target} {m.Fstype} {m.Options} 0 0\n"));
        proc.Children["mounts"] = VfsLib.MakeFile(lines, "root", Js.Oct(444));
    }

    /// <summary>The content of a partition: the mount's directory in the VFS, or the saved content.</summary>
    public static FsNode? PartitionRoot(VFS vfs, DiskState state, string devName, User root)
    {
        var m = MountsOf(state, devName).FirstOrDefault();
        if (m is not null) return vfs.TryLookup(m.Target, root);
        return FindBlock(state, devName)?.Dev.Root;
    }

    /// <summary>A new random UUID (ext4) or volume id (FAT).</summary>
    public static string NewUuid(string fstype)
    {
        static string Hex(int n)
        {
            var sb = new StringBuilder();
            for (int i = 0; i < n; i++) sb.Append(((int)Math.Floor(Js.Random() * 16)).ToString("x", CultureInfo.InvariantCulture));
            return sb.ToString();
        }
        if (fstype == "vfat") return $"{Hex(4)}-{Hex(4)}".ToUpperInvariant();
        return $"{Hex(8)}-{Hex(4)}-4{Hex(3)}-{"89ab"[(int)Math.Floor(Js.Random() * 4)]}{Hex(3)}-{Hex(12)}";
    }

    public const long RamBytes = RamKb * 1024;
}
