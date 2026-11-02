using Codestead.Shell.Commands;

namespace Codestead.Shell;

// Port of src/shell/initfs.ts – builds the initial file system for a distribution: system
// directories, configuration files and a few exercise files in the home directory (see World.cs).

public static partial class InitfsLib
{
    /// <summary>What myserver has written to its log (programs write English, see World.cs).</summary>
    public const string ServerLog = """
        2026-10-28 08:00:01 INFO  Server starting
        2026-10-28 08:00:02 INFO  Reading configuration from /etc/myserver.conf
        2026-10-28 08:00:02 WARN  Configuration key "timeout" is missing, using 30s
        2026-10-28 08:00:03 INFO  Listening on port 8080
        2026-10-28 09:14:55 INFO  GET /index.html 200
        2026-10-28 09:15:10 ERROR Could not connect to the database
        2026-10-28 09:15:11 INFO  Trying again in 5 seconds
        2026-10-28 09:15:16 INFO  Connected to the database
        2026-10-28 11:42:03 WARN  Slow request: GET /report took 4.2s
        2026-10-28 12:01:37 INFO  GET /about.html 200
        2026-10-28 13:30:00 ERROR Disk /var is 95% full
        2026-10-28 14:05:12 INFO  GET /images/logo.png 404
        2026-10-28 16:20:44 warn  Certificate expires in 14 days
        2026-10-28 18:00:00 ERROR Time limit exceeded for job "backup"
        2026-10-28 23:59:59 INFO  Rotating today's logs

        """;

    public const string Bashrc = """
        # ~/.bashrc: executed by bash for interactive shells.
        # This is where aliases and your own settings usually go.

        # Examples:
        # alias ll='ls -la'
        # export EDITOR=nano

        """;

    public const string Profile = """
        # ~/.profile: executed by login shells.
        if [ -d "$HOME/bin" ] ; then
            PATH="$HOME/bin:$PATH"
        fi

        """;

    private const string WebStyle = """
        body {
          font-family: sans-serif;
          background: white;
          color: black;
        }

        h1 {
          color: navy;
        }

        """;

    private const string LoginDefs =
        "# /etc/login.defs - settings for useradd, passwd and others (excerpt)\n" +
        "PASS_MAX_DAYS\t99999\n" +
        "PASS_MIN_DAYS\t0\n" +
        "PASS_WARN_AGE\t7\n" +
        "UID_MIN\t\t\t 1000\n" +
        "UID_MAX\t\t\t60000\n" +
        "SYS_UID_MIN\t\t  100\n" +
        "SYS_UID_MAX\t\t  999\n" +
        "GID_MIN\t\t\t 1000\n" +
        "GID_MAX\t\t\t60000\n" +
        "USERGROUPS_ENAB yes\n" +
        "ENCRYPT_METHOD YESCRYPT\n";

    // d(...) and f(...) in the TypeScript.
    private static FsNode D(string owner = "root", int mode = -1, OrderedDictionary<string, FsNode>? children = null, string? group = null) =>
        VfsLib.MakeDir(owner, mode, children, group);

    private static FsNode F(string content = "", string owner = "root", int mode = -1, string? group = null) =>
        VfsLib.MakeFile(content, owner, mode, group);

    /// <summary>An object literal of children, in insertion order.</summary>
    private static OrderedDictionary<string, FsNode> Ch(params (string Name, FsNode Node)[] items)
    {
        var o = Js.Obj<FsNode>();
        foreach (var (name, node) in items) o[name] = node;
        return o;
    }

