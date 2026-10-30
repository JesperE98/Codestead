// Paketdatabasen som apt, pacman och dnf i simulatorn använder.
// Samma program kan heta olika saker i olika familjer – det är en viktig poäng!

import type { Family } from './distros';
import { extraRepoEnabled } from './extrarepo';
import type { Shell } from './shell';
import { ELF, makeFile } from './vfs';

export interface PackageDef {
  id: string;
  /** Paketnamn per familj. Saknas familjen finns inte paketet där. */
  names: Partial<Record<Family, string>>;
  version: Record<Family, string>;
  /** Version som blir tillgänglig efter att paketlistorna uppdaterats. */
  newVersion?: Partial<Record<Family, string>>;
  description: string;
  sizeKb: number;
  /** Kommandon som paketet installerar i /usr/bin. */
  provides: string[];
  /** Förinstallerat i dessa familjer. */
  base?: Family[];
  /** Systemkritiskt – pakethanteraren vägrar ta bort det. */
  essential?: boolean;
  /** Arch-förråd (core/extra). */
  archRepo?: 'core' | 'extra';
  /** Skal som paketet lägger till i /etc/shells. */
  shells?: string[];
  /** Förinstallerat bara i dessa distributioner (t.ex. snapd i Ubuntu men inte i Debian). */
  baseDistros?: string[];
  /**
   * Finns bara i ett extra förråd: 'ppa:användare/namn' (Debian/Ubuntu), 'aur' (Arch)
   * eller 'copr:användare/projekt' (Fedora). Se extrarepo.ts och commands/repos.ts.
   */
  extraRepo?: Partial<Record<Family, string>>;
}

const ALL: Family[] = ['debian', 'arch', 'redhat'];
const same = (name: string): Record<Family, string> => ({ debian: name, arch: name, redhat: name });

