// Port of InitfsLib.cs (src/shell/initfs.ts) – builds the initial file system for a distribution: system
// directories, configuration files and a few exercise files in the home directory (see World.ts).

import * as UniversalCmd from "./Commands/Universal/UniversalCmd.js";
import * as DisksLib from "./Disks/DisksLib.js";
import type { Distro } from "./Distros/Distro.js";
import { Js, type Obj } from "./Js.js";
import * as NetworkLib from "./Network/NetworkLib.js";
import type { FsNode } from "./Vfs/FsNode.js";
import * as VfsLib from "./Vfs/VfsLib.js";
import type { World } from "./World.js";

/** What myserver has written to its log (programs write English, see World.ts). */
export const ServerLog = "2026-10-28 08:00:01 INFO  Server starting\n2026-10-28 08:00:02 INFO  Reading configuration from /etc/myserver.conf\n2026-10-28 08:00:02 WARN  Configuration key \"timeout\" is missing, using 30s\n2026-10-28 08:00:03 INFO  Listening on port 8080\n2026-10-28 09:14:55 INFO  GET /index.html 200\n2026-10-28 09:15:10 ERROR Could not connect to the database\n2026-10-28 09:15:11 INFO  Trying again in 5 seconds\n2026-10-28 09:15:16 INFO  Connected to the database\n2026-10-28 11:42:03 WARN  Slow request: GET /report took 4.2s\n2026-10-28 12:01:37 INFO  GET /about.html 200\n2026-10-28 13:30:00 ERROR Disk /var is 95% full\n2026-10-28 14:05:12 INFO  GET /images/logo.png 404\n2026-10-28 16:20:44 warn  Certificate expires in 14 days\n2026-10-28 18:00:00 ERROR Time limit exceeded for job \"backup\"\n2026-10-28 23:59:59 INFO  Rotating today's logs\n";

export const Bashrc = "# ~/.bashrc: executed by bash for interactive shells.\n# This is where aliases and your own settings usually go.\n\n# Examples:\n# alias ll='ls -la'\n# export EDITOR=nano\n";

export const Profile = "# ~/.profile: executed by login shells.\nif [ -d \"$HOME/bin\" ] ; then\n    PATH=\"$HOME/bin:$PATH\"\nfi\n";

const WebStyle = "body {\n  font-family: sans-serif;\n  background: white;\n  color: black;\n}\n\nh1 {\n  color: navy;\n}\n";

const LoginDefs =
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

// d(...) and f(...) in the TypeScript original.
function D(owner = "root", mode = -1, children: Obj<FsNode> | null = null, group: string | null = null): FsNode {
  return VfsLib.makeDir(owner, mode, children, group);
}

function F(content = "", owner = "root", mode = -1, group: string | null = null): FsNode {
  return VfsLib.makeFile(content, owner, mode, group);
}

/** An object literal of children, in insertion order. */
function Ch(...items: [string, FsNode][]): Obj<FsNode> {
  return new Map(items);
}

const CronPlaceholder = "# DO NOT EDIT OR REMOVE\n# This file is a simple placeholder to keep dpkg from removing this directory\n";

/** The system crontab of Debian and Ubuntu (it has a user name before each command). */
export const DebianCrontab = "# /etc/crontab: system-wide crontab\n# Unlike any other crontab you don't have to run the `crontab'\n# command to install the new version when you edit this file\n# and files in /etc/cron.d. These files also have username fields,\n# that none of the other crontabs do.\n\nSHELL=/bin/sh\n# You can also override PATH, but by default, newer versions inherit it from the environment\n#PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n\n# Example of job definition:\n# .---------------- minute (0 - 59)\n# |  .------------- hour (0 - 23)\n# |  |  .---------- day of month (1 - 31)\n# |  |  |  .------- month (1 - 12) OR jan,feb,mar,apr ...\n# |  |  |  |  .---- day of week (0 - 6) (Sunday=0 or 7) OR sun,mon,tue,wed,thu,fri,sat\n# |  |  |  |  |\n# *  *  *  *  * user-name command to be executed\n17 *\t* * *\troot\tcd / && run-parts --report /etc/cron.hourly\n25 6\t* * *\troot\ttest -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.daily; }\n47 6\t* * 7\troot\ttest -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.weekly; }\n52 6\t1 * *\troot\ttest -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.monthly; }\n#\n";