    private static OrderedDictionary<string, FsNode> FamilyEtc(Distro distro)
    {
        switch (distro.Family)
        {
            case "debian":
            {
                var sourcesName = distro.Id == "ubuntu" ? "ubuntu.sources" : "debian.sources";
                var uri = distro.Id == "ubuntu" ? "http://archive.ubuntu.com/ubuntu" : "http://deb.debian.org/debian";
                var comps = distro.Id == "ubuntu" ? "main restricted universe multiverse" : "main contrib non-free-firmware";
                return Ch(
                    ("apt", D("root", Js.Oct(755), Ch(
                        ("sources.list.d", D("root", Js.Oct(755), Ch(
                            (sourcesName, F(
                                $"Types: deb\nURIs: {uri}\nSuites: {distro.Codename} {distro.Codename}-updates\nComponents: {comps}\nSigned-By: /usr/share/keyrings/{distro.Id}-archive-keyring.gpg\n"))))),
                        ("apt.conf.d", D())))));
            }
            case "arch":
                return Ch(
                    ("pacman.conf", F(
                        "#\n# /etc/pacman.conf\n#\n[options]\nHoldPkg     = pacman glibc\nArchitecture = auto\nColor\nParallelDownloads = 5\nSigLevel    = Required DatabaseOptional\n\n[core]\nInclude = /etc/pacman.d/mirrorlist\n\n[extra]\nInclude = /etc/pacman.d/mirrorlist\n")),
                    ("pacman.d", D("root", Js.Oct(755), Ch(
                        ("mirrorlist", F(
                            "## Arch Linux repository mirrorlist\n## Sweden\nServer = https://ftp.lysator.liu.se/pub/archlinux/$repo/os/$arch\nServer = https://mirror.osbeck.com/archlinux/$repo/os/$arch\n"))))));
            case "redhat":
                return Ch(
                    ("dnf", D("root", Js.Oct(755), Ch(("dnf.conf", F("[main]\ngpgcheck=True\ninstallonly_limit=3\nclean_requirements_on_remove=True\nbest=False\nskip_if_unavailable=True\n"))))),
                    ("yum.repos.d", D("root", Js.Oct(755), Ch(
                        ("fedora.repo", F(
                            "[fedora]\nname=Fedora $releasever - $basearch\nmetalink=https://mirrors.fedoraproject.org/metalink?repo=fedora-$releasever&arch=$basearch\nenabled=1\ngpgcheck=1\n")),
                        ("fedora-updates.repo", F(
                            "[updates]\nname=Fedora $releasever - $basearch - Updates\nmetalink=https://mirrors.fedoraproject.org/metalink?repo=updates-released-f$releasever&arch=$basearch\nenabled=1\ngpgcheck=1\n"))))));
            default:
                throw new ArgumentException($"Unknown family: {distro.Family}");
        }
    }

    private static OrderedDictionary<string, FsNode> FamilyLogs(Distro distro)
    {
        switch (distro.Family)
        {
            case "debian":
                return Ch(
                    ("apt", D("root", Js.Oct(755), Ch(
                        ("history.log", F("\nStart-Date: 2026-10-20  10:12:01\nCommandline: apt install sudo\nInstall: sudo:amd64\nEnd-Date: 2026-10-20  10:12:04\n"))))),
                    ("dpkg.log", F("2026-10-20 10:12:03 install sudo:amd64 <none>\n2026-10-20 10:12:04 status installed sudo:amd64\n")));
            case "arch":
                return Ch(
                    ("pacman.log", F("[2026-10-20T10:12:01+0200] [PACMAN] Running 'pacman -S --needed base sudo'\n[2026-10-20T10:12:04+0200] [ALPM] installed sudo\n")));
            case "redhat":
                return Ch(
                    ("dnf5.log", F("2026-10-20T10:12:01+0200 [1234] INFO --- DNF5 launched with arguments: \"dnf install sudo\" ---\n")));
            default:
                throw new ArgumentException($"Unknown family: {distro.Family}");
        }
    }

    /// <summary>System users (UID below 1000) – programs and services, not people.</summary>
    private static List<string> SystemUsers(Distro distro) => distro.Family switch
    {
        "debian" => new()
        {
            "root:x:0:0:root:/root:/bin/bash",
            "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin",
            "bin:x:2:2:bin:/bin:/usr/sbin/nologin",
            "sys:x:3:3:sys:/dev:/usr/sbin/nologin",
            "sync:x:4:65534:sync:/bin:/bin/sync",
            "mail:x:8:8:mail:/var/mail:/usr/sbin/nologin",
            "www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin",
            "nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin",
            "systemd-network:x:998:998:systemd Network Management:/:/usr/sbin/nologin",
            "messagebus:x:100:101::/nonexistent:/usr/sbin/nologin",
            "syslog:x:102:102::/nonexistent:/usr/sbin/nologin",
        },
        "arch" => new()
        {
            "root:x:0:0::/root:/usr/bin/bash",
            "bin:x:1:1::/:/usr/bin/nologin",
            "daemon:x:2:2::/:/usr/bin/nologin",
            "mail:x:8:12::/var/spool/mail:/usr/bin/nologin",
            "ftp:x:14:11::/srv/ftp:/usr/bin/nologin",
            "http:x:33:33::/srv/http:/usr/bin/nologin",
            "nobody:x:65534:65534:Kernel Overflow User:/:/usr/bin/nologin",
            "dbus:x:81:81:System Message Bus:/:/usr/bin/nologin",
            "systemd-network:x:982:982:systemd Network Management:/:/usr/bin/nologin",
        },
        "redhat" => new()
        {
            "root:x:0:0:Super User:/root:/bin/bash",
            "bin:x:1:1:bin:/bin:/usr/sbin/nologin",
            "daemon:x:2:2:daemon:/sbin:/usr/sbin/nologin",
            "adm:x:3:4:adm:/var/adm:/usr/sbin/nologin",
            "mail:x:8:12:mail:/var/spool/mail:/usr/sbin/nologin",
            "nobody:x:65534:65534:Kernel Overflow User:/:/usr/sbin/nologin",
            "dbus:x:81:81:System Message Bus:/:/usr/sbin/nologin",
            "systemd-network:x:192:192:systemd Network Management:/:/usr/sbin/nologin",
        },
        _ => throw new ArgumentException($"Unknown family: {distro.Family}"),
    };