export const PACKAGES: PackageDef[] = [
  {
    id: 'coreutils',
    names: same('coreutils'),
    version: { debian: '9.4-3ubuntu6', arch: '9.8-2', redhat: '9.7-6.fc43' },
    newVersion: { debian: '9.4-3ubuntu6.1', arch: '9.8-3', redhat: '9.7-7.fc43' },
    description: 'GNU core utilities (ls, cp, mv, rm, cat ...)',
    sizeKb: 17_400,
    provides: [
      'ls', 'cat', 'mkdir', 'touch', 'rm', 'rmdir', 'cp', 'mv', 'head', 'tail', 'wc', 'sort', 'uniq',
      'cut', 'tee', 'chmod', 'chown', 'whoami', 'id', 'groups', 'uname', 'date', 'env', 'printenv',
      'true', 'false', 'sleep', 'seq', 'basename', 'dirname', 'pwd', 'echo',
      'tr',
      'du',
      'who', 'chgrp', 'df', 'sync',
    ],
    base: ALL,
    essential: true,
    archRepo: 'core',
  },
  {
    id: 'bash',
    names: same('bash'),
    version: { debian: '5.2.21-2ubuntu4', arch: '5.3.3-2', redhat: '5.3.0-2.fc43' },
    newVersion: { debian: '5.2.21-2ubuntu4.1', arch: '5.3.3-3', redhat: '5.3.0-3.fc43' },
    description: 'GNU Bourne Again SHell',
    sizeKb: 8_600,
    provides: ['bash', 'sh'],
    base: ALL,
    essential: true,
    archRepo: 'core',
  },
  {
    id: 'grep',
    names: same('grep'),
    version: { debian: '3.11-4build1', arch: '3.12-2', redhat: '3.12-2.fc43' },
    description: 'GNU grep, egrep and fgrep – search text with patterns',
    sizeKb: 1_200,
    provides: ['grep'],
    base: ALL,
    essential: true,
    archRepo: 'core',
  },
  {
    id: 'sed',
    names: same('sed'),
    version: { debian: '4.9-2build1', arch: '4.9-3', redhat: '4.9-5.fc43' },
    description: 'GNU stream editor for filtering and transforming text',
    sizeKb: 860,
    provides: ['sed'],
    base: ALL,
    essential: true,
    archRepo: 'core',
  },
  {
    id: 'awk',
    // Debian och Ubuntu har mawk som standard, Arch och Fedora GNU awk.
    names: { debian: 'mawk', arch: 'gawk', redhat: 'gawk' },
    version: { debian: '1.3.4.20240123-1build1', arch: '5.3.2-1', redhat: '5.3.2-2.fc43' },
    description: 'Pattern scanning and text processing language (awk)',
    sizeKb: 2_400,
    provides: ['awk'],
    base: ALL,
    archRepo: 'core',
  },
  {
    id: 'findutils',
    names: same('findutils'),
    version: { debian: '4.9.0-5build1', arch: '4.10.0-3', redhat: '4.10.0-6.fc43' },
    description: 'Utilities for finding files (find, xargs)',
    sizeKb: 1_700,
    provides: ['find'],
    base: ALL,
    essential: true,
    archRepo: 'core',
  },
  {
    id: 'sudo',
    names: same('sudo'),
    version: { debian: '1.9.15p5-3ubuntu5', arch: '1.9.17.p2-1', redhat: '1.9.17-4.p2.fc43' },
    newVersion: { debian: '1.9.15p5-3ubuntu5.1', arch: '1.9.17.p2-2', redhat: '1.9.17-5.p2.fc43' },
    description: 'Give limited root privileges to certain users',
    sizeKb: 4_100,
    provides: ['sudo'],
    base: ALL,
    essential: true,
    archRepo: 'core',
  },
  {
    // Användarhantering. Paketet heter olika saker i familjerna!
    id: 'shadow',
    names: { debian: 'passwd', arch: 'shadow', redhat: 'shadow-utils' },
    version: { debian: '1:4.13+dfsg1-4ubuntu3.2', arch: '4.18.0-1', redhat: '2:4.18.0-3.fc43' },
    description: 'Change and administer password and group data (useradd, passwd ...)',
    sizeKb: 3_900,
    provides: ['useradd', 'usermod', 'userdel', 'groupadd', 'groupdel', 'gpasswd', 'passwd', 'chpasswd', 'chage'],
    base: ALL,
    essential: true,
    archRepo: 'core',
  },
  {
    // Debians vänligare skript runt useradd. Finns inte i Arch och Fedora.
    id: 'adduser',
    names: { debian: 'adduser' },
    version: { debian: '3.137ubuntu1', arch: '', redhat: '' },
    description: 'Add and remove users and groups (friendly front end to useradd)',
    sizeKb: 640,
    provides: ['adduser', 'deluser', 'addgroup', 'delgroup'],
    base: ['debian'],
  },
  {
    id: 'libc',
    names: { debian: 'libc-bin', arch: 'glibc', redhat: 'glibc-common' },
    version: { debian: '2.39-0ubuntu8.6', arch: '2.42+r17-1', redhat: '2.42-4.fc43' },
    description: 'GNU C Library: support programs (getent, ldd ...)',
    sizeKb: 2_700,
    provides: ['getent'],
    base: ALL,
    essential: true,
    archRepo: 'core',
  },
  {
    id: 'util-linux',
    names: same('util-linux'),
    version: { debian: '2.39.3-9ubuntu6', arch: '2.41.2-1', redhat: '2.41.2-1.fc43' },
    description: 'Miscellaneous system utilities (su, more, hostname ...)',
    sizeKb: 9_800,
    provides: ['su', 'more', 'hostname', 'chsh', 'last', 'mount', 'umount', 'lsblk', 'blkid', 'findmnt', 'fdisk', 'swapon', 'mkfs'],
    base: ALL,
    essential: true,
    archRepo: 'core',
  },
  {
    id: 'ncurses',
    names: { debian: 'ncurses-bin', arch: 'ncurses', redhat: 'ncurses' },
    version: { debian: '6.4+20240113-1ubuntu2', arch: '6.5-4', redhat: '6.5-7.20250614.fc43' },
    description: 'Terminal handling utilities (clear, tput ...)',
    sizeKb: 1_100,
    provides: ['clear'],
    base: ALL,
    essential: true,
    archRepo: 'core',
  },
  {
    id: 'which',
    names: { debian: 'debianutils', arch: 'which', redhat: 'which' },
    version: { debian: '5.17build1', arch: '2.23-1', redhat: '2.23-3.fc43' },
    description: 'Shows the full path of (shell) commands',
    sizeKb: 90,
    provides: ['which'],
    base: ALL,
    essential: true,
    archRepo: 'core',
  },
  {
    id: 'e2fsprogs',
    names: same('e2fsprogs'),
    version: { debian: '1.47.0-2.4~exp1ubuntu4', arch: '1.47.3-1', redhat: '1.47.3-2.fc43' },
    description: 'Utilities for the ext2/ext3/ext4 file systems (mkfs.ext4, mke2fs ...)',
    sizeKb: 1_900,
    provides: ['mkfs.ext4', 'mke2fs'],
    base: ALL,
    archRepo: 'core',
  },
  {
    // Följer inte med Arch från början – där installeras det vid behov.
    id: 'dosfstools',
    names: same('dosfstools'),
    version: { debian: '4.2-1.1build1', arch: '4.2-5', redhat: '4.2-14.fc43' },
    description: 'Utilities for making and checking MS-DOS FAT file systems (mkfs.vfat)',
    sizeKb: 320,
    provides: ['mkfs.vfat', 'mkfs.fat'],
    base: ['debian', 'redhat'],
    archRepo: 'core',
  },
  {
    id: 'procps',
    names: { debian: 'procps', arch: 'procps-ng', redhat: 'procps-ng' },
    version: { debian: '2:4.0.4-4ubuntu3', arch: '4.0.5-3', redhat: '4.0.4-7.fc43' },
    description: 'Utilities for monitoring processes (ps, top, kill, pkill, free ...)',
    sizeKb: 2_100,
    provides: ['ps', 'top', 'pkill', 'pgrep', 'uptime', 'free', 'w'],
    base: ALL,
    essential: true,
    archRepo: 'core',
  },
  {
    id: 'psmisc',
    names: same('psmisc'),
    version: { debian: '23.7-1build1', arch: '23.7-1', redhat: '23.6-10.fc43' },
    description: 'Utilities that use the proc file system (killall, pstree ...)',
    sizeKb: 600,
    provides: ['killall'],
    base: ALL,
    archRepo: 'core',
  },
  {
    id: 'tar',
    names: same('tar'),
    version: { debian: '1.35+dfsg-3build1', arch: '1.35-2', redhat: '2:1.35-6.fc43' },
    description: 'GNU version of the tar archiving utility',
    sizeKb: 3_100,
    provides: ['tar'],
    base: ALL,
    archRepo: 'core',
  },
  {
    id: 'gzip',
    names: same('gzip'),
    version: { debian: '1.12-1ubuntu3', arch: '1.14-2', redhat: '1.13-4.fc43' },
    description: 'GNU compression utility (gzip, gunzip, zcat)',
    sizeKb: 250,
    provides: ['gzip', 'gunzip', 'zcat'],
    base: ALL,
    archRepo: 'core',
  },
  {
    id: 'less',
    names: same('less'),
    version: { debian: '590-2ubuntu2', arch: '1:679-1', redhat: '679-2.fc43' },
    description: 'Pager program similar to more',
    sizeKb: 300,
    provides: ['less'],
    base: ALL,
    archRepo: 'core',
  },
  {
    id: 'man-db',
    names: same('man-db'),
    version: { debian: '2.12.0-4build2', arch: '2.13.1-1', redhat: '2.13.1-2.fc43' },
    description: 'Tools for reading manual pages',
    sizeKb: 2_800,
    provides: ['man'],
    base: ALL,
    archRepo: 'core',
  },
  {
    id: 'systemd',
    names: same('systemd'),
    version: { debian: '255.4-1ubuntu8.11', arch: '258.1-1', redhat: '258-1.fc43' },
    description: 'System and service manager (systemctl, journalctl ...)',
    sizeKb: 31_000,
    provides: ['systemctl', 'journalctl', 'hostnamectl', 'systemd-analyze', 'reboot'],
    base: ALL,
    essential: true,
    archRepo: 'core',
  },
  {
    id: 'apt',
    names: { debian: 'apt' },
    version: { debian: '2.8.3', arch: '', redhat: '' },
    description: 'Commandline package manager',
    sizeKb: 4_200,
    provides: ['apt', 'apt-get'],
    base: ['debian'],
    essential: true,
  },
  {
    id: 'pacman',
    names: { arch: 'pacman' },
    version: { debian: '', arch: '7.0.0.r6.gc685ae6-6', redhat: '' },
    description: 'A library-based package manager with dependency support',
    sizeKb: 4_900,
    provides: ['pacman', 'makepkg'],
    base: ['arch'],
    essential: true,
    archRepo: 'core',
  },
  {
    id: 'dnf',
    names: { redhat: 'dnf5' },
    version: { debian: '', arch: '', redhat: '5.2.17.0-2.fc43' },
    description: 'Command-line package manager',
    sizeKb: 2_600,
    provides: ['dnf', 'dnf5'],
    base: ['redhat'],
    essential: true,
  },
  {
    id: 'nano',
    names: same('nano'),
    version: { debian: '7.2-2ubuntu0.1', arch: '8.6-1', redhat: '8.5-2.fc43' },
    description: 'Small, friendly text editor inspired by Pico',
    sizeKb: 2_900,
    provides: ['nano'],
    base: ['debian', 'redhat'],
    archRepo: 'core',
  },
  {
    id: 'vim',
    names: { debian: 'vim', arch: 'vim', redhat: 'vim-enhanced' },
    version: { debian: '2:9.1.0016-1ubuntu7.9', arch: '9.1.1734-1', redhat: '2:9.1.1775-1.fc43' },
    description: 'Vi IMproved – enhanced vi editor',
    sizeKb: 4_000,
    provides: ['vim'],
  },
  {
    id: 'htop',
    names: same('htop'),
    version: { debian: '3.3.0-4build1', arch: '3.4.1-1', redhat: '3.4.1-2.fc43' },
    description: 'Interactive process viewer',
    sizeKb: 434,
    provides: ['htop'],
  },
  {
    id: 'tree',
    names: same('tree'),
    version: { debian: '2.1.1-2ubuntu3', arch: '2.2.1-1', redhat: '2.2.1-2.fc43' },
    description: 'Displays an indented directory tree, in color',
    sizeKb: 118,
    provides: ['tree'],
  },
  {
    id: 'fastfetch',
    names: same('fastfetch'),
    version: { debian: '2.47.0-1', arch: '2.54.0-1', redhat: '2.54.0-1.fc43' },
    description: 'Fast system information tool (like neofetch)',
    sizeKb: 1_900,
    provides: ['fastfetch'],
  },
  {
    id: 'cowsay',
    names: same('cowsay'),
    version: { debian: '3.03+dfsg2-8', arch: '3.8.4-1', redhat: '3.8.4-3.fc43' },
    description: 'Configurable talking cow',
    sizeKb: 90,
    provides: ['cowsay'],
  },
  {
    id: 'git',
    names: same('git'),
    version: { debian: '1:2.43.0-1ubuntu7.3', arch: '2.51.2-1', redhat: '2.51.1-1.fc43' },
    description: 'Fast, scalable, distributed revision control system',
    sizeKb: 38_000,
    provides: ['git'],
  },
  {
    id: 'curl',
    names: same('curl'),
    version: { debian: '8.5.0-2ubuntu10.6', arch: '8.16.0-1', redhat: '8.15.0-3.fc43' },
    description: 'Command line tool for transferring data with URL syntax',
    sizeKb: 520,
    provides: ['curl'],
    base: ['arch', 'redhat'],
    archRepo: 'core',
  },
  {
    id: 'wget',
    names: same('wget'),
    version: { debian: '1.21.4-1ubuntu4.1', arch: '1.25.0-2', redhat: '2.2.0-6.fc43' },
    description: 'Retrieves files from the web',
    sizeKb: 1_000,
    provides: ['wget'],
    // Förinstallerat i Debian/Ubuntu, medan Arch och Fedora har curl i stället.
    base: ['debian'],
  },
  {
    id: 'python',
    names: { debian: 'python3', arch: 'python', redhat: 'python3' },
    version: { debian: '3.12.3-0ubuntu2', arch: '3.13.7-1', redhat: '3.14.0-1.fc43' },
    description: 'Interactive high-level object-oriented language (Python 3)',
    sizeKb: 25_000,
    provides: ['python3'],
    base: ['redhat'],
    archRepo: 'core',
  },
  {
    id: 'zip',
    names: same('zip'),
    version: { debian: '3.0-13ubuntu0.2', arch: '3.0-11', redhat: '3.0-44.fc43' },
    description: 'Archiver for .zip files',
    sizeKb: 640,
    provides: ['zip'],
  },
  {
    id: 'unzip',
    names: same('unzip'),
    version: { debian: '6.0-28ubuntu4.1', arch: '6.0-23', redhat: '6.0-67.fc43' },
    description: 'De-archiver for .zip files',
    sizeKb: 540,
    provides: ['unzip'],
  },
  {
    id: 'openssh',
    names: { debian: 'openssh-client', arch: 'openssh', redhat: 'openssh-clients' },
    version: { debian: '1:9.6p1-3ubuntu13.14', arch: '10.2p1-1', redhat: '10.0p1-5.fc43' },
    description: 'Secure shell (SSH) client for secure access to remote machines',
    sizeKb: 3_400,
    provides: ['ssh', 'ssh-keygen', 'ssh-copy-id'],
    // Arch installerar inte ssh-klienten från början.
    base: ['debian', 'redhat'],
  },
  // ---------- Nätverk ----------
  {
    id: 'iproute2',
    names: { debian: 'iproute2', arch: 'iproute2', redhat: 'iproute' },
    version: { debian: '6.1.0-1ubuntu6.2', arch: '6.17.0-1', redhat: '6.14.0-2.fc43' },
    description: 'Networking and traffic control tools (ip, ss)',
    sizeKb: 3_200,
    provides: ['ip', 'ss'],
    base: ALL,
    archRepo: 'core',
  },
  {
    id: 'iputils',
    names: { debian: 'iputils-ping', arch: 'iputils', redhat: 'iputils' },
    version: { debian: '3:20240117-1ubuntu0.1', arch: '20250605-1', redhat: '20250605-1.fc43' },
    description: 'Tools to test the reachability of network hosts (ping)',
    sizeKb: 200,
    provides: ['ping'],
    base: ALL,
    archRepo: 'core',
  },
  {
    id: 'dnsutils',
    names: { debian: 'dnsutils', arch: 'bind', redhat: 'bind-utils' },
    version: { debian: '1:9.18.39-0ubuntu0.24.04.1', arch: '9.20.13-1', redhat: '32:9.18.39-1.fc43' },
    description: 'DNS lookup utilities (dig, host, nslookup)',
    sizeKb: 1_100,
    provides: ['dig', 'host', 'nslookup'],
    archRepo: 'extra',
  },
  {
    id: 'traceroute',
    names: same('traceroute'),
    version: { debian: '1:2.1.5-1', arch: '2.1.6-1', redhat: '3:2.1.6-3.fc43' },
    description: 'Traces the route taken by packets over an IPv4/IPv6 network',
    sizeKb: 160,
    provides: ['traceroute'],
    archRepo: 'extra',
  },
  {
    id: 'zsh',
    names: same('zsh'),
    version: { debian: '5.9-6ubuntu2', arch: '5.9-5', redhat: '5.9-18.fc43' },
    description: 'Z shell – a shell with many extras, largely compatible with bash',
    sizeKb: 8_900,
    provides: ['zsh'],
    archRepo: 'extra',
    shells: ['/bin/zsh', '/usr/bin/zsh'],
  },
  {
    id: 'fish',
    names: same('fish'),
    version: { debian: '3.7.0-1', arch: '4.1.2-1', redhat: '4.0.2-2.fc43' },
    description: 'fish – the friendly interactive shell',
    sizeKb: 14_200,
    provides: ['fish'],
    archRepo: 'extra',
    shells: ['/usr/bin/fish', '/bin/fish'],
  },
  // ----- Extra förråd (kapitlet "AUR, PPA och COPR") -----
  {
    id: 'software-properties-common',
    names: { debian: 'software-properties-common' },
    version: { debian: '0.99.49.3', arch: '', redhat: '' },
    description: 'Manage the repositories that you install software from (add-apt-repository)',
    sizeKb: 210,
    provides: ['add-apt-repository'],
    baseDistros: ['ubuntu'],
  },
  {
    id: 'moonphase',
    names: same('moonphase'),
    version: { debian: '1.4.2-1~ppa1~noble1', arch: '1.4.2-1', redhat: '1.4.2-1.fc43' },
    description: 'Shows the current phase of the moon in the terminal',
    sizeKb: 64,
    provides: ['moonphase'],
    extraRepo: { debian: 'ppa:lunatool/moonphase', arch: 'aur', redhat: 'copr:lunatool/moonphase' },
  },
  {
    id: 'base-devel',
    names: { arch: 'base-devel' },
    version: { debian: '', arch: '1-2', redhat: '' },
    description: 'Basic tools to build Arch Linux packages (gcc, make, fakeroot ...)',
    sizeKb: 245_000,
    provides: [],
    archRepo: 'core',
  },
  {
    id: 'go',
    names: { debian: 'golang-go', arch: 'go', redhat: 'golang' },
    version: { debian: '2:1.22~2build1', arch: '2:1.25.3-1', redhat: '1.25.3-1.fc43' },
    description: 'The Go programming language compiler',
    sizeKb: 228_000,
    provides: ['go'],
  },
  {
    id: 'yay',
    names: { arch: 'yay' },
    version: { debian: '', arch: '12.5.2-1', redhat: '' },
    description: 'Yet another yogurt. Pacman wrapper and AUR helper written in go.',
    sizeKb: 9_800,
    provides: ['yay'],
    extraRepo: { arch: 'aur' },
  },
  {
    id: 'yay-bin',
    names: { arch: 'yay-bin' },
    version: { debian: '', arch: '12.5.2-1', redhat: '' },
    description: 'Yet another yogurt. Pacman wrapper and AUR helper written in go. Pre-compiled.',
    sizeKb: 9_800,
    provides: ['yay'],
    extraRepo: { arch: 'aur' },
  },
  {
    id: 'snowfall',
    names: { arch: 'snowfall' },
    version: { debian: '', arch: '2.0.1-1', redhat: '' },
    description: 'Let it snow in your terminal',
    sizeKb: 48,
    provides: ['snowfall'],
    extraRepo: { arch: 'aur' },
  },
  // ----- Universella format (kapitlet "Flatpak, Snap och AppImage") -----
  {
    id: 'flatpak',
    names: same('flatpak'),
    version: { debian: '1.14.6-1ubuntu0.1', arch: '1:1.16.1-1', redhat: '1.16.1-1.fc43' },
    description: 'Application deployment framework for desktop apps (Flatpak)',
    sizeKb: 6_400,
    provides: ['flatpak'],
    base: ['redhat'],
  },
  {
    id: 'snapd',
    names: same('snapd'),
    version: { debian: '2.71+24.04', arch: '2.71-1', redhat: '2.71-1.fc43' },
    description: 'Daemon and tooling that enable snap packages',
    sizeKb: 98_000,
    provides: ['snap'],
    baseDistros: ['ubuntu'],
    // Snap finns inte i Archs officiella förråd – bara i AUR.
    extraRepo: { arch: 'aur' },
  },
  {
    id: 'fuse2',
    names: { debian: 'libfuse2t64', arch: 'fuse2', redhat: 'fuse-libs' },
    version: { debian: '2.9.9-8.1build1', arch: '2.9.9-5', redhat: '2.9.9-24.fc43' },
    description: 'Filesystem in Userspace (FUSE) v2 library – needed to run AppImages',
    sizeKb: 330,
    provides: [],
  },
];