export const FedoraCrontab = "SHELL=/bin/bash\nPATH=/sbin:/bin:/usr/sbin:/usr/bin\nMAILTO=root\n\n# For details see man 4 crontabs\n\n# Example of job definition:\n# .---------------- minute (0 - 59)\n# |  .------------- hour (0 - 23)\n# |  |  .---------- day of month (1 - 31)\n# |  |  |  .------- month (1 - 12) OR jan,feb,mar,apr ...\n# |  |  |  |  .---- day of week (0 - 6) (Sunday=0 or 7) OR sun,mon,tue,wed,thu,fri,sat\n# |  |  |  |  |\n# *  *  *  *  * user-name  command to be executed\n";

function familyEtc(distro: Distro): Obj<FsNode> {
  switch (distro.family) {
    case "debian": {
      const sourcesName = distro.id === "ubuntu" ? "ubuntu.sources" : "debian.sources";
      const uri = distro.id === "ubuntu" ? "http://archive.ubuntu.com/ubuntu" : "http://deb.debian.org/debian";
      const comps = distro.id === "ubuntu" ? "main restricted universe multiverse" : "main contrib non-free-firmware";
      return Ch(
        [
          "apt",
          D(
            "root",
            Js.oct(755),
            Ch(
              [
                "sources.list.d",
                D(
                  "root",
                  Js.oct(755),
                  Ch([
                    sourcesName,
                    F(
                      `Types: deb\nURIs: ${uri}\nSuites: ${distro.codename ?? ""} ${distro.codename ?? ""}-updates\nComponents: ${comps}\nSigned-By: /usr/share/keyrings/${distro.id}-archive-keyring.gpg\n`,
                    ),
                  ]),
                ),
              ],
              ["apt.conf.d", D()],
            ),
          ),
        ],
        ["crontab", F(DebianCrontab)],
        ["cron.d", D("root", Js.oct(755), Ch([".placeholder", F(CronPlaceholder)]))],
        ["cron.hourly", D("root", Js.oct(755), Ch([".placeholder", F(CronPlaceholder)]))],
        [
          "cron.daily",
          D(
            "root",
            Js.oct(755),
            Ch(
              ["apt-compat", F("#!/bin/sh\n# Updates the package lists and cleans the cache (apt).\nexec /usr/lib/apt/apt.systemd.daily\n", "root", Js.oct(755))],
              ["dpkg", F("#!/bin/sh\n# Backs up the package database (dpkg).\ndpkg-db-backup\n", "root", Js.oct(755))],
              ["logrotate", F("#!/bin/sh\n# Rotates the log files in /var/log.\n/usr/sbin/logrotate /etc/logrotate.conf\n", "root", Js.oct(755))],
              ["man-db", F("#!/bin/sh\n# Updates the index of the manual pages.\nmandb --quiet\n", "root", Js.oct(755))],
            ),
          ),
        ],
        ["cron.weekly", D("root", Js.oct(755), Ch(["man-db", F("#!/bin/sh\n# Cleans old cached manual pages.\nmandb --quiet\n", "root", Js.oct(755))]))],
        ["cron.monthly", D("root", Js.oct(755), Ch([".placeholder", F(CronPlaceholder)]))],
      );
    }
    case "arch":
      return Ch(
        [
          "pacman.conf",
          F(
            "#\n# /etc/pacman.conf\n#\n[options]\nHoldPkg     = pacman glibc\nArchitecture = auto\nColor\nParallelDownloads = 5\nSigLevel    = Required DatabaseOptional\n\n[core]\nInclude = /etc/pacman.d/mirrorlist\n\n[extra]\nInclude = /etc/pacman.d/mirrorlist\n",
          ),
        ],
        [
          "pacman.d",
          D(
            "root",
            Js.oct(755),
            Ch([
              "mirrorlist",
              F("## Arch Linux repository mirrorlist\n## Sweden\nServer = https://ftp.lysator.liu.se/pub/archlinux/$repo/os/$arch\nServer = https://mirror.osbeck.com/archlinux/$repo/os/$arch\n"),
            ]),
          ),
        ],
      );
    case "redhat":
      return Ch(
        ["dnf", D("root", Js.oct(755), Ch(["dnf.conf", F("[main]\ngpgcheck=True\ninstallonly_limit=3\nclean_requirements_on_remove=True\nbest=False\nskip_if_unavailable=True\n")]))],
        [
          "yum.repos.d",
          D(
            "root",
            Js.oct(755),
            Ch(
              [
                "fedora.repo",
                F("[fedora]\nname=Fedora $releasever - $basearch\nmetalink=https://mirrors.fedoraproject.org/metalink?repo=fedora-$releasever&arch=$basearch\nenabled=1\ngpgcheck=1\n"),
              ],
              [
                "fedora-updates.repo",
                F(
                  "[updates]\nname=Fedora $releasever - $basearch - Updates\nmetalink=https://mirrors.fedoraproject.org/metalink?repo=updates-released-f$releasever&arch=$basearch\nenabled=1\ngpgcheck=1\n",
                ),
              ],
            ),
          ),
        ],
        ["crontab", F(FedoraCrontab)],
        ["cron.d", D("root", Js.oct(755), Ch(["0hourly", F("# Run the hourly jobs\nSHELL=/bin/bash\nPATH=/sbin:/bin:/usr/sbin:/usr/bin\nMAILTO=root\n01 * * * * root run-parts /etc/cron.hourly\n")]))],
        ["cron.hourly", D("root", Js.oct(755), Ch(["0anacron", F("#!/usr/bin/sh\n# Runs the daily, weekly and monthly jobs (anacron).\nexec /usr/sbin/anacron -s\n", "root", Js.oct(755))]))],
        ["cron.daily", D()],
        ["cron.weekly", D()],
        ["cron.monthly", D()],
      );
    default:
      throw new Error(`Unknown family: ${distro.family}`);
  }
}