    /// <summary>System groups. The admin group (sudo/wheel) gets the student as a member in BuildFs.</summary>
    private static List<string> SystemGroups(Distro distro)
    {
        var admin = $"{distro.AdminGroup}:x:{distro.AdminGid}:";
        return distro.Family switch
        {
            "debian" => new()
            {
                "root:x:0:", "daemon:x:1:", "bin:x:2:", "sys:x:3:", "adm:x:4:syslog", "tty:x:5:", "mail:x:8:", "www-data:x:33:",
                admin, "shadow:x:42:", "users:x:100:", "nogroup:x:65534:", "systemd-network:x:998:", "messagebus:x:101:", "syslog:x:102:",
            },
            "arch" => new()
            {
                "root:x:0:root", "sys:x:3:bin", "mem:x:8:", "ftp:x:11:", "mail:x:12:", "log:x:19:", "http:x:33:", "tty:x:5:",
                "bin:x:1:daemon", "daemon:x:2:bin", "dbus:x:81:", "nobody:x:65534:", admin, "adm:x:999:daemon", "users:x:984:",
                "systemd-network:x:982:",
            },
            "redhat" => new()
            {
                "root:x:0:", "bin:x:1:", "daemon:x:2:", "sys:x:3:", "adm:x:4:", "tty:x:5:", "mail:x:12:", admin, "users:x:100:",
                "nobody:x:65534:", "dbus:x:81:", "systemd-network:x:192:",
            },
            _ => throw new ArgumentException($"Unknown family: {distro.Family}"),
        };
    }

    /// <summary>The exercise files in the student's home directory, in the language of the world.</summary>
    public static FsNode BuildHome(World w)
    {
        var u = w.User;
        var ug = w.User;
        return D(u, Js.Oct(750), Ch(
            (".bashrc", F(Bashrc, u, Js.Oct(644), ug)),
            (".profile", F(Profile, u, Js.Oct(644), ug)),
            (w["notes"], F(w.File("notes"), u, Js.Oct(644), ug)),
            (w["documents"], D(u, Js.Oct(755), Ch(
                (w["grades"], F(w.File("grades"), u, Js.Oct(644), ug)),
                (w["fruits"], F(w.File("fruits"), u, Js.Oct(644), ug)),
                ("server.log", F(ServerLog, u, Js.Oct(644), ug))), ug)),
            (w["old"], D(u, Js.Oct(755), Ch(
                (w["oldNotes"], F(w.File("oldNotes"), u, Js.Oct(644), ug)),
                (w["backup"], F(w.File("backup"), u, Js.Oct(644), ug)),
                (w["archive"], D(u, Js.Oct(755), Ch((w["oldLog"], F(w.File("oldLog"), u, Js.Oct(644), ug))), ug))), ug)),
            (w["pictures"], D(u, Js.Oct(755), Ch(), ug)),
            (w["webProject"], D(u, Js.Oct(755), Ch(
                ("index.html", F(w.File("webIndex"), u, Js.Oct(644), ug)),
                ("style.css", F(WebStyle, u, Js.Oct(644), ug)),
                ("README.md", F(w.File("webReadme"), u, Js.Oct(644), ug))), ug)),
            // A downloaded AppImage (chapter "Flatpak, Snap and AppImage").
            (w["downloads"], D(u, Js.Oct(755), Ch((w["calculator"], UniversalCmd.AppImageNode(w, u, ug))), ug))), ug);
    }

