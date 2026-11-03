namespace Codestead.Shell;

// DisksLib: the disks, partitions, mounts and /etc/fstab of a new computer.

public static partial class DisksLib
{
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
}