function familyLogs(distro: Distro): Obj<FsNode> {
  switch (distro.family) {
    case "debian":
      return Ch(
        ["apt", D("root", Js.oct(755), Ch(["history.log", F("\nStart-Date: 2026-10-20  10:12:01\nCommandline: apt install sudo\nInstall: sudo:amd64\nEnd-Date: 2026-10-20  10:12:04\n")]))],
        ["dpkg.log", F("2026-10-20 10:12:03 install sudo:amd64 <none>\n2026-10-20 10:12:04 status installed sudo:amd64\n")],
      );
    case "arch":
      return Ch(["pacman.log", F("[2026-10-20T10:12:01+0200] [PACMAN] Running 'pacman -S --needed base sudo'\n[2026-10-20T10:12:04+0200] [ALPM] installed sudo\n")]);
    case "redhat":
      return Ch(["dnf5.log", F('2026-10-20T10:12:01+0200 [1234] INFO --- DNF5 launched with arguments: "dnf install sudo" ---\n')]);
    default:
      throw new Error(`Unknown family: ${distro.family}`);
  }
}

/** System users (UID below 1000) – programs and services, not people. */
function systemUsers(distro: Distro): string[] {
  switch (distro.family) {
    case "debian":
      return [
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
      ];
    case "arch":
      return [
        "root:x:0:0::/root:/usr/bin/bash",
        "bin:x:1:1::/:/usr/bin/nologin",
        "daemon:x:2:2::/:/usr/bin/nologin",
        "mail:x:8:12::/var/spool/mail:/usr/bin/nologin",
        "ftp:x:14:11::/srv/ftp:/usr/bin/nologin",
        "http:x:33:33::/srv/http:/usr/bin/nologin",
        "nobody:x:65534:65534:Kernel Overflow User:/:/usr/bin/nologin",
        "dbus:x:81:81:System Message Bus:/:/usr/bin/nologin",
        "systemd-network:x:982:982:systemd Network Management:/:/usr/bin/nologin",
      ];
    case "redhat":
      return [
        "root:x:0:0:Super User:/root:/bin/bash",
        "bin:x:1:1:bin:/bin:/usr/sbin/nologin",
        "daemon:x:2:2:daemon:/sbin:/usr/sbin/nologin",
        "adm:x:3:4:adm:/var/adm:/usr/sbin/nologin",
        "mail:x:8:12:mail:/var/spool/mail:/usr/sbin/nologin",
        "nobody:x:65534:65534:Kernel Overflow User:/:/usr/sbin/nologin",
        "dbus:x:81:81:System Message Bus:/:/usr/sbin/nologin",
        "systemd-network:x:192:192:systemd Network Management:/:/usr/sbin/nologin",
      ];
    default:
      throw new Error(`Unknown family: ${distro.family}`);
  }
}

/**
 * System groups. The admin group (sudo/wheel) gets the student as a member in buildFs. The Debian family has the
 * static groups of base-passwd (backup, cdrom, plugdev ...), Fedora those of the setup package and Arch those of the
 * filesystem package (no backup group in either). Shell.addMissingDefaults adds the ones a saved terminal lacks.
 */
