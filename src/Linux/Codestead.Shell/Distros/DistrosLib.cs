namespace Codestead.Shell;

// Port of src/shell/distros.ts – the distributions the simulator can pretend to be.
// A "family" shares package manager and package format.

public static partial class DistrosLib
{
    public static readonly OrderedDictionary<Family, FamilyInfo> Families = new()
    {
        ["debian"] = new FamilyInfo
        {
            Id = "debian",
            Name = "Debian-familjen",
            PackageManager = "apt",
            PackageFormat = ".deb",
            Members = "Debian, Ubuntu, Linux Mint, Pop!_OS, Raspberry Pi OS",
        },
        ["arch"] = new FamilyInfo
        {
            Id = "arch",
            Name = "Arch-familjen",
            PackageManager = "pacman",
            PackageFormat = ".pkg.tar.zst",
            Members = "Arch Linux, Manjaro, EndeavourOS, CachyOS, SteamOS",
        },
        ["redhat"] = new FamilyInfo
        {
            Id = "redhat",
            Name = "Red Hat-familjen",
            PackageManager = "dnf",
            PackageFormat = ".rpm",
            Members = "Fedora, Red Hat Enterprise Linux, Rocky Linux, AlmaLinux, CentOS Stream",
        },
    };

    public static readonly List<Distro> Distros = new()
    {
    new Distro
    {
        Id = "ubuntu",
        Name = "Ubuntu 24.04 LTS",
        Family = "debian",
        Hostname = "ubuntu",
        Version = "24.04",
        Codename = "noble",
        Kernel = "6.8.0-71-generic",
        PackageManager = "apt",
        AdminGroup = "sudo",
        AdminGid = 27,
        PromptStyle = "ubuntu",
        Accent = "#e95420",
        Mirrors = new() { "http://archive.ubuntu.com/ubuntu noble InRelease", "http://archive.ubuntu.com/ubuntu noble-updates InRelease", "http://security.ubuntu.com/ubuntu noble-security InRelease" },
        OsRelease = "PRETTY_NAME=\"Ubuntu 24.04.3 LTS\"\nNAME=\"Ubuntu\"\nVERSION_ID=\"24.04\"\nVERSION=\"24.04.3 LTS (Noble Numbat)\"\nVERSION_CODENAME=noble\nID=ubuntu\nID_LIKE=debian\nHOME_URL=\"https://www.ubuntu.com/\"\nSUPPORT_URL=\"https://help.ubuntu.com/\"\nBUG_REPORT_URL=\"https://bugs.launchpad.net/ubuntu/\"\nUBUNTU_CODENAME=noble\n",
        Motd = "Welcome to Ubuntu 24.04.3 LTS (GNU/Linux 6.8.0-71-generic x86_64)\n\n * Documentation:  https://help.ubuntu.com\n * Management:     https://landscape.canonical.com\n * Support:        https://ubuntu.com/pro\n",
    },
    new Distro
    {
        Id = "debian",
        Name = "Debian 13 (trixie)",
        Family = "debian",
        Hostname = "debian",
        Version = "13",
        Codename = "trixie",
        Kernel = "6.12.48+deb13-amd64",
        PackageManager = "apt",
        AdminGroup = "sudo",
        AdminGid = 27,
        PromptStyle = "debian",
        Accent = "#d70a53",
        Mirrors = new() { "http://deb.debian.org/debian trixie InRelease", "http://deb.debian.org/debian trixie-updates InRelease", "http://security.debian.org/debian-security trixie-security InRelease" },
        OsRelease = "PRETTY_NAME=\"Debian GNU/Linux 13 (trixie)\"\nNAME=\"Debian GNU/Linux\"\nVERSION_ID=\"13\"\nVERSION=\"13 (trixie)\"\nVERSION_CODENAME=trixie\nID=debian\nHOME_URL=\"https://www.debian.org/\"\nSUPPORT_URL=\"https://www.debian.org/support\"\nBUG_REPORT_URL=\"https://bugs.debian.org/\"\n",
        Motd = "Linux debian 6.12.48+deb13-amd64 #1 SMP PREEMPT_DYNAMIC Debian x86_64\n\nThe programs included with the Debian GNU/Linux system are free software;\nthe exact distribution terms for each program are described in the\nindividual files in /usr/share/doc/*/copyright.\n",
    },
    new Distro
    {
        Id = "arch",
        Name = "Arch Linux",
        Family = "arch",
        Hostname = "archlinux",
        Version = "rolling",
        Kernel = "6.17.5-arch1-1",
        PackageManager = "pacman",
        AdminGroup = "wheel",
        AdminGid = 998,
        PromptStyle = "bracket",
        Accent = "#1793d1",
        Mirrors = new(),
        OsRelease = "NAME=\"Arch Linux\"\nPRETTY_NAME=\"Arch Linux\"\nID=arch\nBUILD_ID=rolling\nANSI_COLOR=\"38;2;23;147;209\"\nHOME_URL=\"https://archlinux.org/\"\nDOCUMENTATION_URL=\"https://wiki.archlinux.org/\"\nSUPPORT_URL=\"https://bbs.archlinux.org/\"\nBUG_REPORT_URL=\"https://gitlab.archlinux.org/groups/archlinux/-/issues\"\nLOGO=archlinux-logo\n",
        Motd = "",
    },
    new Distro
    {
        Id = "fedora",
        Name = "Fedora Linux 43",
        Family = "redhat",
        Hostname = "fedora",
        Version = "43",
        Kernel = "6.17.4-300.fc43.x86_64",
        PackageManager = "dnf",
        AdminGroup = "wheel",
        AdminGid = 10,
        PromptStyle = "bracket",
        Accent = "#51a2da",
        Mirrors = new(),
        OsRelease = "NAME=\"Fedora Linux\"\nVERSION=\"43 (Workstation Edition)\"\nID=fedora\nVERSION_ID=43\nPRETTY_NAME=\"Fedora Linux 43 (Workstation Edition)\"\nHOME_URL=\"https://fedoraproject.org/\"\nDOCUMENTATION_URL=\"https://docs.fedoraproject.org/\"\nSUPPORT_URL=\"https://ask.fedoraproject.org/\"\nBUG_REPORT_URL=\"https://bugzilla.redhat.com/\"\nVARIANT=\"Workstation Edition\"\nVARIANT_ID=workstation\n",
        Motd = "",
    },
    };

    public static Distro GetDistro(string id) => Distros.FirstOrDefault(d => d.Id == id) ?? Distros[0];
}