    public static FsNode BuildFs(Distro distro, World w)
    {
        var u = w.User;
        var home = BuildHome(w);

        // Users and groups (see users.ts). The system users differ a little between the families.
        var passwd = string.Join("\n", [.. SystemUsers(distro), $"{u}:x:1000:1000:{w["userFull"]},,,:/home/{u}:/bin/bash"]) + "\n";

        var group = string.Join("\n", [
            .. SystemGroups(distro).Select(g => g.StartsWith($"{distro.AdminGroup}:", StringComparison.Ordinal) ? g + u : g),
            $"{u}:x:1000:",
        ]) + "\n";

        var shadowMode = distro.Family switch
        {
            "debian" => Js.Oct(640),
            "arch" => Js.Oct(600),
            _ => 0,
        };

        var etcChildren = Ch(
            ("hostname", F($"{distro.Hostname}\n")),
            ("os-release", F(distro.OsRelease)),
            ("passwd", F(passwd)),
            ("group", F(group)),
            ("shadow", F(
                string.Concat(SystemUsers(distro).Select(l => $"{l.Split(':')[0]}:*:20000:0:99999:7:::\n")) +
                    $"{u}:$y$j9T$Qm1x...simulated...hash:20000:0:99999:7:::\n",
                "root",
                shadowMode,
                distro.Family == "debian" ? "shadow" : "root")),
            ("login.defs", F(LoginDefs + (distro.Family == "redhat" ? "CREATE_HOME\tyes\n" : ""))),
            ("skel", D("root", Js.Oct(755), Ch((".bashrc", F(Bashrc)), (".profile", F(Profile))))),
            ("sudoers", F(
                $"# See sudoers(5). Always edit with visudo!\nDefaults\tenv_reset\nroot\tALL=(ALL:ALL) ALL\n%{distro.AdminGroup}\tALL=(ALL:ALL) ALL\n",
                "root",
                Js.Oct(440))),
            ("hosts", F($"127.0.0.1\tlocalhost\n127.0.1.1\t{distro.Hostname}\n::1\t\tlocalhost ip6-localhost ip6-loopback\n")),
            ("fstab", F(DisksLib.FstabFor(distro))),
            ("shells", F("/bin/sh\n/bin/bash\n/usr/bin/bash\n")),
            ("resolv.conf", F(NetworkLib.ResolvConf(distro))),
            ("nsswitch.conf", F("passwd:         files\ngroup:          files\nshadow:         files\n\nhosts:          files dns\nnetworks:       files\n")));
        foreach (var kv in FamilyEtc(distro)) etcChildren[kv.Key] = kv.Value;
        var etc = D("root", Js.Oct(755), etcChildren);

        return D("root", Js.Oct(755), Ch(
            ("boot", D("root", Js.Oct(755), Ch(
                ($"vmlinuz-{distro.Kernel}", F("(the kernel - simulated)\n", "root", Js.Oct(600)))))),
            ("dev", D("root", Js.Oct(755), Ch(("null", F("", "root", Js.Oct(666)))))),
            ("etc", etc),
            ("home", D("root", Js.Oct(755), Ch((u, home)))),
            ("media", D()),
            ("mnt", D()),
            ("opt", D()),
            ("proc", D("root", Js.Oct(555), Ch(
                ("version", F($"Linux version {distro.Kernel} (simulated) #1 SMP PREEMPT_DYNAMIC\n", "root", Js.Oct(444))),
                ("cpuinfo", F("processor\t: 0\nvendor_id\t: GenuineIntel\nmodel name\t: Simulated CPU @ 3.00GHz\ncpu cores\t: 4\n", "root", Js.Oct(444)))))),
            ("root", D("root", Js.Oct(700), Ch((".bashrc", F(Bashrc))))),
            ("srv", D()),
            ("tmp", D("root", Js.Oct(1777))),
            ("usr", D("root", Js.Oct(755), Ch(
                ("bin", D()),
                ("lib", D()),
                ("local", D("root", Js.Oct(755), Ch(("bin", D("root", Js.Oct(755), Ch(("myserver", NetworkLib.MyserverBinary()))))))),
                ("sbin", D()),
                ("share", D("root", Js.Oct(755), Ch(("doc", D()), ("man", D()))))))),
            ("var", D("root", Js.Oct(755), Ch(
                ("cache", D()),
                ("lib", D()),
                ("log", D("root", Js.Oct(755), FamilyLogs(distro))),
                ("tmp", D("root", Js.Oct(1777))))))));
    }
}
