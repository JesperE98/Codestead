namespace Codestead.Shell;

// Port of src/shell/packages.ts – the package database used by apt, pacman and dnf in the simulator.
// The same program can be called different things in different families – an important point!

public partial class PackageDef
{
    public string Id { get; set; } = "";
    /// <summary>Package name per family. If the family is missing, the package does not exist there.</summary>
    public OrderedDictionary<Family, string> Names { get; set; } = Js.Obj<string>();
    public OrderedDictionary<Family, string> Version { get; set; } = Js.Obj<string>();
    /// <summary>Version that becomes available after the package lists have been updated.</summary>
    public OrderedDictionary<Family, string>? NewVersion { get; set; }
    public string Description { get; set; } = "";
    public long SizeKb { get; set; }
    /// <summary>Commands the package installs in /usr/bin.</summary>
    public List<string> Provides { get; set; } = new();
    /// <summary>Preinstalled in these families.</summary>
    public List<Family>? Base { get; set; }
    /// <summary>System critical – the package manager refuses to remove it.</summary>
    public bool? Essential { get; set; }
    /// <summary>Arch repository ("core"/"extra").</summary>
    public string? ArchRepo { get; set; }
    /// <summary>Shells the package adds to /etc/shells.</summary>
    public List<string>? Shells { get; set; }
    /// <summary>Preinstalled only in these distributions (e.g. snapd in Ubuntu but not in Debian).</summary>
    public List<string>? BaseDistros { get; set; }
    /// <summary>
    /// Exists only in an extra repository: "ppa:user/name" (Debian/Ubuntu), "aur" (Arch)
    /// or "copr:user/project" (Fedora). See Extrarepo.cs and Commands/ReposCmd.cs.
    /// </summary>
    public OrderedDictionary<Family, string>? ExtraRepo { get; set; }
}

public static partial class PackagesLib
{
    private static readonly List<Family> AllFamilies = new() { "debian", "arch", "redhat" };

    private static OrderedDictionary<Family, string> Same(string name) => Rec(name, name, name);

    /// <summary>A Partial&lt;Record&lt;Family, string&gt;&gt; literal: only the families given (in this order).</summary>
    private static OrderedDictionary<Family, string> Rec(string? debian = null, string? arch = null, string? redhat = null)
    {
        var o = Js.Obj<string>();
        if (debian is not null) o["debian"] = debian;
        if (arch is not null) o["arch"] = arch;
        if (redhat is not null) o["redhat"] = redhat;
        return o;
    }

