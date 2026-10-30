// Bygger startfilsystemet för en distribution: systemkataloger,
// konfigurationsfiler och några övningsfiler i hemkatalogen.

import type { Distro } from './distros';
import { makeDir as d, makeFile as f, type FsNode } from './vfs';

export const STUDENT = 'elev';

const SERVER_LOG = `2026-10-28 08:00:01 INFO  Servern startar
2026-10-28 08:00:02 INFO  Läser konfiguration från /etc/minserver.conf
2026-10-28 08:00:02 WARN  Konfigurationsnyckeln "timeout" saknas, använder 30s
2026-10-28 08:00:03 INFO  Lyssnar på port 8080
2026-10-28 09:14:55 INFO  GET /index.html 200
2026-10-28 09:15:10 ERROR Kunde inte ansluta till databasen
2026-10-28 09:15:11 INFO  Försöker igen om 5 sekunder
2026-10-28 09:15:16 INFO  Ansluten till databasen
2026-10-28 11:42:03 WARN  Långsam förfrågan: GET /rapport tog 4.2s
2026-10-28 12:01:37 INFO  GET /om.html 200
2026-10-28 13:30:00 ERROR Disken /var är 95% full
2026-10-28 14:05:12 INFO  GET /bilder/logo.png 404
2026-10-28 16:20:44 warn  Certifikatet går ut om 14 dagar
2026-10-28 18:00:00 ERROR Tidsgräns överskriden för jobbet "backup"
2026-10-28 23:59:59 INFO  Dagens loggar roteras
`;

const FRUITS = `äpple
banan
kiwi
äpple
apelsin
banan
päron
kiwi
äpple
mango
`;

const GRADES = `namn,ämne,poäng
Alva,matte,87
Bilal,matte,64
Cleo,svenska,92
David,engelska,45
Elin,svenska,78
Farid,matte,95
Greta,engelska,58
Hugo,svenska,71
`;

const NOTES = `Saker att lära mig om Linux:
- navigera i filsystemet
- hantera filer och kataloger
- pipes och omdirigering
- rättigheter och sudo
- pakethantering i olika distributioner
`;

const BASHRC = `# ~/.bashrc: körs av bash för interaktiva skal.
# Här brukar man lägga alias och egna inställningar.

# Exempel:
# alias ll='ls -la'
# export EDITOR=nano
`;

const PROFILE = `# ~/.profile: körs av inloggningsskal.
if [ -d "$HOME/bin" ] ; then
    PATH="$HOME/bin:$PATH"
fi
`;

function familyEtc(distro: Distro): Record<string, FsNode> {
  switch (distro.family) {
    case 'debian': {
      const sourcesName = distro.id === 'ubuntu' ? 'ubuntu.sources' : 'debian.sources';
      const uri = distro.id === 'ubuntu' ? 'http://archive.ubuntu.com/ubuntu' : 'http://deb.debian.org/debian';
      const comps = distro.id === 'ubuntu' ? 'main restricted universe multiverse' : 'main contrib non-free-firmware';
      return {
        apt: d('root', 0o755, {
          'sources.list.d': d('root', 0o755, {
            [sourcesName]: f(
              `Types: deb\nURIs: ${uri}\nSuites: ${distro.codename} ${distro.codename}-updates\nComponents: ${comps}\nSigned-By: /usr/share/keyrings/${distro.id}-archive-keyring.gpg\n`,
            ),
          }),
          'apt.conf.d': d(),
        }),
      };
    }
    case 'arch':
      return {
        'pacman.conf': f(
          `#\n# /etc/pacman.conf\n#\n[options]\nHoldPkg     = pacman glibc\nArchitecture = auto\nColor\nParallelDownloads = 5\nSigLevel    = Required DatabaseOptional\n\n[core]\nInclude = /etc/pacman.d/mirrorlist\n\n[extra]\nInclude = /etc/pacman.d/mirrorlist\n`,
        ),
        'pacman.d': d('root', 0o755, {
          mirrorlist: f(
            `## Arch Linux repository mirrorlist\n## Sweden\nServer = https://ftp.lysator.liu.se/pub/archlinux/$repo/os/$arch\nServer = https://mirror.osbeck.com/archlinux/$repo/os/$arch\n`,
          ),
        }),
      };
    case 'redhat':
      return {
        dnf: d('root', 0o755, { 'dnf.conf': f(`[main]\ngpgcheck=True\ninstallonly_limit=3\nclean_requirements_on_remove=True\nbest=False\nskip_if_unavailable=True\n`) }),
        'yum.repos.d': d('root', 0o755, {
          'fedora.repo': f(
            `[fedora]\nname=Fedora $releasever - $basearch\nmetalink=https://mirrors.fedoraproject.org/metalink?repo=fedora-$releasever&arch=$basearch\nenabled=1\ngpgcheck=1\n`,
          ),
          'fedora-updates.repo': f(
            `[updates]\nname=Fedora $releasever - $basearch - Updates\nmetalink=https://mirrors.fedoraproject.org/metalink?repo=updates-released-f$releasever&arch=$basearch\nenabled=1\ngpgcheck=1\n`,
          ),
        }),
      };
  }
}

