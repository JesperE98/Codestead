namespace Codestead.Shell;

// Port of src/shell/disks.ts – the disks in the simulated computer: a system disk with partitions
// and a USB stick the student can mount.
//
// Mounting a file system here means that the directory in the VFS (e.g. /mnt/usb) is replaced by
// the file system's root directory. The directory that was there is saved and put back on umount,
// and the file system's content is then saved in the partition – just like for real, the files
// disappear from the tree but are still on the stick.

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