    public static List<PackageDef> Packages { get; } = new()
    {
        new PackageDef
        {
            Id = "coreutils",
            Names = Same("coreutils"),
            Version = Rec(debian: "9.4-3ubuntu6", arch: "9.8-2", redhat: "9.7-6.fc43"),
            NewVersion = Rec(debian: "9.4-3ubuntu6.1", arch: "9.8-3", redhat: "9.7-7.fc43"),
            Description = "GNU core utilities (ls, cp, mv, rm, cat ...)",
            SizeKb = 17_400,
            Provides = new() { "ls", "cat", "mkdir", "touch", "rm", "rmdir", "cp", "mv", "head", "tail", "wc", "sort", "uniq", "cut", "tee", "chmod", "chown", "whoami", "id", "groups", "uname", "date", "env", "printenv", "true", "false", "sleep", "seq", "basename", "dirname", "pwd", "echo", "tr", "du", "who", "chgrp", "df", "sync" },
            Base = AllFamilies,
            Essential = true,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "bash",
            Names = Same("bash"),
            Version = Rec(debian: "5.2.21-2ubuntu4", arch: "5.3.3-2", redhat: "5.3.0-2.fc43"),
            NewVersion = Rec(debian: "5.2.21-2ubuntu4.1", arch: "5.3.3-3", redhat: "5.3.0-3.fc43"),
            Description = "GNU Bourne Again SHell",
            SizeKb = 8_600,
            Provides = new() { "bash", "sh" },
            Base = AllFamilies,
            Essential = true,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "grep",
            Names = Same("grep"),
            Version = Rec(debian: "3.11-4build1", arch: "3.12-2", redhat: "3.12-2.fc43"),
            Description = "GNU grep, egrep and fgrep – search text with patterns",
            SizeKb = 1_200,
            Provides = new() { "grep" },
            Base = AllFamilies,
            Essential = true,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "sed",
            Names = Same("sed"),
            Version = Rec(debian: "4.9-2build1", arch: "4.9-3", redhat: "4.9-5.fc43"),
            Description = "GNU stream editor for filtering and transforming text",
            SizeKb = 860,
            Provides = new() { "sed" },
            Base = AllFamilies,
            Essential = true,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "awk",
            // Debian och Ubuntu har mawk som standard, Arch och Fedora GNU awk.
            Names = Rec(debian: "mawk", arch: "gawk", redhat: "gawk"),
            Version = Rec(debian: "1.3.4.20240123-1build1", arch: "5.3.2-1", redhat: "5.3.2-2.fc43"),
            Description = "Pattern scanning and text processing language (awk)",
            SizeKb = 2_400,
            Provides = new() { "awk" },
            Base = AllFamilies,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "findutils",
            Names = Same("findutils"),
            Version = Rec(debian: "4.9.0-5build1", arch: "4.10.0-3", redhat: "4.10.0-6.fc43"),
            Description = "Utilities for finding files (find, xargs)",
            SizeKb = 1_700,
            Provides = new() { "find" },
            Base = AllFamilies,
            Essential = true,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "sudo",
            Names = Same("sudo"),
            Version = Rec(debian: "1.9.15p5-3ubuntu5", arch: "1.9.17.p2-1", redhat: "1.9.17-4.p2.fc43"),
            NewVersion = Rec(debian: "1.9.15p5-3ubuntu5.1", arch: "1.9.17.p2-2", redhat: "1.9.17-5.p2.fc43"),
            Description = "Give limited root privileges to certain users",
            SizeKb = 4_100,
            Provides = new() { "sudo" },
            Base = AllFamilies,
            Essential = true,
            ArchRepo = "core",
        },
        new PackageDef
        {
            // Användarhantering. Paketet heter olika saker i familjerna!
            Id = "shadow",
            Names = Rec(debian: "passwd", arch: "shadow", redhat: "shadow-utils"),
            Version = Rec(debian: "1:4.13+dfsg1-4ubuntu3.2", arch: "4.18.0-1", redhat: "2:4.18.0-3.fc43"),
            Description = "Change and administer password and group data (useradd, passwd ...)",
            SizeKb = 3_900,
            Provides = new() { "useradd", "usermod", "userdel", "groupadd", "groupdel", "gpasswd", "passwd", "chpasswd", "chage" },
            Base = AllFamilies,
            Essential = true,
            ArchRepo = "core",
        },
        new PackageDef
        {
            // Debians vänligare skript runt useradd. Finns inte i Arch och Fedora.
            Id = "adduser",
            Names = Rec(debian: "adduser"),
            Version = Rec(debian: "3.137ubuntu1", arch: "", redhat: ""),
            Description = "Add and remove users and groups (friendly front end to useradd)",
            SizeKb = 640,
            Provides = new() { "adduser", "deluser", "addgroup", "delgroup" },
            Base = new() { "debian" },
        },
        new PackageDef
        {
            Id = "libc",
            Names = Rec(debian: "libc-bin", arch: "glibc", redhat: "glibc-common"),
            Version = Rec(debian: "2.39-0ubuntu8.6", arch: "2.42+r17-1", redhat: "2.42-4.fc43"),
            Description = "GNU C Library: support programs (getent, ldd ...)",
            SizeKb = 2_700,
            Provides = new() { "getent" },
            Base = AllFamilies,
            Essential = true,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "util-linux",
            Names = Same("util-linux"),
            Version = Rec(debian: "2.39.3-9ubuntu6", arch: "2.41.2-1", redhat: "2.41.2-1.fc43"),
            Description = "Miscellaneous system utilities (su, more, hostname ...)",
            SizeKb = 9_800,
            Provides = new() { "su", "more", "hostname", "chsh", "last", "mount", "umount", "lsblk", "blkid", "findmnt", "fdisk", "swapon", "mkfs" },
            Base = AllFamilies,
            Essential = true,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "ncurses",
            Names = Rec(debian: "ncurses-bin", arch: "ncurses", redhat: "ncurses"),
            Version = Rec(debian: "6.4+20240113-1ubuntu2", arch: "6.5-4", redhat: "6.5-7.20250614.fc43"),
            Description = "Terminal handling utilities (clear, tput ...)",
            SizeKb = 1_100,
            Provides = new() { "clear" },
            Base = AllFamilies,
            Essential = true,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "which",
            Names = Rec(debian: "debianutils", arch: "which", redhat: "which"),
            Version = Rec(debian: "5.17build1", arch: "2.23-1", redhat: "2.23-3.fc43"),
            Description = "Shows the full path of (shell) commands",
            SizeKb = 90,
            Provides = new() { "which" },
            Base = AllFamilies,
            Essential = true,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "e2fsprogs",
            Names = Same("e2fsprogs"),
            Version = Rec(debian: "1.47.0-2.4~exp1ubuntu4", arch: "1.47.3-1", redhat: "1.47.3-2.fc43"),
            Description = "Utilities for the ext2/ext3/ext4 file systems (mkfs.ext4, mke2fs ...)",
            SizeKb = 1_900,
            Provides = new() { "mkfs.ext4", "mke2fs" },
            Base = AllFamilies,
            ArchRepo = "core",
        },
        new PackageDef
        {
            // Följer inte med Arch från början – där installeras det vid behov.
            Id = "dosfstools",
            Names = Same("dosfstools"),
            Version = Rec(debian: "4.2-1.1build1", arch: "4.2-5", redhat: "4.2-14.fc43"),
            Description = "Utilities for making and checking MS-DOS FAT file systems (mkfs.vfat)",
            SizeKb = 320,
            Provides = new() { "mkfs.vfat", "mkfs.fat" },
            Base = new() { "debian", "redhat" },
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "procps",
            Names = Rec(debian: "procps", arch: "procps-ng", redhat: "procps-ng"),
            Version = Rec(debian: "2:4.0.4-4ubuntu3", arch: "4.0.5-3", redhat: "4.0.4-7.fc43"),
            Description = "Utilities for monitoring processes (ps, top, kill, pkill, free ...)",
            SizeKb = 2_100,
            Provides = new() { "ps", "top", "pkill", "pgrep", "uptime", "free", "w" },
            Base = AllFamilies,
            Essential = true,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "psmisc",
            Names = Same("psmisc"),
            Version = Rec(debian: "23.7-1build1", arch: "23.7-1", redhat: "23.6-10.fc43"),
            Description = "Utilities that use the proc file system (killall, pstree ...)",
            SizeKb = 600,
            Provides = new() { "killall" },
            Base = AllFamilies,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "tar",
            Names = Same("tar"),
            Version = Rec(debian: "1.35+dfsg-3build1", arch: "1.35-2", redhat: "2:1.35-6.fc43"),
            Description = "GNU version of the tar archiving utility",
            SizeKb = 3_100,
            Provides = new() { "tar" },
            Base = AllFamilies,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "gzip",
            Names = Same("gzip"),
            Version = Rec(debian: "1.12-1ubuntu3", arch: "1.14-2", redhat: "1.13-4.fc43"),
            Description = "GNU compression utility (gzip, gunzip, zcat)",
            SizeKb = 250,
            Provides = new() { "gzip", "gunzip", "zcat" },
            Base = AllFamilies,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "less",
            Names = Same("less"),
            Version = Rec(debian: "590-2ubuntu2", arch: "1:679-1", redhat: "679-2.fc43"),
            Description = "Pager program similar to more",
            SizeKb = 300,
            Provides = new() { "less" },
            Base = AllFamilies,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "man-db",
            Names = Same("man-db"),
            Version = Rec(debian: "2.12.0-4build2", arch: "2.13.1-1", redhat: "2.13.1-2.fc43"),
            Description = "Tools for reading manual pages",
            SizeKb = 2_800,
            Provides = new() { "man" },
            Base = AllFamilies,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "systemd",
            Names = Same("systemd"),
            Version = Rec(debian: "255.4-1ubuntu8.11", arch: "258.1-1", redhat: "258-1.fc43"),
            Description = "System and service manager (systemctl, journalctl ...)",
            SizeKb = 31_000,
            Provides = new() { "systemctl", "journalctl", "hostnamectl", "systemd-analyze", "reboot" },
            Base = AllFamilies,
            Essential = true,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "apt",
            Names = Rec(debian: "apt"),
            Version = Rec(debian: "2.8.3", arch: "", redhat: ""),
            Description = "Commandline package manager",
            SizeKb = 4_200,
            Provides = new() { "apt", "apt-get" },
            Base = new() { "debian" },
            Essential = true,
        },
        new PackageDef
        {
            Id = "pacman",
            Names = Rec(arch: "pacman"),
            Version = Rec(debian: "", arch: "7.0.0.r6.gc685ae6-6", redhat: ""),
            Description = "A library-based package manager with dependency support",
            SizeKb = 4_900,
            Provides = new() { "pacman", "makepkg" },
            Base = new() { "arch" },
            Essential = true,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "dnf",
            Names = Rec(redhat: "dnf5"),
            Version = Rec(debian: "", arch: "", redhat: "5.2.17.0-2.fc43"),
            Description = "Command-line package manager",
            SizeKb = 2_600,
            Provides = new() { "dnf", "dnf5" },
            Base = new() { "redhat" },
            Essential = true,
        },
        new PackageDef
        {
            Id = "nano",
            Names = Same("nano"),
            Version = Rec(debian: "7.2-2ubuntu0.1", arch: "8.6-1", redhat: "8.5-2.fc43"),
            Description = "Small, friendly text editor inspired by Pico",
            SizeKb = 2_900,
            Provides = new() { "nano" },
            Base = new() { "debian", "redhat" },
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "vim",
            Names = Rec(debian: "vim", arch: "vim", redhat: "vim-enhanced"),
            Version = Rec(debian: "2:9.1.0016-1ubuntu7.9", arch: "9.1.1734-1", redhat: "2:9.1.1775-1.fc43"),
            Description = "Vi IMproved – enhanced vi editor",
            SizeKb = 4_000,
            Provides = new() { "vim" },
        },
        new PackageDef
        {
            Id = "htop",
            Names = Same("htop"),
            Version = Rec(debian: "3.3.0-4build1", arch: "3.4.1-1", redhat: "3.4.1-2.fc43"),
            Description = "Interactive process viewer",
            SizeKb = 434,
            Provides = new() { "htop" },
        },
        new PackageDef
        {
            Id = "tree",
            Names = Same("tree"),
            Version = Rec(debian: "2.1.1-2ubuntu3", arch: "2.2.1-1", redhat: "2.2.1-2.fc43"),
            Description = "Displays an indented directory tree, in color",
            SizeKb = 118,
            Provides = new() { "tree" },
        },
        new PackageDef
        {
            Id = "fastfetch",
            Names = Same("fastfetch"),
            Version = Rec(debian: "2.47.0-1", arch: "2.54.0-1", redhat: "2.54.0-1.fc43"),
            Description = "Fast system information tool (like neofetch)",
            SizeKb = 1_900,
            Provides = new() { "fastfetch" },
        },
        new PackageDef
        {
            Id = "cowsay",
            Names = Same("cowsay"),
            Version = Rec(debian: "3.03+dfsg2-8", arch: "3.8.4-1", redhat: "3.8.4-3.fc43"),
            Description = "Configurable talking cow",
            SizeKb = 90,
            Provides = new() { "cowsay" },
        },
        new PackageDef
        {
            Id = "git",
            Names = Same("git"),
            Version = Rec(debian: "1:2.43.0-1ubuntu7.3", arch: "2.51.2-1", redhat: "2.51.1-1.fc43"),
            Description = "Fast, scalable, distributed revision control system",
            SizeKb = 38_000,
            Provides = new() { "git" },
        },
        new PackageDef
        {
            Id = "curl",
            Names = Same("curl"),
            Version = Rec(debian: "8.5.0-2ubuntu10.6", arch: "8.16.0-1", redhat: "8.15.0-3.fc43"),
            Description = "Command line tool for transferring data with URL syntax",
            SizeKb = 520,
            Provides = new() { "curl" },
            Base = new() { "arch", "redhat" },
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "wget",
            Names = Same("wget"),
            Version = Rec(debian: "1.21.4-1ubuntu4.1", arch: "1.25.0-2", redhat: "2.2.0-6.fc43"),
            Description = "Retrieves files from the web",
            SizeKb = 1_000,
            Provides = new() { "wget" },
            // Förinstallerat i Debian/Ubuntu, medan Arch och Fedora har curl i stället.
            Base = new() { "debian" },
        },
        new PackageDef
        {
            Id = "python",
            Names = Rec(debian: "python3", arch: "python", redhat: "python3"),
            Version = Rec(debian: "3.12.3-0ubuntu2", arch: "3.13.7-1", redhat: "3.14.0-1.fc43"),
            Description = "Interactive high-level object-oriented language (Python 3)",
            SizeKb = 25_000,
            Provides = new() { "python3" },
            Base = new() { "redhat" },
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "zip",
            Names = Same("zip"),
            Version = Rec(debian: "3.0-13ubuntu0.2", arch: "3.0-11", redhat: "3.0-44.fc43"),
            Description = "Archiver for .zip files",
            SizeKb = 640,
            Provides = new() { "zip" },
        },
        new PackageDef
        {
            Id = "unzip",
            Names = Same("unzip"),
            Version = Rec(debian: "6.0-28ubuntu4.1", arch: "6.0-23", redhat: "6.0-67.fc43"),
            Description = "De-archiver for .zip files",
            SizeKb = 540,
            Provides = new() { "unzip" },
        },
        new PackageDef
        {
            Id = "openssh",
            Names = Rec(debian: "openssh-client", arch: "openssh", redhat: "openssh-clients"),
            Version = Rec(debian: "1:9.6p1-3ubuntu13.14", arch: "10.2p1-1", redhat: "10.0p1-5.fc43"),
            Description = "Secure shell (SSH) client for secure access to remote machines",
            SizeKb = 3_400,
            Provides = new() { "ssh", "ssh-keygen", "ssh-copy-id" },
            // Arch installerar inte ssh-klienten från början.
            Base = new() { "debian", "redhat" },
        },
        // ---------- Nätverk ----------
        new PackageDef
        {
            Id = "iproute2",
            Names = Rec(debian: "iproute2", arch: "iproute2", redhat: "iproute"),
            Version = Rec(debian: "6.1.0-1ubuntu6.2", arch: "6.17.0-1", redhat: "6.14.0-2.fc43"),
            Description = "Networking and traffic control tools (ip, ss)",
            SizeKb = 3_200,
            Provides = new() { "ip", "ss" },
            Base = AllFamilies,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "iputils",
            Names = Rec(debian: "iputils-ping", arch: "iputils", redhat: "iputils"),
            Version = Rec(debian: "3:20240117-1ubuntu0.1", arch: "20250605-1", redhat: "20250605-1.fc43"),
            Description = "Tools to test the reachability of network hosts (ping)",
            SizeKb = 200,
            Provides = new() { "ping" },
            Base = AllFamilies,
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "dnsutils",
            Names = Rec(debian: "dnsutils", arch: "bind", redhat: "bind-utils"),
            Version = Rec(debian: "1:9.18.39-0ubuntu0.24.04.1", arch: "9.20.13-1", redhat: "32:9.18.39-1.fc43"),
            Description = "DNS lookup utilities (dig, host, nslookup)",
            SizeKb = 1_100,
            Provides = new() { "dig", "host", "nslookup" },
            ArchRepo = "extra",
        },
        new PackageDef
        {
            Id = "traceroute",
            Names = Same("traceroute"),
            Version = Rec(debian: "1:2.1.5-1", arch: "2.1.6-1", redhat: "3:2.1.6-3.fc43"),
            Description = "Traces the route taken by packets over an IPv4/IPv6 network",
            SizeKb = 160,
            Provides = new() { "traceroute" },
            ArchRepo = "extra",
        },
        new PackageDef
        {
            Id = "zsh",
            Names = Same("zsh"),
            Version = Rec(debian: "5.9-6ubuntu2", arch: "5.9-5", redhat: "5.9-18.fc43"),
            Description = "Z shell – a shell with many extras, largely compatible with bash",
            SizeKb = 8_900,
            Provides = new() { "zsh" },
            ArchRepo = "extra",
            Shells = new() { "/bin/zsh", "/usr/bin/zsh" },
        },
        new PackageDef
        {
            Id = "fish",
            Names = Same("fish"),
            Version = Rec(debian: "3.7.0-1", arch: "4.1.2-1", redhat: "4.0.2-2.fc43"),
            Description = "fish – the friendly interactive shell",
            SizeKb = 14_200,
            Provides = new() { "fish" },
            ArchRepo = "extra",
            Shells = new() { "/usr/bin/fish", "/bin/fish" },
        },
        // ----- Extra förråd (kapitlet "AUR, PPA och COPR") -----
        new PackageDef
        {
            Id = "software-properties-common",
            Names = Rec(debian: "software-properties-common"),
            Version = Rec(debian: "0.99.49.3", arch: "", redhat: ""),
            Description = "Manage the repositories that you install software from (add-apt-repository)",
            SizeKb = 210,
            Provides = new() { "add-apt-repository" },
            BaseDistros = new() { "ubuntu" },
        },
        new PackageDef
        {
            Id = "moonphase",
            Names = Same("moonphase"),
            Version = Rec(debian: "1.4.2-1~ppa1~noble1", arch: "1.4.2-1", redhat: "1.4.2-1.fc43"),
            Description = "Shows the current phase of the moon in the terminal",
            SizeKb = 64,
            Provides = new() { "moonphase" },
            ExtraRepo = Rec(debian: "ppa:lunatool/moonphase", arch: "aur", redhat: "copr:lunatool/moonphase"),
        },
        new PackageDef
        {
            Id = "base-devel",
            Names = Rec(arch: "base-devel"),
            Version = Rec(debian: "", arch: "1-2", redhat: ""),
            Description = "Basic tools to build Arch Linux packages (gcc, make, fakeroot ...)",
            SizeKb = 245_000,
            Provides = new(),
            ArchRepo = "core",
        },
        new PackageDef
        {
            Id = "go",
            Names = Rec(debian: "golang-go", arch: "go", redhat: "golang"),
            Version = Rec(debian: "2:1.22~2build1", arch: "2:1.25.3-1", redhat: "1.25.3-1.fc43"),
            Description = "The Go programming language compiler",
            SizeKb = 228_000,
            Provides = new() { "go" },
        },
        new PackageDef
        {
            Id = "yay",
            Names = Rec(arch: "yay"),
            Version = Rec(debian: "", arch: "12.5.2-1", redhat: ""),
            Description = "Yet another yogurt. Pacman wrapper and AUR helper written in go.",
            SizeKb = 9_800,
            Provides = new() { "yay" },
            ExtraRepo = Rec(arch: "aur"),
        },
        new PackageDef
        {
            Id = "yay-bin",
            Names = Rec(arch: "yay-bin"),
            Version = Rec(debian: "", arch: "12.5.2-1", redhat: ""),
            Description = "Yet another yogurt. Pacman wrapper and AUR helper written in go. Pre-compiled.",
            SizeKb = 9_800,
            Provides = new() { "yay" },
            ExtraRepo = Rec(arch: "aur"),
        },
        new PackageDef
        {
            Id = "snowfall",
            Names = Rec(arch: "snowfall"),
            Version = Rec(debian: "", arch: "2.0.1-1", redhat: ""),
            Description = "Let it snow in your terminal",
            SizeKb = 48,
            Provides = new() { "snowfall" },
            ExtraRepo = Rec(arch: "aur"),
        },
        // ----- Universella format (kapitlet "Flatpak, Snap och AppImage") -----
        new PackageDef
        {
            Id = "flatpak",
            Names = Same("flatpak"),
            Version = Rec(debian: "1.14.6-1ubuntu0.1", arch: "1:1.16.1-1", redhat: "1.16.1-1.fc43"),
            Description = "Application deployment framework for desktop apps (Flatpak)",
            SizeKb = 6_400,
            Provides = new() { "flatpak" },
            Base = new() { "redhat" },
        },
        new PackageDef
        {
            Id = "snapd",
            Names = Same("snapd"),
            Version = Rec(debian: "2.71+24.04", arch: "2.71-1", redhat: "2.71-1.fc43"),
            Description = "Daemon and tooling that enable snap packages",
            SizeKb = 98_000,
            Provides = new() { "snap" },
            BaseDistros = new() { "ubuntu" },
            // Snap finns inte i Archs officiella förråd – bara i AUR.
            ExtraRepo = Rec(arch: "aur"),
        },
        new PackageDef
        {
            Id = "fuse2",
            Names = Rec(debian: "libfuse2t64", arch: "fuse2", redhat: "fuse-libs"),
            Version = Rec(debian: "2.9.9-8.1build1", arch: "2.9.9-5", redhat: "2.9.9-24.fc43"),
            Description = "Filesystem in Userspace (FUSE) v2 library – needed to run AppImages",
            SizeKb = 330,
            Provides = new(),
        },
    };

