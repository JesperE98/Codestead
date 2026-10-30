// Distributionerna som simulatorn kan låtsas vara.
// En "familj" delar pakethanterare och paketformat.

export type Family = 'debian' | 'arch' | 'redhat';

export interface Distro {
  id: string;
  name: string;
  family: Family;
  hostname: string;
  version: string;
  codename?: string;
  kernel: string;
  packageManager: 'apt' | 'pacman' | 'dnf';
  /** Gruppen som får använda sudo. */
  adminGroup: 'sudo' | 'wheel';
  adminGid: number;
  /** Hur prompten ser ut som standard. */
  promptStyle: 'ubuntu' | 'debian' | 'bracket';
  osRelease: string;
  motd: string;
  /** Spegelservrar som visas av apt update. */
  mirrors: string[];
  accent: string;
}

export interface FamilyInfo {
  id: Family;
  name: string;
  packageManager: string;
  packageFormat: string;
  members: string;
}

export const FAMILIES: Record<Family, FamilyInfo> = {
  debian: {
    id: 'debian',
    name: 'Debian-familjen',
    packageManager: 'apt',
    packageFormat: '.deb',
    members: 'Debian, Ubuntu, Linux Mint, Pop!_OS, Raspberry Pi OS',
  },
  arch: {
    id: 'arch',
    name: 'Arch-familjen',
    packageManager: 'pacman',
    packageFormat: '.pkg.tar.zst',
    members: 'Arch Linux, Manjaro, EndeavourOS, CachyOS, SteamOS',
  },
  redhat: {
    id: 'redhat',
    name: 'Red Hat-familjen',
    packageManager: 'dnf',
    packageFormat: '.rpm',
    members: 'Fedora, Red Hat Enterprise Linux, Rocky Linux, AlmaLinux, CentOS Stream',
  },
};

export const DISTROS: Distro[] = [
  {
    id: 'ubuntu',
    name: 'Ubuntu 24.04 LTS',
    family: 'debian',
    hostname: 'ubuntu',
    version: '24.04',
    codename: 'noble',
    kernel: '6.8.0-71-generic',
    packageManager: 'apt',
    adminGroup: 'sudo',
    adminGid: 27,
    promptStyle: 'ubuntu',
    accent: '#e95420',
    mirrors: [
      'http://archive.ubuntu.com/ubuntu noble InRelease',
      'http://archive.ubuntu.com/ubuntu noble-updates InRelease',
      'http://security.ubuntu.com/ubuntu noble-security InRelease',
    ],
    osRelease: `PRETTY_NAME="Ubuntu 24.04.3 LTS"
NAME="Ubuntu"
VERSION_ID="24.04"
VERSION="24.04.3 LTS (Noble Numbat)"
VERSION_CODENAME=noble
ID=ubuntu
ID_LIKE=debian
HOME_URL="https://www.ubuntu.com/"
SUPPORT_URL="https://help.ubuntu.com/"
BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"
UBUNTU_CODENAME=noble
`,
    motd: `Welcome to Ubuntu 24.04.3 LTS (GNU/Linux 6.8.0-71-generic x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/pro
`,
  },
  {
    id: 'debian',
    name: 'Debian 13 (trixie)',
    family: 'debian',
    hostname: 'debian',
    version: '13',
    codename: 'trixie',
    kernel: '6.12.48+deb13-amd64',
    packageManager: 'apt',
    adminGroup: 'sudo',
    adminGid: 27,
    promptStyle: 'debian',
    accent: '#d70a53',
    mirrors: [
      'http://deb.debian.org/debian trixie InRelease',
      'http://deb.debian.org/debian trixie-updates InRelease',
      'http://security.debian.org/debian-security trixie-security InRelease',
    ],
    osRelease: `PRETTY_NAME="Debian GNU/Linux 13 (trixie)"
NAME="Debian GNU/Linux"
VERSION_ID="13"
VERSION="13 (trixie)"
VERSION_CODENAME=trixie
ID=debian
HOME_URL="https://www.debian.org/"
SUPPORT_URL="https://www.debian.org/support"
BUG_REPORT_URL="https://bugs.debian.org/"
`,
    motd: `Linux debian 6.12.48+deb13-amd64 #1 SMP PREEMPT_DYNAMIC Debian x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.
`,
  },
  {
    id: 'arch',
    name: 'Arch Linux',
    family: 'arch',
    hostname: 'archlinux',
    version: 'rolling',
    kernel: '6.17.5-arch1-1',
    packageManager: 'pacman',
    adminGroup: 'wheel',
    adminGid: 998,
    promptStyle: 'bracket',
    accent: '#1793d1',
    mirrors: [],
    osRelease: `NAME="Arch Linux"
PRETTY_NAME="Arch Linux"
ID=arch
BUILD_ID=rolling
ANSI_COLOR="38;2;23;147;209"
HOME_URL="https://archlinux.org/"
DOCUMENTATION_URL="https://wiki.archlinux.org/"
SUPPORT_URL="https://bbs.archlinux.org/"
BUG_REPORT_URL="https://gitlab.archlinux.org/groups/archlinux/-/issues"
LOGO=archlinux-logo
`,
    motd: '',
  },
  {
    id: 'fedora',
    name: 'Fedora Linux 43',
    family: 'redhat',
    hostname: 'fedora',
    version: '43',
    kernel: '6.17.4-300.fc43.x86_64',
    packageManager: 'dnf',
    adminGroup: 'wheel',
    adminGid: 10,
    promptStyle: 'bracket',
    accent: '#51a2da',
    mirrors: [],
    osRelease: `NAME="Fedora Linux"
VERSION="43 (Workstation Edition)"
ID=fedora
VERSION_ID=43
PRETTY_NAME="Fedora Linux 43 (Workstation Edition)"
HOME_URL="https://fedoraproject.org/"
DOCUMENTATION_URL="https://docs.fedoraproject.org/"
SUPPORT_URL="https://ask.fedoraproject.org/"
BUG_REPORT_URL="https://bugzilla.redhat.com/"
VARIANT="Workstation Edition"
VARIANT_ID=workstation
`,
    motd: '',
  },
];

export function getDistro(id: string): Distro {
  return DISTROS.find((d) => d.id === id) ?? DISTROS[0];
}