export function packageName(pkg: PackageDef, family: Family): string | undefined {
  return pkg.names[family];
}

/**
 * Finns paketet i förråden som är aktiverade i skalet? Paket från ett extra förråd
 * (PPA, COPR) syns först när förrådet lagts till; AUR-paket aldrig (de byggs med makepkg).
 * Utan skal räknas bara de vanliga förråden.
 */
export function inRepos(sh: Shell | undefined, pkg: PackageDef): boolean {
  const family = sh?.distro.family;
  if (!family || !pkg.extraRepo) return !pkg.extraRepo;
  return !pkg.extraRepo[family] || extraRepoEnabled(sh, pkg.extraRepo[family]!);
}

/** Paketet finns i förråden eller är redan installerat. */
export const isKnown = (sh: Shell | undefined, pkg: PackageDef) => inRepos(sh, pkg) || (!!sh && isInstalled(sh, pkg));

export function findPackage(family: Family, name: string, sh?: Shell): PackageDef | undefined {
  return PACKAGES.find((p) => p.names[family] === name && isKnown(sh, p));
}

/** Paket som inte kommer från distributionens egna förråd (t.ex. AUR – `pacman -Qm`). */
export function isForeign(family: Family, pkg: PackageDef): boolean {
  return !!pkg.extraRepo?.[family];
}