    public static string? PackageName(PackageDef pkg, Family family) => pkg.Names.Get(family);

    /// <summary>
    /// Is the package in the repositories enabled in the shell? Packages from an extra repository
    /// (PPA, COPR) only show up once the repository has been added; AUR packages never (they are built
    /// with makepkg). Without a shell only the normal repositories count.
    /// </summary>
    public static bool InRepos(Shell? sh, PackageDef pkg)
    {
        var family = sh?.Distro.Family;
        if (string.IsNullOrEmpty(family) || pkg.ExtraRepo is null) return pkg.ExtraRepo is null;
        var repo = pkg.ExtraRepo.Get(family);
        return string.IsNullOrEmpty(repo) || ExtrarepoLib.ExtraRepoEnabled(sh!, repo);
    }

    /// <summary>The package is in the repositories or already installed.</summary>
    public static bool IsKnown(Shell? sh, PackageDef pkg) => InRepos(sh, pkg) || (sh is not null && IsInstalled(sh, pkg));

    public static PackageDef? FindPackage(Family family, string name, Shell? sh = null) =>
        Packages.FirstOrDefault(p => p.Names.Get(family) == name && IsKnown(sh, p));

    /// <summary>Packages that do not come from the distribution's own repositories (e.g. AUR – `pacman -Qm`).</summary>
    public static bool IsForeign(Family family, PackageDef pkg) => !string.IsNullOrEmpty(pkg.ExtraRepo?.Get(family));

