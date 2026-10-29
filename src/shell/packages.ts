// Paketdatabasen som apt, pacman och dnf i simulatorn använder.
// Samma program kan heta olika saker i olika familjer – det är en viktig poäng!

import type { Family } from './distros';
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
    id: 'util-linux',
    names: same('util-linux'),
    version: { debian: '2.39.3-9ubuntu6', arch: '2.41.2-1', redhat: '2.41.2-1.fc43' },
    description: 'Miscellaneous system utilities (su, more, hostname ...)',
    sizeKb: 9_800,
    provides: ['su', 'more', 'hostname'],
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
    provides: ['pacman'],
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
    id: 'openssh',
    names: { debian: 'openssh-client', arch: 'openssh', redhat: 'openssh-clients' },
    version: { debian: '1:9.6p1-3ubuntu13.14', arch: '10.2p1-1', redhat: '10.0p1-5.fc43' },
    description: 'Secure shell (SSH) client for secure access to remote machines',
    sizeKb: 3_400,
    provides: ['ssh'],
  },
];

export function packageName(pkg: PackageDef, family: Family): string | undefined {
  return pkg.names[family];
}

export function findPackage(family: Family, name: string): PackageDef | undefined {
  return PACKAGES.find((p) => p.names[family] === name);
}

/** Paket som tillhandahåller ett visst kommando (för "command not found"-tips). */
export function packageProviding(family: Family, command: string): PackageDef | undefined {
  return PACKAGES.find((p) => p.names[family] && p.provides.includes(command));
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

export function searchPackages(family: Family, query: string): PackageDef[] {
  const q = query.toLowerCase();
  return PACKAGES.filter(
    (p) => p.names[family] && (p.names[family]!.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
  ).sort((a, b) => a.names[family]!.localeCompare(b.names[family]!));
}

/** Installerar (eller uppgraderar) paketet: lägger kommandona i /usr/bin. */
export function installPackage(sh: Shell, pkg: PackageDef): void {
  sh.installed[pkg.id] = availableVersion(sh, pkg);
  const bin = sh.vfs.lookup('/usr/bin', sh.rootUser());
  for (const cmd of pkg.provides) {
    const node = makeFile(`${ELF}\u0002\u0001\u0001 (simulerad binärfil: ${cmd})`, 'root', cmd === 'sudo' ? 0o4755 : 0o755);
    node.size = 30_000 + ((cmd.length * 7919) % 150_000);
    bin.children![cmd] = node;
  }
}

export function removePackage(sh: Shell, pkg: PackageDef): void {
  delete sh.installed[pkg.id];
  const bin = sh.vfs.lookup('/usr/bin', sh.rootUser());
  for (const cmd of pkg.provides) delete bin.children![cmd];
}

export function formatKb(kb: number): string {
  if (kb >= 1000) return `${(kb / 1000).toFixed(1).replace('.0', '')} MB`;
  return `${kb} kB`;
}

export function formatMiB(kb: number): string {
  return `${(kb / 1024).toFixed(2)} MiB`;
}