export function systemGroups(distro: Distro): string[] {
  const admin = `${distro.adminGroup}:x:${distro.adminGid}:`;
  switch (distro.family) {
    case "debian":
      return [
        "root:x:0:", "daemon:x:1:", "bin:x:2:", "sys:x:3:", "adm:x:4:syslog", "tty:x:5:", "disk:x:6:", "lp:x:7:", "mail:x:8:",
        "news:x:9:", "uucp:x:10:", "man:x:12:", "proxy:x:13:", "kmem:x:15:", "dialout:x:20:", "fax:x:21:", "voice:x:22:",
        "cdrom:x:24:", "floppy:x:25:", "tape:x:26:", admin, "audio:x:29:", "dip:x:30:", "www-data:x:33:", "backup:x:34:",
        "operator:x:37:", "list:x:38:", "irc:x:39:", "src:x:40:", "shadow:x:42:", "utmp:x:43:", "video:x:44:", "sasl:x:45:",
        "plugdev:x:46:", "staff:x:50:", "games:x:60:", "users:x:100:", "nogroup:x:65534:", "systemd-journal:x:999:",
        "systemd-network:x:998:", "messagebus:x:101:", "syslog:x:102:",
      ];
    case "arch":
      return [
        "root:x:0:root", "sys:x:3:bin", "mem:x:8:", "ftp:x:11:", "mail:x:12:", "log:x:19:", "http:x:33:", "tty:x:5:",
        "bin:x:1:daemon", "daemon:x:2:bin", "dbus:x:81:", "nobody:x:65534:", admin, "adm:x:999:daemon", "utmp:x:997:",
        "audio:x:996:", "disk:x:995:", "input:x:994:", "kmem:x:993:", "kvm:x:992:", "lp:x:991:", "optical:x:990:",
        "render:x:989:", "storage:x:987:", "uucp:x:986:", "video:x:985:", "users:x:984:", "systemd-network:x:982:",
        "systemd-journal:x:190:",
      ];
    case "redhat":
      return [
        "root:x:0:", "bin:x:1:", "daemon:x:2:", "sys:x:3:", "adm:x:4:", "tty:x:5:", "disk:x:6:", "lp:x:7:", "mem:x:8:",
        "kmem:x:9:", admin, "cdrom:x:11:", "mail:x:12:", "man:x:15:", "dialout:x:18:", "floppy:x:19:", "games:x:20:",
        "tape:x:33:", "video:x:39:", "ftp:x:50:", "lock:x:54:", "audio:x:63:", "users:x:100:", "nobody:x:65534:", "dbus:x:81:",
        "systemd-network:x:192:", "systemd-journal:x:190:",
      ];
    default:
      throw new Error(`Unknown family: ${distro.family}`);
  }
}

/** The exercise files in the student's home directory, in the language of the world. */
export function buildHome(w: World): FsNode {
  const u = w.user;
  const ug = w.user;
  return D(
    u,
    Js.oct(750),
    Ch(
      [".bashrc", F(Bashrc, u, Js.oct(644), ug)],
      [".profile", F(Profile, u, Js.oct(644), ug)],
      [w.get("notes"), F(w.file("notes"), u, Js.oct(644), ug)],
      [
        w.get("documents"),
        D(
          u,
          Js.oct(755),
          Ch(
            [w.get("grades"), F(w.file("grades"), u, Js.oct(644), ug)],
            [w.get("fruits"), F(w.file("fruits"), u, Js.oct(644), ug)],
            ["server.log", F(ServerLog, u, Js.oct(644), ug)],
          ),
          ug,
        ),
      ],
      [
        w.get("old"),
        D(
          u,
          Js.oct(755),
          Ch(
            [w.get("oldNotes"), F(w.file("oldNotes"), u, Js.oct(644), ug)],
            [w.get("backup"), F(w.file("backup"), u, Js.oct(644), ug)],
            [w.get("archive"), D(u, Js.oct(755), Ch([w.get("oldLog"), F(w.file("oldLog"), u, Js.oct(644), ug)]), ug)],
          ),
          ug,
        ),
      ],
      [w.get("pictures"), D(u, Js.oct(755), Ch(), ug)],
      [
        w.get("webProject"),
        D(
          u,
          Js.oct(755),
          Ch(
            ["index.html", F(w.file("webIndex"), u, Js.oct(644), ug)],
            ["style.css", F(WebStyle, u, Js.oct(644), ug)],
            ["README.md", F(w.file("webReadme"), u, Js.oct(644), ug)],
          ),
          ug,
        ),
      ],
      // A downloaded AppImage (chapter "Flatpak, Snap and AppImage").
      [w.get("downloads"), D(u, Js.oct(755), Ch([w.get("calculator"), UniversalCmd.appImageNode(w, u, ug)]), ug)],
    ),
    ug,
  );
}