/** Paket som tillhandahåller ett visst kommando (för "command not found"-tips). */
export function packageProviding(family: Family, command: string): PackageDef | undefined {
  return PACKAGES.find((p) => p.names[family] && p.provides.includes(command) && !p.extraRepo?.[family]);
}

export function availableVersion(sh: Shell, pkg: PackageDef): string {
  const fam = sh.distro.family;
  const v = sh.flags.repoSynced && pkg.newVersion?.[fam] ? pkg.newVersion[fam]! : pkg.version[fam];
  // Debian och Ubuntu delar familj, men versionsnumren ser lite olika ut.
  return sh.distro.id === 'debian' ? v.replace(/ubuntu/g, '+deb13u') : v;
}

export function isInstalled(sh: Shell, pkg: PackageDef): boolean {
  return pkg.id in sh.installed;
}

export function upgradable(sh: Shell): PackageDef[] {
  return PACKAGES.filter((p) => isInstalled(sh, p) && sh.installed[p.id] !== availableVersion(sh, p));
}

export function searchPackages(family: Family, query: string, sh?: Shell): PackageDef[] {
  const q = query.toLowerCase();
  return PACKAGES.filter(
    (p) =>
      p.names[family] &&
      isKnown(sh, p) &&
      (p.names[family]!.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
  ).sort((a, b) => a.names[family]!.localeCompare(b.names[family]!));
}

/** Installerar (eller uppgraderar) paketet: lägger kommandona i /usr/bin. */
export function installPackage(sh: Shell, pkg: PackageDef): void {
  sh.installed[pkg.id] = availableVersion(sh, pkg);
  for (const cmd of pkg.provides) installCommand(sh, cmd);
  if (pkg.shells) updateEtcShells(sh, pkg.shells, true);
}

/** Lägger paketets kommandon i /usr/bin. */
export function placeBinaries(sh: Shell, pkg: PackageDef): void {
  for (const cmd of pkg.provides) installCommand(sh, cmd);
}

/** Lägger en simulerad binärfil för kommandot i /usr/bin. */
export function installCommand(sh: Shell, cmd: string): void {
  const bin = sh.vfs.lookup('/usr/bin', sh.rootUser());
  const node = makeFile(`${ELF}\u0002\u0001\u0001 (simulerad binärfil: ${cmd})`, 'root', cmd === 'sudo' ? 0o4755 : 0o755);
  node.size = 30_000 + ((cmd.length * 7919) % 150_000);
  bin.children![cmd] = node;
}

/** Lägger till eller tar bort skal i /etc/shells (som paketens installationsskript gör). */
function updateEtcShells(sh: Shell, shells: string[], add: boolean): void {
  const root = sh.rootUser();
  const node = sh.vfs.tryLookup('/etc/shells', root);
  if (node?.type !== 'file') return;
  const lines = (node.content ?? '').split('\n').filter((l) => l !== '' && !shells.includes(l));
  if (add) lines.push(...shells);
  node.content = lines.join('\n') + '\n';
}

export function removePackage(sh: Shell, pkg: PackageDef): void {
  delete sh.installed[pkg.id];
  const bin = sh.vfs.lookup('/usr/bin', sh.rootUser());
  for (const cmd of pkg.provides) delete bin.children![cmd];
  if (pkg.shells) updateEtcShells(sh, pkg.shells, false);
}

export function formatKb(kb: number): string {
  if (kb >= 1000) return `${(kb / 1000).toFixed(1).replace('.0', '')} MB`;
  return `${kb} kB`;
}

export function formatMiB(kb: number): string {
  return `${(kb / 1024).toFixed(2)} MiB`;
}