function familyLogs(distro: Distro): Record<string, FsNode> {
  switch (distro.family) {
    case 'debian':
      return {
        apt: d('root', 0o755, {
          'history.log': f(`\nStart-Date: 2026-10-20  10:12:01\nCommandline: apt install sudo\nInstall: sudo:amd64\nEnd-Date: 2026-10-20  10:12:04\n`),
        }),
        'dpkg.log': f(`2026-10-20 10:12:03 install sudo:amd64 <none>\n2026-10-20 10:12:04 status installed sudo:amd64\n`),
      };
    case 'arch':
      return {
        'pacman.log': f(`[2026-10-20T10:12:01+0200] [PACMAN] Running 'pacman -S --needed base sudo'\n[2026-10-20T10:12:04+0200] [ALPM] installed sudo\n`),
      };
    case 'redhat':
      return {
        'dnf5.log': f(`2026-10-20T10:12:01+0200 [1234] INFO --- DNF5 launched with arguments: "dnf install sudo" ---\n`),
      };
  }
}

/** Systemanvändare (UID under 1000) – program och tjänster, inte människor. */
function systemUsers(distro: Distro): string[] {
  switch (distro.family) {
    case 'debian':
      return [
        'root:x:0:0:root:/root:/bin/bash',
        'daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin',
        'bin:x:2:2:bin:/bin:/usr/sbin/nologin',
        'sys:x:3:3:sys:/dev:/usr/sbin/nologin',
        'sync:x:4:65534:sync:/bin:/bin/sync',
        'mail:x:8:8:mail:/var/mail:/usr/sbin/nologin',
        'www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin',
        'nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin',
        'systemd-network:x:998:998:systemd Network Management:/:/usr/sbin/nologin',
        'messagebus:x:100:101::/nonexistent:/usr/sbin/nologin',
        'syslog:x:102:102::/nonexistent:/usr/sbin/nologin',
      ];
    case 'arch':
      return [
        'root:x:0:0::/root:/usr/bin/bash',
        'bin:x:1:1::/:/usr/bin/nologin',
        'daemon:x:2:2::/:/usr/bin/nologin',
        'mail:x:8:12::/var/spool/mail:/usr/bin/nologin',
        'ftp:x:14:11::/srv/ftp:/usr/bin/nologin',
        'http:x:33:33::/srv/http:/usr/bin/nologin',
        'nobody:x:65534:65534:Kernel Overflow User:/:/usr/bin/nologin',
        'dbus:x:81:81:System Message Bus:/:/usr/bin/nologin',
        'systemd-network:x:982:982:systemd Network Management:/:/usr/bin/nologin',
      ];
    case 'redhat':
      return [
        'root:x:0:0:Super User:/root:/bin/bash',
        'bin:x:1:1:bin:/bin:/usr/sbin/nologin',
        'daemon:x:2:2:daemon:/sbin:/usr/sbin/nologin',
        'adm:x:3:4:adm:/var/adm:/usr/sbin/nologin',
        'mail:x:8:12:mail:/var/spool/mail:/usr/sbin/nologin',
        'nobody:x:65534:65534:Kernel Overflow User:/:/usr/sbin/nologin',
        'dbus:x:81:81:System Message Bus:/:/usr/sbin/nologin',
        'systemd-network:x:192:192:systemd Network Management:/:/usr/sbin/nologin',
      ];
  }
}

/** Systemgrupper. Administratörsgruppen (sudo/wheel) får elev som medlem i buildFs. */
function systemGroups(distro: Distro): string[] {
  const admin = `${distro.adminGroup}:x:${distro.adminGid}:`;
  switch (distro.family) {
    case 'debian':
      return [
        'root:x:0:', 'daemon:x:1:', 'bin:x:2:', 'sys:x:3:', 'adm:x:4:syslog', 'tty:x:5:', 'mail:x:8:', 'www-data:x:33:',
        admin, 'shadow:x:42:', 'users:x:100:', 'nogroup:x:65534:', 'systemd-network:x:998:', 'messagebus:x:101:', 'syslog:x:102:',
      ];
    case 'arch':
      return [
        'root:x:0:root', 'sys:x:3:bin', 'mem:x:8:', 'ftp:x:11:', 'mail:x:12:', 'log:x:19:', 'http:x:33:', 'tty:x:5:',
        'bin:x:1:daemon', 'daemon:x:2:bin', 'dbus:x:81:', 'nobody:x:65534:', admin, 'adm:x:999:daemon', 'users:x:984:',
        'systemd-network:x:982:',
      ];
    case 'redhat':
      return [
        'root:x:0:', 'bin:x:1:', 'daemon:x:2:', 'sys:x:3:', 'adm:x:4:', 'tty:x:5:', 'mail:x:12:', admin, 'users:x:100:',
        'nobody:x:65534:', 'dbus:x:81:', 'systemd-network:x:192:',
      ];
  }
}