    /// <summary>The package that provides a certain command (for "command not found" hints).</summary>
    public static PackageDef? PackageProviding(Family family, string command) =>
        Packages.FirstOrDefault(p =>
            !string.IsNullOrEmpty(p.Names.Get(family)) && p.Provides.Contains(command) && string.IsNullOrEmpty(p.ExtraRepo?.Get(family)));

    public static string AvailableVersion(Shell sh, PackageDef pkg)
    {
        var fam = sh.Distro.Family;
        var newV = pkg.NewVersion?.Get(fam);
        var v = sh.Flags.GetValue("repoSynced") == true && !string.IsNullOrEmpty(newV) ? newV : pkg.Version[fam];
        // Debian and Ubuntu share a family, but the version numbers look a little different.
        return sh.Distro.Id == "debian" ? v.Replace("ubuntu", "+deb13u", StringComparison.Ordinal) : v;
    }

    public static bool IsInstalled(Shell sh, PackageDef pkg) => sh.Installed.ContainsKey(pkg.Id);

    public static List<PackageDef> Upgradable(Shell sh) =>
        Packages.Where(p => IsInstalled(sh, p) && sh.Installed[p.Id] != AvailableVersion(sh, p)).ToList();

    public static List<PackageDef> SearchPackages(Family family, string query, Shell? sh = null)
    {
        var q = query.ToLowerInvariant();
        return Packages
            .Where(p =>
                !string.IsNullOrEmpty(p.Names.Get(family)) &&
                IsKnown(sh, p) &&
                (p.Names[family].ToLowerInvariant().Contains(q, StringComparison.Ordinal) ||
                 p.Description.ToLowerInvariant().Contains(q, StringComparison.Ordinal)))
            .ToList()
            .StableSort((a, b) => Js.LocaleCompare(a.Names[family], b.Names[family]));
    }

