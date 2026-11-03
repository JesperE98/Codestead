using Codestead.Shell.Commands;

namespace Codestead.Shell;

/// <summary>
/// Real Linux commands that the simulator does not have. When one of them is typed, the simulator says so
/// (after the real "command not found"), so the learner knows it is not their mistake. Commands the simulator
/// has, or that are in one of its packages, are never listed here (a test checks it).
/// </summary>
public static class KnownCommands
{
    public static readonly IReadOnlySet<string> Real = new HashSet<string>(StringComparer.Ordinal)
    {
        "nvim", "emacs", "pico", "micro", "joe", "most", "bat", "fzf", "rg", "ag",
        "ack", "fd", "exa", "eza", "lsd", "ncdu", "btop", "glances", "iotop", "iftop",
        "nethogs", "atop", "dstat", "vmstat", "iostat", "mpstat", "sar", "strace", "ltrace", "gdb",
        "lsof", "fuser", "pidof", "nice", "renice", "ionice", "taskset", "timeout", "screen", "tmux",
        "byobu", "at", "batch", "atq", "atrm", "anacron", "logrotate", "dmesg", "lspci", "lsusb",
        "lscpu", "lshw", "dmidecode", "hwinfo", "inxi", "neofetch", "sensors", "smartctl", "hdparm", "parted",
        "gparted", "mkfs.xfs", "mkswap", "fsck", "e2fsck", "tune2fs", "resize2fs", "lvcreate", "lvextend", "pvcreate",
        "vgcreate", "mdadm", "cryptsetup", "losetup", "blockdev", "ufw", "iptables", "ip6tables", "nft", "firewall-cmd",
        "fail2ban-client", "netstat", "ifconfig", "route", "arp", "iwconfig", "iw", "nmcli", "nmtui", "ethtool",
        "tcpdump", "wireshark", "tshark", "nc", "netcat", "ncat", "socat", "telnet", "ftp", "sftp",
        "lftp", "mtr", "whois", "openssl", "gpg", "ssh-agent", "ssh-add", "sshd", "nginx", "apache2",
        "httpd", "mysql", "psql", "sqlite3", "redis-cli", "mongosh", "node", "npm", "npx", "yarn",
        "pnpm", "deno", "bun", "pip", "pip3", "pipx", "python", "python2", "ruby", "gem",
        "perl", "php", "java", "javac", "mvn", "gradle", "gcc", "g++", "cc", "clang",
        "make", "cmake", "ninja", "rustc", "cargo", "dotnet", "lua", "julia", "gawk", "mawk",
        "bc", "dc", "expr", "factor", "numfmt", "units", "cal", "ncal", "timedatectl", "localectl",
        "loginctl", "dpkg-reconfigure", "rpm", "zypper", "apk", "emerge", "nix", "brew", "ansible", "terraform",
        "vagrant", "virsh", "qemu-system-x86_64", "VBoxManage", "docker", "docker-compose", "podman", "kubectl", "helm", "minikube",
        "aws", "gcloud", "az", "gh", "git-lfs", "svn", "hg", "rclone", "restic", "borg",
        "duplicity", "7z", "rar", "unrar", "xz", "unxz", "bzip2", "bunzip2", "zstd", "lz4",
        "cpio", "ar", "dd", "shred", "wipefs", "badblocks", "sha256sum", "md5sum", "sha1sum", "sha512sum",
        "base64", "xxd", "hexdump", "od", "strings", "diff", "patch", "cmp", "comm", "join",
        "paste", "column", "fold", "fmt", "nl", "rev", "tac", "split", "csplit", "shuf",
        "yes", "envsubst", "iconv", "dos2unix", "unix2dos", "locate", "updatedb", "whereis", "apropos", "whatis",
        "info", "tldr", "ranger", "mc", "nnn", "xdg-open", "notify-send", "xclip", "xsel", "wl-copy",
        "feh", "mpv", "ffmpeg", "convert", "yt-dlp", "http", "aria2c", "lynx", "w3m", "links",
        "elinks", "mutt", "neomutt", "mail", "sendmail", "visudo", "sudoedit", "chroot", "chattr", "lsattr",
        "setfacl", "getfacl", "sestatus", "getenforce", "setenforce", "aa-status", "auditctl", "lastb", "faillog", "wall",
        "write", "mesg", "finger", "pinky", "users", "newgrp", "sg", "nproc", "arch", "tty",
        "stty", "sha224sum", "cksum", "truncate", "mktemp", "install", "tput", "dircolors", "mkfifo", "mknod",
        "link", "unlink", "sum", "expand", "unexpand", "pr", "ptx", "tsort", "pathchk", "logname",
        "hostid", "lsmod", "modprobe", "insmod", "rmmod", "depmod", "sysctl", "update-grub", "grub-install", "efibootmgr",
        "dracut", "mkinitcpio", "update-initramfs", "shutdown", "poweroff", "halt", "init", "runlevel", "telinit", "crontab-e",
        "jq", "yq", "nmap", "masscan", "nikto", "sqlmap", "hydra", "john", "hashcat", "aircrack-ng",
        "metasploit", "msfconsole",
    };

    /// <summary>A real command that cannot be run in the simulator at all.</summary>
    public static bool NotInSimulator(string name) => Real.Contains(name) && !IndexCmd.Commands.ContainsKey(name);
}