const LOGIN_DEFS = `# /etc/login.defs – inställningar för useradd, passwd m.fl. (utdrag)
PASS_MAX_DAYS	99999
PASS_MIN_DAYS	0
PASS_WARN_AGE	7
UID_MIN			 1000
UID_MAX			60000
SYS_UID_MIN		  100
SYS_UID_MAX		  999
GID_MIN			 1000
GID_MAX			60000
USERGROUPS_ENAB yes
ENCRYPT_METHOD YESCRYPT
`;

export function buildFs(distro: Distro): FsNode {
  const u = STUDENT;
  const ug = STUDENT;

  const home = d(u, 0o750, {
    '.bashrc': f(BASHRC, u, 0o644, ug),
    '.profile': f(PROFILE, u, 0o644, ug),
    'anteckningar.txt': f(NOTES, u, 0o644, ug),
    dokument: d(u, 0o755, {
      'betyg.csv': f(GRADES, u, 0o644, ug),
      'frukter.txt': f(FRUITS, u, 0o644, ug),
      'server.log': f(SERVER_LOG, u, 0o644, ug),
    }, ug),
    gammalt: d(u, 0o755, {
      'gamla-anteckningar.txt': f('Det här behövs inte längre.\n', u, 0o644, ug),
      'kopia.bak': f('backup från 2019\n', u, 0o644, ug),
      arkiv: d(u, 0o755, { 'logg-2019.txt': f('gammal logg\n', u, 0o644, ug) }, ug),
    }, ug),
    bilder: d(u, 0o755, {}, ug),
  }, ug);

  // Användare och grupper (se users.ts). Systemanvändarna skiljer sig lite mellan familjerna.
  const passwd = [...systemUsers(distro), `${u}:x:1000:1000:Elev,,,:/home/${u}:/bin/bash`].join('\n') + '\n';

  const group = [
    ...systemGroups(distro).map((g) => (g.startsWith(`${distro.adminGroup}:`) ? g + u : g)),
    `${u}:x:1000:`,
  ].join('\n') + '\n';

  const etc = d('root', 0o755, {
    hostname: f(`${distro.hostname}\n`),
    'os-release': f(distro.osRelease),
    passwd: f(passwd),
    group: f(group),
    shadow: f(
      systemUsers(distro).map((l) => `${l.split(':')[0]}:*:20000:0:99999:7:::\n`).join('') +
        `${u}:$y$j9T$Qm1x...simulerad...hash:20000:0:99999:7:::\n`,
      'root',
      { debian: 0o640, arch: 0o600, redhat: 0o000 }[distro.family],
      distro.family === 'debian' ? 'shadow' : 'root',
    ),
    'login.defs': f(LOGIN_DEFS + (distro.family === 'redhat' ? 'CREATE_HOME\tyes\n' : '')),
    skel: d('root', 0o755, { '.bashrc': f(BASHRC), '.profile': f(PROFILE) }),
    sudoers: f(
      `# Se sudoers(5). Redigera alltid med visudo!\nDefaults\tenv_reset\nroot\tALL=(ALL:ALL) ALL\n%${distro.adminGroup}\tALL=(ALL:ALL) ALL\n`,
      'root',
      0o440,
    ),
    hosts: f(`127.0.0.1\tlocalhost\n127.0.1.1\t${distro.hostname}\n::1\t\tlocalhost ip6-localhost ip6-loopback\n`),
    fstab: f(`# <file system>  <mount point>  <type>  <options>  <dump>  <pass>\nUUID=1234-abcd   /              ext4    defaults   0       1\n`),
    shells: f('/bin/sh\n/bin/bash\n/usr/bin/bash\n'),
    ...familyEtc(distro),
  });

  return d('root', 0o755, {
    boot: d('root', 0o755, {
      [`vmlinuz-${distro.kernel}`]: f('(kärnan – simulerad)\n', 'root', 0o600),
    }),
    dev: d('root', 0o755, { null: f('', 'root', 0o666) }),
    etc,
    home: d('root', 0o755, { [u]: home }),
    media: d(),
    mnt: d(),
    opt: d(),
    proc: d('root', 0o555, {
      version: f(`Linux version ${distro.kernel} (simulerad) #1 SMP PREEMPT_DYNAMIC\n`, 'root', 0o444),
      cpuinfo: f(`processor\t: 0\nvendor_id\t: GenuineIntel\nmodel name\t: Simulerad CPU @ 3.00GHz\ncpu cores\t: 4\n`, 'root', 0o444),
    }),
    root: d('root', 0o700, { '.bashrc': f(BASHRC) }),
    srv: d(),
    tmp: d('root', 0o1777),
    usr: d('root', 0o755, {
      bin: d(),
      lib: d(),
      local: d('root', 0o755, { bin: d() }),
      sbin: d(),
      share: d('root', 0o755, { doc: d(), man: d() }),
    }),
    var: d('root', 0o755, {
      cache: d(),
      lib: d(),
      log: d('root', 0o755, familyLogs(distro)),
      tmp: d('root', 0o1777),
    }),
  });
}