    /// <summary>Installs (or upgrades) the package: puts the commands in /usr/bin.</summary>
    public static void InstallPackage(Shell sh, PackageDef pkg)
    {
        sh.Installed[pkg.Id] = AvailableVersion(sh, pkg);
        foreach (var cmd in pkg.Provides) InstallCommand(sh, cmd);
        if (pkg.Shells is not null) UpdateEtcShells(sh, pkg.Shells, true);
    }

    /// <summary>Puts the package's commands in /usr/bin.</summary>
    public static void PlaceBinaries(Shell sh, PackageDef pkg)
    {
        foreach (var cmd in pkg.Provides) InstallCommand(sh, cmd);
    }

    /// <summary>Puts a simulated binary for the command in /usr/bin.</summary>
    public static void InstallCommand(Shell sh, string cmd)
    {
        var bin = sh.Vfs.Lookup("/usr/bin", sh.RootUser());
        var node = VfsLib.MakeFile($"{VfsLib.Elf}\u0002\u0001\u0001 (simulated binary: {cmd})", "root", cmd == "sudo" ? Js.Oct(4755) : Js.Oct(755));
        node.Size = 30_000 + ((cmd.Length * 7919L) % 150_000);
        bin.Children![cmd] = node;
    }

    /// <summary>Adds or removes shells in /etc/shells (as the packages' install scripts do).</summary>
    private static void UpdateEtcShells(Shell sh, List<string> shells, bool add)
    {
        var root = sh.RootUser();
        var node = sh.Vfs.TryLookup("/etc/shells", root);
        if (node?.Type != "file") return;
        var lines = (node.Content ?? "").Split('\n').Where(l => l != "" && !shells.Contains(l)).ToList();
        if (add) lines.AddRange(shells);
        node.Content = string.Join("\n", lines) + "\n";
    }

    public static void RemovePackage(Shell sh, PackageDef pkg)
    {
        sh.Installed.Remove(pkg.Id);
        var bin = sh.Vfs.Lookup("/usr/bin", sh.RootUser());
        foreach (var cmd in pkg.Provides) bin.Children!.Remove(cmd);
        if (pkg.Shells is not null) UpdateEtcShells(sh, pkg.Shells, false);
    }

    public static string FormatKb(double kb)
    {
        if (kb >= 1000)
        {
            var s = Js.ToFixed(kb / 1000, 1);
            var i = s.IndexOf(".0", StringComparison.Ordinal);
            if (i >= 0) s = s[..i] + s[(i + 2)..];
            return $"{s} MB";
        }
        return $"{Js.Num(kb)} kB";
    }

    public static string FormatMiB(double kb) => $"{Js.ToFixed(kb / 1024, 2)} MiB";
}