export function buildFs(distro: Distro, w: World): FsNode {
  const u = w.user;
  const home = buildHome(w);

  // Users and groups (see Users/UsersLib.ts). The system users differ a little between the families.
  const passwd = [...systemUsers(distro), `${u}:x:1000:1000:${w.get("userFull")},,,:/home/${u}:/bin/bash`].join("\n") + "\n";

  const group = [...systemGroups(distro).map((g) => (g.startsWith(`${distro.adminGroup}:`) ? g + u : g)), `${u}:x:1000:`].join("\n") + "\n";

  const shadowMode = distro.family === "debian" ? Js.oct(640) : distro.family === "arch" ? Js.oct(600) : 0;

  const etcChildren = Ch(
    ["hostname", F(`${distro.hostname}\n`)],
    ["os-release", F(distro.osRelease)],
    ["passwd", F(passwd)],
    ["group", F(group)],
    [
      "shadow",
      F(
        systemUsers(distro)
          .map((l) => `${l.split(":")[0]}:*:20000:0:99999:7:::\n`)
          .join("") + `${u}:$y$j9T$Qm1x...simulated...hash:20000:0:99999:7:::\n`,
        "root",
        shadowMode,
        distro.family === "debian" ? "shadow" : "root",
      ),
    ],
    ["login.defs", F(LoginDefs + (distro.family === "redhat" ? "CREATE_HOME\tyes\n" : ""))],
    ["skel", D("root", Js.oct(755), Ch([".bashrc", F(Bashrc)], [".profile", F(Profile)]))],
    ["sudoers", F(`# See sudoers(5). Always edit with visudo!\nDefaults\tenv_reset\nroot\tALL=(ALL:ALL) ALL\n%${distro.adminGroup}\tALL=(ALL:ALL) ALL\n`, "root", Js.oct(440))],
    ["hosts", F(`127.0.0.1\tlocalhost\n127.0.1.1\t${distro.hostname}\n::1\t\tlocalhost ip6-localhost ip6-loopback\n`)],
    ["fstab", F(DisksLib.fstabFor(distro))],
    ["shells", F("/bin/sh\n/bin/bash\n/usr/bin/bash\n")],
    ["resolv.conf", F(NetworkLib.resolvConf(distro))],
    ["nsswitch.conf", F("passwd:         files\ngroup:          files\nshadow:         files\n\nhosts:          files dns\nnetworks:       files\n")],
  );
  for (const [k, v] of familyEtc(distro)) etcChildren.set(k, v);
  const etc = D("root", Js.oct(755), etcChildren);

  return D(
    "root",
    Js.oct(755),
    Ch(
      ["boot", D("root", Js.oct(755), Ch([`vmlinuz-${distro.kernel}`, F("(the kernel - simulated)\n", "root", Js.oct(600))]))],
      ["dev", D("root", Js.oct(755), Ch(["null", F("", "root", Js.oct(666))]))],
      ["etc", etc],
      ["home", D("root", Js.oct(755), Ch([u, home]))],
      ["media", D()],
      ["mnt", D()],
      ["opt", D()],
      [
        "proc",
        D(
          "root",
          Js.oct(555),
          Ch(
            ["version", F(`Linux version ${distro.kernel} (simulated) #1 SMP PREEMPT_DYNAMIC\n`, "root", Js.oct(444))],
            ["cpuinfo", F("processor\t: 0\nvendor_id\t: GenuineIntel\nmodel name\t: Simulated CPU @ 3.00GHz\ncpu cores\t: 4\n", "root", Js.oct(444))],
          ),
        ),
      ],
      ["root", D("root", Js.oct(700), Ch([".bashrc", F(Bashrc)]))],
      ["srv", D()],
      ["tmp", D("root", Js.oct(1777))],
      [
        "usr",
        D(
          "root",
          Js.oct(755),
          Ch(
            ["bin", D()],
            ["lib", D()],
            ["local", D("root", Js.oct(755), Ch(["bin", D("root", Js.oct(755), Ch(["myserver", NetworkLib.myserverBinary()]))]))],
            ["sbin", D()],
            ["share", D("root", Js.oct(755), Ch(["doc", D()], ["man", D()]))],
          ),
        ),
      ],
      ["var", D("root", Js.oct(755), Ch(["cache", D()], ["lib", D()], ["log", D("root", Js.oct(755), familyLogs(distro))], ["tmp", D("root", Js.oct(1777))]))],
    ),
  );
}
