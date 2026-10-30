// Förråd utanför distributionens egna:
//   - PPA (Ubuntu, och med risk Debian): add-apt-repository + apt
//   - AUR (Arch): git clone + makepkg, och AUR-hjälparen yay
//   - COPR (Fedora): dnf copr enable/disable/list
// Plus de påhittade programmen som installeras därifrån (moonphase, snowfall).
// Funktionerna längst ner anropas från apt, pacman och dnf i pkg.ts.

import {
  coprEnabled,
  coprId,
  coprRepoPath,
  ensureDir,
  parseCopr,
  parsePpa,
  PPA_HOST,
  PPA_SUITE,
  ppaListPath,
  ppaSourcesPath,
  ppaUri,
  type Copr,
  type Ppa,
} from '../extrarepo';
import {
  availableVersion,
  findPackage,
  formatMiB,
  installPackage,
  isForeign,
  isInstalled,
  PACKAGES,
  removePackage,
  searchPackages,
  type PackageDef,
} from '../packages';
import type { Shell } from '../shell';
import type { CmdCtx, CommandDef, IO, Sink } from '../types';
import { basename, FsError, makeDir, makeFile } from '../vfs';
import { COLOR, longDate, parseOpts } from './util';

const isRoot = (sh: Shell) => sh.currentUser().uid === 0;
const dim = (sh: Shell, text: { sv: string; en: string }) => `${COLOR.dim}${sh.msg(text)}${COLOR.reset}\n`;
const pkgById = (id: string) => PACKAGES.find((p) => p.id === id)!;

/**
 * Frågar ja/nej om inte assumeYes. Kommer indata från en pipe läses svaret därifrån.
 * (Samma beteende som pakethanterarna i pkg.ts.)
 */
export function askYesNo(
  ctx: CmdCtx,
  question: string,
  defaultYes: boolean,
  assumeYes: boolean,
  onYes: (io: Sink) => number,
  onNo: (io: Sink) => number,
): number {
  if (assumeYes) return onYes(ctx);
  if (ctx.stdin !== null) {
    const answer = ctx.stdin.split('\n')[0].trim();
    ctx.out(question + answer + '\n');
    const yes = answer === '' ? defaultYes : /^(y|yes|j|ja)$/i.test(answer);
    return yes ? onYes(ctx) : onNo(ctx);
  }
  ctx.sh.ask(question, defaultYes, (yes, io) => (yes ? onYes(io) : onNo(io)));
  return 0;
}

/** Ett IO för att köra ett annat kommando inifrån ett svar på en fråga. */
const asIO = (io: Sink): IO => ({ out: io.out, err: io.err, stdin: null, isTTY: true });

/** Skriver en fil som root och skapar katalogerna som behövs. */
function writeRootFile(sh: Shell, path: string, content: string): void {
  ensureDir(sh, path.slice(0, path.lastIndexOf('/')));
  sh.vfs.writeFile(path, content, sh.rootUser());
}

// ================================================================ PPA

interface PpaInfo {
  description: string;
  displayName: string;
  /** Paket (id i packages.ts) som finns i PPA:t. */
  packages: string[];
}

const PPAS: Record<string, PpaInfo> = {
  'lunatool/moonphase': {
    displayName: 'Moonphase',
    description: 'Stable releases of moonphase – shows the phase of the moon in your terminal.\nBuilt for Ubuntu 24.04 LTS (noble).',
    packages: ['moonphase'],
  },
};

const ppaKey = (p: Ppa) => `${p.user}/${p.name}`;

function ppaSources(p: Ppa): string {
  return (
    `Types: deb\nURIs: ${ppaUri(p)}\nSuites: ${PPA_SUITE}\nComponents: main\nSigned-By:\n` +
    ` -----BEGIN PGP PUBLIC KEY BLOCK-----\n .\n mQINBGcx5aEBEADJq3s1mUlEf0lunatoolsimuleradnyckel4QkZb9TnW0c2Lm\n` +
    ` =x7Qe\n -----END PGP PUBLIC KEY BLOCK-----\n`
  );
}

/** Alla PPA:er som finns som .sources-filer i /etc/apt/sources.list.d. */
function configuredPpas(sh: Shell): Ppa[] {
  const dir = sh.vfs.tryLookup('/etc/apt/sources.list.d', sh.rootUser());
  const result: Ppa[] = [];
  for (const node of Object.values(dir?.children ?? {})) {
    const m = new RegExp(`^URIs:\\s*https?://${PPA_HOST.replace(/\./g, '\\.')}/([^/\\s]+)/([^/\\s]+)/ubuntu/?\\s*$`, 'm').exec(node.content ?? '');
    if (node.type === 'file' && m) result.push({ user: m[1], name: m[2] });
  }
  return result;
}

/**
 * Anropas av `apt update`: hämtar paketlistor för tillagda PPA:er och tar bort
 * listor för PPA:er som inte längre finns. `first` är numret på första raden (Get:N).
 */
export function aptUpdatePpas(ctx: CmdCtx, first: number): void {
  const sh = ctx.sh;
  const root = sh.rootUser();
  const ppas = configuredPpas(sh);
  ppas.forEach((p, i) => {
    const base = `${ppaUri(p).replace(/\/$/, '')} ${PPA_SUITE}`;
    if (sh.vfs.tryLookup(ppaListPath(p), root)) {
      ctx.out(`Hit:${first + i} ${base} InRelease\n`);
    } else if (!PPAS[ppaKey(p)]) {
      ctx.out(`Ign:${first + i} ${base} InRelease\nErr:${first + i} ${base} Release\n  404  Not Found [IP: 185.125.190.80 443]\n`);
      ctx.err(`E: The repository '${base} Release' does not have a Release file.\nN: Updating from such a repository can't be done securely, and is therefore disabled by default.\n`);
    } else {
      ctx.out(`Get:${first + i} ${base} InRelease [17.8 kB]\nGet:${first + i + 1} ${base}/main amd64 Packages [1,024 B]\n`);
      writeRootFile(sh, ppaListPath(p), `Origin: LP-PPA-${p.user}-${p.name}\nLabel: ${PPAS[ppaKey(p)].displayName}\nSuite: ${PPA_SUITE}\n`);
    }
  });
  // Paketlistor från PPA:er som tagits bort försvinner vid nästa update.
  const lists = sh.vfs.tryLookup('/var/lib/apt/lists', root);
  for (const name of Object.keys(lists?.children ?? {})) {
    if (!name.startsWith(PPA_HOST + '_')) continue;
    if (!ppas.some((p) => ppaListPath(p).endsWith('/' + name))) delete lists!.children![name];
  }
}

/** Raden som `apt install` visar när ett paket hämtas från ett PPA (annars undefined). */
export function aptPpaMirror(p: PackageDef): string | undefined {
  const ppa = p.extraRepo?.debian ? parsePpa(p.extraRepo.debian) : null;
  return ppa ? `${ppaUri(ppa).replace(/\/$/, '')} ${PPA_SUITE}/main amd64` : undefined;
}

/** `apt policy [PAKET]` – varifrån kommer paketen, och med vilken prioritet? */
export function aptPolicy(ctx: CmdCtx, names: string[]): number {
  const sh = ctx.sh;
  const d = sh.distro;
  const mirror = (d.mirrors[0] ?? 'http://deb.debian.org/debian').split(' ')[0];
  if (!names.length) {
    ctx.out('Package files:\n 100 /var/lib/dpkg/status\n     release a=now\n');
    for (const p of configuredPpas(sh)) {
      if (!sh.vfs.tryLookup(ppaListPath(p), sh.rootUser())) continue;
      ctx.out(` 500 ${ppaUri(p).replace(/\/$/, '')} ${PPA_SUITE}/main amd64 Packages\n     release v=24.04,o=LP-PPA-${p.user}-${p.name},a=${PPA_SUITE},n=${PPA_SUITE},l=${PPAS[ppaKey(p)]?.displayName ?? p.name},c=main,b=amd64\n`);
    }
    if (sh.flags.repoSynced) ctx.out(` 500 ${mirror} ${d.codename}/main amd64 Packages\n     release a=${d.codename},n=${d.codename},c=main,b=amd64\n`);
    ctx.out('Pinned packages:\n');
    return 0;
  }
  for (const n of names) {
    const p = findPackage('debian', n, sh);
    if (!p) {
      ctx.err(`N: Unable to locate package ${n}\n`);
      continue;
    }
    const installed = isInstalled(sh, p) ? sh.installed[p.id] : undefined;
    const ppaLine = aptPpaMirror(p);
    const ppa = p.extraRepo?.debian ? parsePpa(p.extraRepo.debian) : null;
    const candidateHere = ppa ? !!sh.vfs.tryLookup(ppaListPath(ppa), sh.rootUser()) : !!sh.flags.repoSynced;
    const candidate = candidateHere ? availableVersion(sh, p) : installed;
    ctx.out(`${n}:\n  Installed: ${installed ?? '(none)'}\n  Candidate: ${candidate ?? '(none)'}\n  Version table:\n`);
    if (candidateHere) {
      ctx.out(` ${installed === candidate ? '***' : '   '} ${candidate} 500\n        500 ${ppaLine ?? `${mirror} ${d.codename}/main amd64`} Packages\n`);
      if (installed === candidate) ctx.out('        100 /var/lib/dpkg/status\n');
    }
    if (installed && (installed !== candidate || !candidateHere)) ctx.out(` *** ${installed} 100\n        100 /var/lib/dpkg/status\n`);
  }
  return 0;
}

const addAptRepository: CommandDef = {
  name: 'add-apt-repository',
  summary: 'Lägger till ett förråd (t.ex. ett PPA) för apt',
  summaryEn: 'Adds a repository (e.g. a PPA) for apt',
  man: `NAMN
       add-apt-repository - lägg till eller ta bort förråd för apt

SYNOPSIS
       add-apt-repository [-y] [-n] [-r] FÖRRÅD

BESKRIVNING
       Lägger till ett förråd, oftast ett PPA (Personal Package Archive)
       från Launchpad: ppa:användare/namn. En fil skapas i
       /etc/apt/sources.list.d/ och därefter körs "apt update" så att de
       nya paketen syns. Kommandot finns i paketet
       software-properties-common.

       PPA:er byggs för Ubuntu. I Debian kan de krocka med systemets egna
       bibliotek. Lägg bara till PPA:er från utvecklare du litar på – de
       kan ersätta vilket paket som helst på datorn.

FLAGGOR
       -y, --yes         fråga inte om bekräftelse
       -r, --remove      ta bort förrådet i stället
       -n, --no-update   kör inte "apt update" efteråt
       -L, --list        lista förråden som är tillagda

EXEMPEL
       sudo add-apt-repository ppa:lunatool/moonphase
       sudo add-apt-repository --remove ppa:lunatool/moonphase`,
  manEn: `NAME
       add-apt-repository - add or remove apt repositories

SYNOPSIS
       add-apt-repository [-y] [-n] [-r] REPOSITORY

DESCRIPTION
       Adds a repository, usually a PPA (Personal Package Archive) from
       Launchpad: ppa:user/name. A file is created in
       /etc/apt/sources.list.d/ and "apt update" is then run so that the
       new packages show up. The command is in the package
       software-properties-common.

       PPAs are built for Ubuntu. On Debian they may clash with the
       system's own libraries. Only add PPAs from developers you trust -
       they can replace any package on the computer.

OPTIONS
       -y, --yes         don't ask for confirmation
       -r, --remove      remove the repository instead
       -n, --no-update   don't run "apt update" afterwards
       -L, --list        list the repositories that have been added

EXAMPLES
       sudo add-apt-repository ppa:lunatool/moonphase
       sudo add-apt-repository --remove ppa:lunatool/moonphase`,
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, {
      flags: 'yrnhL',
      long: { yes: 'y', remove: 'r', 'no-update': 'n', help: 'h', list: 'L' },
    });
    if (o.error) {
      ctx.err(`usage: add-apt-repository [-h] [-d] [-r] [-s] [-c COMPONENT] [-p POCKET] [-y] [-n] [-L] [line]\nadd-apt-repository: error: ${o.error}\n`);
      return 2;
    }
    if (o.flags.has('h')) {
      ctx.out('usage: add-apt-repository [-h] [-d] [-r] [-s] [-c COMPONENT] [-p POCKET] [-y] [-n] [-L] [line]\n\nOnly ONE operation can be performed per invocation.\n');
      return 0;
    }
    if (o.flags.has('L')) {
      const node = sh.vfs.tryLookup('/etc/apt/sources.list.d', sh.rootUser());
      for (const f of Object.values(node?.children ?? {})) {
        const c = f.content ?? '';
        const uri = /^URIs:\s*(\S+)/m.exec(c)?.[1];
        const suites = /^Suites:\s*(.+)$/m.exec(c)?.[1].split(/\s+/) ?? [];
        const comps = /^Components:\s*(.+)$/m.exec(c)?.[1] ?? '';
        for (const s of suites) if (uri) ctx.out(`deb ${uri} ${s} ${comps}\n`);
      }
      return 0;
    }
    const spec = o.operands.join(' ');
    if (!spec) {
      ctx.err('Error: need a repository as argument\n');
      return 1;
    }
    if (!isRoot(sh)) {
      ctx.err('Error: must run as root\n');
      return 1;
    }
    if (/^(main|restricted|universe|multiverse)$/.test(spec)) {
      if (sh.distro.id === 'ubuntu') {
        ctx.out(`'${spec}' distribution component is already enabled for all sources.\n`);
        return 0;
      }
      ctx.out(`Adding component(s) '${spec}' to all repositories.\n`);
      ctx.out(dim(sh, { sv: `(Komponenten ${spec} finns bara i Ubuntu – Debian har main, contrib och non-free.)`, en: `(The ${spec} component only exists in Ubuntu - Debian has main, contrib and non-free.)` }));
      return 0;
    }
    const ppa = parsePpa(spec);
    if (!ppa) {
      ctx.err(`Error: '${spec}' invalid\n`);
      ctx.err(dim(sh, { sv: 'Tips från simulatorn: ett PPA skrivs ppa:användare/namn, t.ex. ppa:lunatool/moonphase.', en: 'Simulator tip: a PPA is written ppa:user/name, e.g. ppa:lunatool/moonphase.' }));
      return 1;
    }
    const info = PPAS[ppaKey(ppa)];
    const path = ppaSourcesPath(ppa);
    const removing = o.flags.has('r');
    if (!info && !removing) {
      ctx.err(`ERROR: ppa '${ppaKey(ppa)}' not found (use --login if private)\n`);
      return 1;
    }
    if (removing && !sh.vfs.tryLookup(path, sh.rootUser())) {
      ctx.err(`Error: repository '${spec}' is not present\n`);
      return 1;
    }
    ctx.out(`Repository: 'Types: deb\nURIs: ${ppaUri(ppa)}\nSuites: ${PPA_SUITE}\nComponents: main\n'\n`);
    if (info) ctx.out(`Description:\n${info.description}\nMore info: https://launchpad.net/~${ppa.user}/+archive/ubuntu/${ppa.name}\n`);
    ctx.out(removing ? 'Removing repository.\n' : 'Adding repository.\n');
    if (!removing && sh.distro.id !== 'ubuntu') {
      ctx.out(
        dim(sh, {
          sv: `Varning från simulatorn: PPA:er byggs för Ubuntu (här ${PPA_SUITE}), inte för ${sh.distro.name}. Paketen kan kräva andra versioner av bibliotek än de Debian har och göra systemet trasigt.`,
          en: `Simulator warning: PPAs are built for Ubuntu (here ${PPA_SUITE}), not for ${sh.distro.name}. The packages may need other library versions than Debian has and can break the system.`,
        }),
      );
    }
    const apply = (io: Sink) => {
      if (removing) sh.vfs.remove(path, sh.rootUser());
      else writeRootFile(sh, path, ppaSources(ppa));
      if (o.flags.has('n')) return 0;
      return sh.invoke(['apt', 'update'], asIO(io));
    };
    return askYesNo(ctx, 'Press [ENTER] to continue or Ctrl-c to cancel.', true, o.flags.has('y'), apply, (io) => {
      io.out('Aborted.\n');
      return 1;
    });
  },
};

// ================================================================ COPR

interface CoprInfo {
  description: string;
  packages: string[];
}

const COPRS: Record<string, CoprInfo> = {
  'lunatool/moonphase': { description: 'moonphase – the phase of the moon in your terminal', packages: ['moonphase'] },
};

const coprName = (c: Copr) => `${c.owner}/${c.project}`;
const coprFull = (c: Copr) => `copr.fedorainfracloud.org/${coprName(c)}`;

function coprRepoFile(c: Copr): string {
  const dl = `https://download.copr.fedorainfracloud.org/results/${coprName(c)}`;
  return (
    `[${coprId(c)}]\nname=Copr repo for ${c.project} owned by ${c.owner}\nbaseurl=${dl}/fedora-$releasever-$basearch/\n` +
    `type=rpm-md\nskip_if_unavailable=True\ngpgcheck=1\ngpgkey=${dl}/pubkey.gpg\nrepo_gpgcheck=0\nenabled=1\nenabled_metadata=1\n`
  );
}

/** Alla COPR-förråd som finns som .repo-filer i /etc/yum.repos.d. */
function configuredCoprs(sh: Shell): Copr[] {
  const dir = sh.vfs.tryLookup('/etc/yum.repos.d', sh.rootUser());
  const result: Copr[] = [];
  for (const name of Object.keys(dir?.children ?? {}).sort()) {
    const m = /^_copr:copr\.fedorainfracloud\.org:([^:]+):(.+)\.repo$/.exec(name);
    if (m) result.push({ owner: m[1].replace(/^group_/, '@'), project: m[2] });
  }
  return result;
}

/** Förrådets namn i dnf (t.ex. i "Repository"-kolumnen). */
export function dnfRepoId(p: PackageDef): string {
  const copr = p.extraRepo?.redhat ? parseCopr(p.extraRepo.redhat) : null;
  return copr ? coprId(copr) : 'fedora';
}

/** Rader för `dnf repolist`: aktiverade COPR-förråd. */
export function dnfCoprRepolist(sh: Shell): string {
  return configuredCoprs(sh)
    .filter((c) => coprEnabled(sh, c))
    .map((c) => `${coprId(c).padEnd(32)} Copr repo for ${c.project} owned by ${c.owner}\n`)
    .join('');
}

/** `dnf copr enable|disable|remove|list`. */
export function dnfCopr(ctx: CmdCtx, args: string[]): number {
  const sh = ctx.sh;
  const assumeYes = args.includes('-y') || args.includes('--assumeyes') || ctx.args.includes('-y') || ctx.args.includes('--assumeyes');
  const [action, spec] = args.filter((a) => !a.startsWith('-'));
  const rootError = () => {
    ctx.err('This command has to be run with superuser privileges (under the root user on most systems).\n');
    return 1;
  };
  const usage = () =>
    ctx.out(
      'Usage:\n  dnf5 [GLOBAL OPTIONS] copr <COMMAND> ...\n\nCommands:\n  list     list Copr repositories\n  enable   download the repository info from a Copr server and install it\n' +
        '  disable  disable specified Copr repository (if exists), keep the repo file\n  remove   remove specified Copr repository from the system\n',
    );
  if (!action || action === '--help' || action === 'help') {
    usage();
    return action ? 0 : 2;
  }
  if (action === 'list') {
    for (const c of configuredCoprs(sh)) ctx.out(`${coprFull(c)}${coprEnabled(sh, c) ? '' : ' (disabled)'}\n`);
    return 0;
  }
  if (!['enable', 'disable', 'remove'].includes(action)) {
    ctx.err(`Unknown argument "${action}" for command "copr". Add "--help" for more information about the arguments.\n`);
    return 2;
  }
  const copr = spec ? parseCopr(spec) : null;
  if (!copr) {
    ctx.err(spec ? `Can't parse Copr repo spec: '${spec}'\n` : `Missing positional argument "PROJECT_SPEC" for command "${action}".\n`);
    return 2;
  }
  if (!isRoot(sh)) return rootError();
  const path = coprRepoPath(copr);
  const exists = !!sh.vfs.tryLookup(path, sh.rootUser());
  if (action === 'enable') {
    if (!COPRS[coprName(copr)]) {
      ctx.err(`Failed to download Copr project info from https://copr.fedorainfracloud.org/api_3/project/?ownername=${copr.owner}&projectname=${copr.project}: 404 Not Found\n`);
      return 1;
    }
    ctx.out(
      `Enabling a Copr repository. Please note that this repository is not part\nof the main distribution, and quality may vary.\n\n` +
        `The Fedora Project does not exercise any power over the contents of\nthis repository beyond the rules outlined in the Copr FAQ at\n` +
        `<https://docs.pagure.org/copr.copr/user_documentation.html#what-i-can-build-in-copr>,\nand packages are not held to any quality or security level.\n\n` +
        `Please do not file bug reports about these packages in Fedora\nBugzilla. In case of problems, contact the owner of this repository.\n\n`,
    );
    return askYesNo(
      ctx,
      `Do you really want to enable ${coprFull(copr)}? [y/N]: `,
      false,
      assumeYes,
      (io) => {
        writeRootFile(sh, path, coprRepoFile(copr));
        io.out(`Copr repository '${coprFull(copr)}' enabled in '${path}'.\n`);
        return 0;
      },
      (io) => {
        io.out('Operation aborted by the user.\n');
        return 1;
      },
    );
  }
  if (!exists) {
    ctx.err(`Repository '${coprFull(copr)}' not found on this system\n`);
    return 1;
  }
  if (action === 'disable') {
    const node = sh.vfs.lookup(path, sh.rootUser());
    node.content = (node.content ?? '').replace(/^enabled\s*=.*$/m, 'enabled=0');
    ctx.out(`Copr repository '${coprFull(copr)}' in '${path}' disabled.\n`);
    return 0;
  }
  sh.vfs.remove(path, sh.rootUser());
  ctx.out(`Repository '${coprFull(copr)}' removed.\n`);
  return 0;
}

// ================================================================ AUR

interface AurEntry {
  /** Paketets id i packages.ts. */
  pkgId: string;
  pkgver: string;
  pkgrel: string;
  url: string;
  license: string;
  maintainer: string;
  depends: string[];
  makedepends: string[];
  provides?: string[];
  conflicts?: string[];
  /** Källfiler som makepkg hämtar. */
  sources: string[];
  /** Kommandon i build() – visas när paketet byggs. Tom för färdigbyggda -bin-paket. */
  build: string[];
  package: string[];
  votes: number;
  popularity: number;
}

const AUR: Record<string, AurEntry> = {
  moonphase: {
    pkgId: 'moonphase',
    pkgver: '1.4.2',
    pkgrel: '1',
    url: 'https://moonphase.example.org',
    license: 'MIT',
    maintainer: 'Luna Toolsmith <luna at lunatool dot example dot org>',
    depends: ['glibc'],
    makedepends: [],
    sources: ['$pkgname-$pkgver.tar.gz::https://moonphase.example.org/releases/$pkgname-$pkgver.tar.gz'],
    build: ['cd "$pkgname-$pkgver"', 'make PREFIX=/usr'],
    package: ['cd "$pkgname-$pkgver"', 'make PREFIX=/usr DESTDIR="$pkgdir" install', 'install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"'],
    votes: 87,
    popularity: 1.42,
  },
  snowfall: {
    pkgId: 'snowfall',
    pkgver: '2.0.1',
    pkgrel: '1',
    url: 'https://snowfall.example.org',
    license: 'GPL-3.0-or-later',
    maintainer: 'Frost Pixel <frost at example dot org>',
    depends: ['ncurses'],
    makedepends: [],
    sources: ['$pkgname-$pkgver.tar.gz::https://snowfall.example.org/$pkgname-$pkgver.tar.gz'],
    build: ['cd "$pkgname-$pkgver"', 'make'],
    package: ['cd "$pkgname-$pkgver"', 'install -Dm755 snowfall "$pkgdir/usr/bin/snowfall"'],
    votes: 42,
    popularity: 0.85,
  },
  'yay-bin': {
    pkgId: 'yay-bin',
    pkgver: '12.5.2',
    pkgrel: '1',
    url: 'https://github.com/Jguer/yay',
    license: 'GPL-3.0-or-later',
    maintainer: 'Jguer <pkgbuilds at jguer.space>',
    depends: ['pacman>6.1', 'git'],
    makedepends: [],
    provides: ['yay'],
    conflicts: ['yay'],
    sources: ['https://github.com/Jguer/yay/releases/download/v$pkgver/yay_${pkgver}_x86_64.tar.gz'],
    build: [],
    package: ['cd "yay_${pkgver}_x86_64"', 'install -Dm755 yay "$pkgdir/usr/bin/yay"', 'install -Dm644 yay.8 "$pkgdir/usr/share/man/man8/yay.8"'],
    votes: 1350,
    popularity: 28.9,
  },
  yay: {
    pkgId: 'yay',
    pkgver: '12.5.2',
    pkgrel: '1',
    url: 'https://github.com/Jguer/yay',
    license: 'GPL-3.0-or-later',
    maintainer: 'Jguer <pkgbuilds at jguer.space>',
    depends: ['pacman>6.1', 'git'],
    makedepends: ['go>=1.24'],
    conflicts: ['yay-bin'],
    sources: ['$pkgname-$pkgver.tar.gz::https://github.com/Jguer/yay/archive/v$pkgver.tar.gz'],
    build: ['export GOFLAGS="-buildmode=pie -trimpath -mod=readonly -modcacherw"', 'cd "$srcdir/$pkgname-$pkgver"', 'make VERSION=$pkgver DESTDIR="$pkgdir" PREFIX="/usr" build'],
    package: ['cd "$srcdir/$pkgname-$pkgver"', 'make VERSION=$pkgver DESTDIR="$pkgdir" PREFIX="/usr" install'],
    votes: 2480,
    popularity: 18.3,
  },
  snapd: {
    pkgId: 'snapd',
    pkgver: '2.71',
    pkgrel: '1',
    url: 'https://github.com/canonical/snapd',
    license: 'GPL-3.0-only',
    maintainer: 'Maciej Borzecki <maciek.borzecki at gmail dot com>',
    depends: ['squashfs-tools', 'libseccomp', 'libsystemd', 'apparmor'],
    makedepends: ['go'],
    sources: ['$pkgname-$pkgver.tar.xz::https://github.com/canonical/$pkgname/releases/download/$pkgver/${pkgname}_$pkgver.vendor.tar.xz'],
    build: ['cd "$pkgname-$pkgver"', './mkversion.sh $pkgver-$pkgrel', 'go build -o "$srcdir/go/bin/snap" ./cmd/snap', 'go build -o "$srcdir/go/bin/snapd" ./cmd/snapd'],
    package: ['cd "$pkgname-$pkgver"', 'make -C data install DESTDIR="$pkgdir" BINDIR=/usr/bin', 'install -Dm755 "$srcdir/go/bin/snap" "$pkgdir/usr/bin/snap"'],
    votes: 410,
    popularity: 2.1,
  },
};

const arr = (xs: string[]) => `(${xs.map((x) => `'${x}'`).join(' ')})`;

function pkgbuild(name: string, e: AurEntry): string {
  const p = pkgById(e.pkgId);
  const lines = [
    `# Maintainer: ${e.maintainer}`,
    '',
    `pkgname=${name}`,
    `pkgver=${e.pkgver}`,
    `pkgrel=${e.pkgrel}`,
    `pkgdesc="${p.description}"`,
    `arch=('x86_64')`,
    `url="${e.url}"`,
    `license=('${e.license}')`,
    `depends=${arr(e.depends)}`,
    ...(e.makedepends.length ? [`makedepends=${arr(e.makedepends)}`] : []),
    ...(e.provides ? [`provides=${arr(e.provides)}`] : []),
    ...(e.conflicts ? [`conflicts=${arr(e.conflicts)}`] : []),
    `source=(${e.sources.map((s) => `"${s}"`).join(' ')})`,
    `sha256sums=('${'4f1c2b9e7d'.repeat(6)}6a3c')`,
    '',
  ];
  if (e.build.length) lines.push('build() {', ...e.build.map((l) => `  ${l}`), '}', '');
  lines.push('package() {', ...e.package.map((l) => `  ${l}`), '}');
  return lines.join('\n') + '\n';
}

function srcinfo(name: string, e: AurEntry): string {
  const p = pkgById(e.pkgId);
  return (
    `pkgbase = ${name}\n\tpkgdesc = ${p.description}\n\tpkgver = ${e.pkgver}\n\tpkgrel = ${e.pkgrel}\n\turl = ${e.url}\n\tarch = x86_64\n\tlicense = ${e.license}\n` +
    e.makedepends.map((d) => `\tmakedepends = ${d}\n`).join('') +
    e.depends.map((d) => `\tdepends = ${d}\n`).join('') +
    `\npkgname = ${name}\n`
  );
}

/** Filnamnen på källfilerna med $pkgname och $pkgver ifyllda. */
function sourceFiles(name: string, e: AurEntry): string[] {
  return e.sources.map((s) => {
    const filled = s.replace(/\$\{?pkgname\}?/g, name).replace(/\$\{?pkgver\}?/g, e.pkgver);
    return filled.includes('::') ? filled.split('::')[0] : filled.slice(filled.lastIndexOf('/') + 1);
  });
}

const pkgFileName = (name: string, e: AurEntry) => `${name}-${e.pkgver}-${e.pkgrel}-x86_64.pkg.tar.zst`;

/**
 * `git clone https://aur.archlinux.org/PAKET.git [KATALOG]` – hämtar byggreceptet.
 * Returnerar null om adressen inte går till AUR (då får git sköta det som vanligt).
 * Ett git-kommando som klonar på riktigt bör anropa den här funktionen först.
 */
export function aurClone(ctx: CmdCtx, args: string[]): number | null {
  const sh = ctx.sh;
  const operands = args.filter((a) => !a.startsWith('-'));
  const url = operands[0];
  const m = url ? /^(?:https?:\/\/|ssh:\/\/aur@|aur@)aur\.archlinux\.org[/:]([^/]+?)(?:\.git)?\/?$/.exec(url) : null;
  if (!m) return null;
  const name = m[1];
  const dest = operands[1] ?? name;
  const path = sh.resolve(dest);
  const user = sh.currentUser();
  const existing = sh.vfs.tryLookup(path, user);
  if (existing && (existing.type !== 'dir' || Object.keys(existing.children ?? {}).length)) {
    ctx.err(`fatal: destination path '${dest}' already exists and is not an empty directory.\n`);
    return 128;
  }
  try {
    if (!existing) sh.vfs.mkdir(path, user);
  } catch (e) {
    if (!(e instanceof FsError)) throw e;
    ctx.err(`fatal: could not create work tree dir '${dest}': ${e.message}\n`);
    return 128;
  }
  ctx.err(`Cloning into '${dest}'...\n`);
  const g = user.groups[0];
  const dir = sh.vfs.lookup(path, user);
  dir.children!['.git'] = makeDir(user.name, 0o755, {
    HEAD: makeFile('ref: refs/heads/master\n', user.name, 0o644, g),
    config: makeFile(`[core]\n\trepositoryformatversion = 0\n\tbare = false\n[remote "origin"]\n\turl = ${url}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "master"]\n\tremote = origin\n\tmerge = refs/heads/master\n`, user.name, 0o644, g),
    objects: makeDir(user.name, 0o755, {}, g),
    refs: makeDir(user.name, 0o755, { heads: makeDir(user.name, 0o755, {}, g) }, g),
  }, g);
  const entry = AUR[name];
  if (!entry) {
    // Precis som på riktigt: AUR låter dig klona vad som helst – finns paketet inte blir katalogen tom.
    ctx.err('warning: You appear to have cloned an empty repository.\n');
    ctx.err(dim(sh, { sv: `(Det finns inget AUR-paket som heter "${name}". Kontrollera namnet på aur.archlinux.org eller med "yay -Ss".)`, en: `(There is no AUR package called "${name}". Check the name on aur.archlinux.org or with "yay -Ss".)` }));
    return 0;
  }
  dir.children!.PKGBUILD = makeFile(pkgbuild(name, entry), user.name, 0o644, g);
  dir.children!['.SRCINFO'] = makeFile(srcinfo(name, entry), user.name, 0o644, g);
  ctx.err(
    'remote: Enumerating objects: 24, done.\nremote: Counting objects: 100% (24/24), done.\nremote: Compressing objects: 100% (20/20), done.\n' +
      'remote: Total 24 (delta 4), reused 24 (delta 4), pack-reused 0 (from 0)\nReceiving objects: 100% (24/24), 6.12 KiB | 6.12 MiB/s, done.\nResolving deltas: 100% (4/4), done.\n',
  );
  return 0;
}

const BAR = (label: string) => `${label.padEnd(48)} [${'#'.repeat(22)}] 100%\n`;

/** Visar paketlistan och frågar som `pacman -U`/`pacman -S`, installerar sedan. */
function pacmanTransaction(
  ctx: CmdCtx,
  pkgs: PackageDef[],
  noconfirm: boolean,
  done: (io: Sink) => number,
  onNo: (io: Sink) => number,
): number {
  const sh = ctx.sh;
  const full = (p: PackageDef) => `${p.names.arch}-${availableVersion(sh, p)}`;
  const size = pkgs.reduce((s, p) => s + p.sizeKb, 0);
  ctx.out(`loading packages...\nresolving dependencies...\nlooking for conflicting packages...\n\nPackages (${pkgs.length}) ${pkgs.map(full).join('  ')}\n\nTotal Installed Size:  ${formatMiB(size)}\n\n`);
  return askYesNo(
    ctx,
    ':: Proceed with installation? [Y/n] ',
    true,
    noconfirm,
    (io) => {
      const n = pkgs.length;
      for (const step of ['checking keys in keyring', 'checking package integrity', 'loading package files', 'checking for file conflicts']) io.out(BAR(`(${n}/${n}) ${step}`));
      io.out(':: Processing package changes...\n');
      pkgs.forEach((p, i) => {
        // Paket som krockar (t.ex. yay och yay-bin) byts ut.
        for (const c of AUR[p.names.arch!]?.conflicts ?? []) {
          const other = findPackage('arch', c, sh);
          if (other && isInstalled(sh, other)) {
            io.out(`:: ${p.names.arch} and ${c} are in conflict. Removing ${c}.\n`);
            removePackage(sh, other);
          }
        }
        io.out(BAR(`(${i + 1}/${n}) ${isInstalled(sh, p) ? 'reinstalling' : 'installing'} ${p.names.arch}`));
        installPackage(sh, p);
      });
      io.out(':: Running post-transaction hooks...\n(1/1) Arming ConditionNeedsUpdate...\n');
      return done(io);
    },
    onNo,
  );
}

/** Beroenden (från Archs vanliga förråd) som saknas. Okända namn som glibc räknas som installerade. */
function missingDeps(sh: Shell, deps: string[]): { spec: string; pkg: PackageDef }[] {
  const result: { spec: string; pkg: PackageDef }[] = [];
  for (const spec of deps) {
    const pkg = findPackage('arch', spec.replace(/[<>=].*$/, ''), sh);
    if (pkg && !isInstalled(sh, pkg) && !isForeign('arch', pkg)) result.push({ spec, pkg });
  }
  return result;
}

const MAKEPKG_TIDY = '==> Tidying install...\n  -> Removing libtool files...\n  -> Purging unwanted files...\n  -> Removing static library files...\n  -> Stripping unneeded symbols from binaries and libraries...\n  -> Compressing man and info pages...\n==> Checking for packaging issues...\n';

const makepkg: CommandDef = {
  name: 'makepkg',
  summary: 'Bygger ett Arch-paket från en PKGBUILD (t.ex. från AUR)',
  summaryEn: 'Builds an Arch package from a PKGBUILD (e.g. from the AUR)',
  man: `NAMN
       makepkg - bygg paket från en PKGBUILD

SYNOPSIS
       makepkg [-s] [-i] [-c] [-f] [--noconfirm]

BESKRIVNING
       Läser filen PKGBUILD i den aktuella katalogen, hämtar källkoden,
       bygger programmet och packar det som en .pkg.tar.zst-fil som
       pacman kan installera. Så installerar man paket från AUR:

           git clone https://aur.archlinux.org/PAKET.git
           cd PAKET
           less PKGBUILD        (läs alltid receptet först!)
           makepkg -si

       makepkg vägrar köras som root – bygg som vanlig användare.
       Installationssteget (-i) använder sudo pacman själv. Paketgruppen
       base-devel (med bl.a. gcc, make och fakeroot) behövs för att bygga.

FLAGGOR
       -s, --syncdeps    installera beroenden som saknas med pacman
       -i, --install     installera paketet efter bygget
       -c, --clean       städa bort byggfilerna efteråt
       -f, --force       bygg om även om paketet redan är byggt
       --noconfirm       fråga inte om bekräftelse

EXEMPEL
       makepkg -si`,
  manEn: `NAME
       makepkg - build packages from a PKGBUILD

SYNOPSIS
       makepkg [-s] [-i] [-c] [-f] [--noconfirm]

DESCRIPTION
       Reads the file PKGBUILD in the current directory, downloads the
       source code, builds the program and packs it as a .pkg.tar.zst
       file that pacman can install. This is how packages from the AUR
       are installed:

           git clone https://aur.archlinux.org/PACKAGE.git
           cd PACKAGE
           less PKGBUILD        (always read the recipe first!)
           makepkg -si

       makepkg refuses to run as root - build as a normal user. The
       install step (-i) uses sudo pacman itself. The base-devel package
       group (gcc, make, fakeroot ...) is needed to build.

OPTIONS
       -s, --syncdeps    install missing dependencies with pacman
       -i, --install     install the package after building it
       -c, --clean       clean up the build files afterwards
       -f, --force       rebuild even if the package is already built
       --noconfirm       don't ask for confirmation

EXAMPLES
       makepkg -si`,
  run(ctx) {
    const sh = ctx.sh;
    const o = parseOpts(ctx.args, {
      flags: 'sicfrCLhV',
      long: { syncdeps: 's', install: 'i', clean: 'c', force: 'f', rmdeps: 'r', cleanbuild: 'C', log: 'L', help: 'h', version: 'V', noconfirm: 'N', needed: 'n' },
    });
    if (o.error) {
      ctx.err(`==> ERROR: ${o.error}\n`);
      return 1;
    }
    if (o.flags.has('V')) {
      ctx.out('makepkg (pacman) 7.0.0\n');
      return 0;
    }
    if (o.flags.has('h')) {
      ctx.out('makepkg (pacman) 7.0.0\nMake packages compatible for use with pacman\n\nUsage: makepkg [options]\n\nOptions:\n  -c, --clean      Clean up work files after build\n  -f, --force      Overwrite existing package\n  -i, --install    Install package after successful build\n  -s, --syncdeps   Install missing dependencies with pacman\n  --noconfirm      Do not ask for confirmation when resolving dependencies\n');
      return 0;
    }
    if (isRoot(sh)) {
      ctx.err('==> ERROR: Running makepkg as root is not allowed as it can cause permanent,\ncatastrophic damage to your system.\n');
      ctx.err(dim(sh, { sv: 'Tips från simulatorn: kör makepkg utan sudo. Den använder sudo själv när paketet ska installeras.', en: 'Simulator tip: run makepkg without sudo. It uses sudo by itself when the package is installed.' }));
      return 10;
    }
    const dir = sh.cwd;
    const user = sh.currentUser();
    let recipe: string;
    try {
      recipe = sh.vfs.readFile(`${dir}/PKGBUILD`, user);
    } catch {
      ctx.err('==> ERROR: PKGBUILD does not exist.\n');
      if (sh.vfs.tryLookup(`${dir}/.git`, user)) {
        ctx.err(dim(sh, { sv: '(Katalogen är tom – kanske fanns inget AUR-paket med det namnet?)', en: '(The directory is empty - maybe there was no AUR package with that name?)' }));
      }
      return 1;
    }
    const name = /^pkgname=['"]?([^'"\s]+)/m.exec(recipe)?.[1] ?? basename(dir);
    const entry = AUR[name];
    if (!sh.installed['base-devel']) {
      ctx.err('==> ERROR: Cannot find the fakeroot binary.\n');
      ctx.err(dim(sh, { sv: 'Tips från simulatorn: installera byggverktygen först: sudo pacman -S --needed base-devel', en: 'Simulator tip: install the build tools first: sudo pacman -S --needed base-devel' }));
      return 1;
    }
    if (!entry) {
      const src = /^source=\(["']?([^"'\s)]+)/m.exec(recipe)?.[1] ?? name;
      ctx.out(`==> Making package: ${name} (${longDate()})\n==> Retrieving sources...\n`);
      ctx.err(`==> ERROR: Failure while downloading ${src}\n    Aborting...\n`);
      ctx.err(dim(sh, { sv: '(Simulatorn kan bara bygga paketen som finns i dess låtsas-AUR.)', en: '(The simulator can only build the packages in its pretend AUR.)' }));
      return 1;
    }
    const pkg = pkgById(entry.pkgId);
    const full = `${name} ${entry.pkgver}-${entry.pkgrel}`;
    const pkgFile = `${dir}/${pkgFileName(name, entry)}`;
    const noconfirm = o.flags.has('N');

    const install = (io: Sink): number => {
      io.out(`==> Installing package ${name} with pacman -U...\n`);
      return sh.runAs('root', () =>
        pacmanTransaction(
          { ...ctx, ...asIO(io) },
          [pkg],
          noconfirm,
          () => 0,
          (io2) => {
            io2.out('==> WARNING: Failed to install built package(s).\n');
            return 0;
          },
        ),
      );
    };

    if (sh.vfs.tryLookup(pkgFile, user) && !o.flags.has('f')) {
      if (o.flags.has('i')) {
        ctx.err('==> WARNING: A package has already been built, installing existing package...\n');
        return install(ctx);
      }
      ctx.err('==> ERROR: A package has already been built. (use -f to overwrite)\n');
      return 13;
    }

    const build = (io: Sink): number => {
      const g = user.groups[0];
      const write = (path: string, node: ReturnType<typeof makeFile>) => sh.vfs.insert(path, node, user);
      try {
        io.out('==> Retrieving sources...\n');
        for (const f of sourceFiles(name, entry)) {
          io.out(`  -> Downloading ${f}...\n`);
          const node = makeFile(`(källkod för ${name} – simulerad)\n`, user.name, 0o644, g);
          node.size = Math.round(pkg.sizeKb * 300);
          write(`${dir}/${f}`, node);
        }
        io.out('==> Validating source files with sha256sums...\n');
        for (const f of sourceFiles(name, entry)) io.out(`    ${f} ... Passed\n`);
        io.out('==> Removing existing $srcdir/ directory...\n==> Extracting sources...\n');
        for (const f of sourceFiles(name, entry)) io.out(`  -> Extracting ${f} with bsdtar\n`);
        write(`${dir}/src`, makeDir(user.name, 0o755, { [`${name}-${entry.pkgver}`]: makeDir(user.name, 0o755, {}, g) }, g));
        if (entry.build.length) {
          io.out('==> Starting build()...\n');
          if (name === 'yay' || name === 'snapd') io.out(`go: downloading modules for ${name}...\ngo build -trimpath -buildmode=pie -o ${name === 'yay' ? 'yay' : 'snap'} .\n`);
          else io.out(`cc -O2 -pipe -fno-plt -fexceptions -Wall -o ${name} src/main.c src/${name === 'moonphase' ? 'phase' : 'flakes'}.c ${name === 'moonphase' ? '-lm' : '-lncursesw'}\n`);
        }
        io.out('==> Entering fakeroot environment...\n==> Starting package()...\n');
        io.out(`install -Dm755 ${name.replace(/-bin$/, '')} "${dir}/pkg/${name}/usr/bin/${pkg.provides[0] ?? name}"\n`);
        write(`${dir}/pkg`, makeDir(user.name, 0o755, { [name]: makeDir(user.name, 0o755, {}, g) }, g));
        io.out(MAKEPKG_TIDY);
        io.out(`==> Creating package "${name}"...\n  -> Generating .PKGINFO file...\n  -> Generating .BUILDINFO file...\n  -> Generating .MTREE file...\n  -> Compressing package...\n`);
        const out = makeFile(`(byggt paket ${name}-${entry.pkgver}-${entry.pkgrel} – simulerat)\n`, user.name, 0o644, g);
        out.size = Math.round(pkg.sizeKb * 400);
        write(pkgFile, out);
        io.out(`==> Leaving fakeroot environment.\n==> Finished making: ${full} (${longDate()})\n`);
        if (o.flags.has('c')) {
          io.out('==> Cleaning up...\n');
          sh.vfs.remove(`${dir}/src`, user);
          sh.vfs.remove(`${dir}/pkg`, user);
        }
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        io.err(`==> ERROR: Cannot write to the build directory: ${e.message}\n`);
        return 1;
      }
      return o.flags.has('i') ? install(io) : 0;
    };

    ctx.out(`==> Making package: ${full} (${longDate()})\n==> Checking runtime dependencies...\n==> Checking buildtime dependencies...\n`);
    const missing = missingDeps(sh, [...entry.depends, ...entry.makedepends]);
    if (!missing.length) return build(ctx);
    if (!o.flags.has('s')) {
      ctx.err(`==> Missing dependencies:\n${missing.map((m) => `  -> ${m.spec}\n`).join('')}==> ERROR: Could not resolve all dependencies.\n`);
      ctx.err(dim(sh, { sv: 'Tips från simulatorn: med -s installerar makepkg beroendena åt dig (makepkg -si).', en: 'Simulator tip: with -s makepkg installs the dependencies for you (makepkg -si).' }));
      return 8;
    }
    ctx.out('==> Installing missing dependencies...\n');
    return sh.runAs('root', () =>
      pacmanTransaction(ctx, missing.map((m) => m.pkg), noconfirm, (io) => sh.runAs(user.name, () => build(io)), (io) => {
        io.err(`==> ERROR: 'pacman' failed to install missing dependencies.\n==> Missing dependencies:\n${missing.map((m) => `  -> ${m.spec}\n`).join('')}==> ERROR: Could not resolve all dependencies.\n`);
        return 8;
      }),
    );
  },
};

// ---------------------------------------------------------------- yay

function aurSearch(query: string): string[] {
  const q = query.toLowerCase();
  return Object.keys(AUR)
    .filter((n) => n.includes(q) || pkgById(AUR[n].pkgId).description.toLowerCase().includes(q))
    .sort();
}

const yay: CommandDef = {
  name: 'yay',
  summary: 'AUR-hjälpare: pacman + paket från AUR i ett och samma kommando',
  summaryEn: 'AUR helper: pacman plus packages from the AUR in one command',
  man: `NAMN
       yay - Yet Another Yogurt, en AUR-hjälpare för Arch Linux

SYNOPSIS
       yay [ÅTGÄRD] [PAKET]...

BESKRIVNING
       yay fungerar som pacman men hittar även paket i AUR. För dem hämtar
       den PKGBUILD, bygger med makepkg och installerar – allt det du annars
       gör för hand. yay körs som vanlig användare (inte med sudo) och
       använder sudo själv när något ska installeras.

       yay finns inte i Archs förråd. Man installerar den från AUR en gång
       med git clone + makepkg -si (paketet yay eller yay-bin).

VANLIGA KOMMANDON
       yay                 samma som yay -Syu
       yay -Syu            uppgradera allt, även AUR-paket
       yay -S PAKET        installera från förråden eller AUR
       yay -Ss ORD         sök i förråden och i AUR
       yay -Si PAKET       information om ett paket
       yay -R PAKET        ta bort (som pacman -R)

FLAGGOR
       --noconfirm         fråga inte om bekräftelse`,
  manEn: `NAME
       yay - Yet Another Yogurt, an AUR helper for Arch Linux

SYNOPSIS
       yay [OPERATION] [PACKAGE]...

DESCRIPTION
       yay works like pacman but also finds packages in the AUR. For those
       it downloads the PKGBUILD, builds it with makepkg and installs it -
       everything you otherwise do by hand. yay runs as a normal user (not
       with sudo) and uses sudo itself when something is installed.

       yay is not in the Arch repositories. You install it from the AUR
       once with git clone + makepkg -si (the package yay or yay-bin).

COMMON COMMANDS
       yay                 same as yay -Syu
       yay -Syu            upgrade everything, AUR packages too
       yay -S PACKAGE      install from the repositories or the AUR
       yay -Ss WORD        search the repositories and the AUR
       yay -Si PACKAGE     information about a package
       yay -R PACKAGE      remove (like pacman -R)

OPTIONS
       --noconfirm         don't ask for confirmation`,
  run(ctx) {
    const sh = ctx.sh;
    const args = ctx.args.length ? ctx.args : ['-Syu'];
    if (args[0] === '--version' || args[0] === '-V') {
      ctx.out('yay v12.5.2 - libalpm v15.0.0\n');
      return 0;
    }
    const noconfirm = args.includes('--noconfirm');
    const flags = args.filter((a) => /^-[A-Za-z]+$/.test(a)).join('').replace(/-/g, '');
    const targets = args.filter((a) => !a.startsWith('-'));
    const op = [...flags].find((c) => c >= 'A' && c <= 'Z');
    const mods = op ? flags.replace(op, '') : '';
    const asRootPacman = (argv: string[]) => sh.runAs('root', () => sh.invoke(['pacman', ...argv], ctx));

    // Bara söktermer (t.ex. "yay moonphase") söker och låter en välja – här: visa sökresultatet.
    if (!op && targets.length) return yay.run({ ...ctx, args: ['-Ss', ...targets] });

    if (op === 'S' && mods.includes('s')) {
      const q = targets.join(' ');
      const repo = searchPackages('arch', q, sh).filter((p) => !isForeign('arch', p));
      for (const p of repo) {
        ctx.out(`${p.archRepo ?? 'extra'}/${p.names.arch} ${availableVersion(sh, p)}${isInstalled(sh, p) ? ' (Installed)' : ''}\n    ${p.description}\n`);
      }
      const aur = aurSearch(q);
      for (const n of aur) {
        const e = AUR[n];
        const p = pkgById(e.pkgId);
        const inst = isInstalled(sh, p) && p.names.arch === n ? ' (Installed)' : '';
        ctx.out(`aur/${n} ${e.pkgver}-${e.pkgrel} (+${e.votes} ${e.popularity.toFixed(2)})${inst}\n    ${p.description}\n`);
      }
      return repo.length || aur.length ? 0 : 1;
    }
    if (op === 'S' && mods.includes('i') && targets.every((t) => AUR[t])) {
      for (const t of targets) {
        const e = AUR[t];
        const p = pkgById(e.pkgId);
        ctx.out(
          `Repository      : aur\nName            : ${t}\nVersion         : ${e.pkgver}-${e.pkgrel}\nDescription     : ${p.description}\nURL             : ${e.url}\n` +
            `AUR URL         : https://aur.archlinux.org/packages/${t}\nLicenses        : ${e.license}\nDepends On      : ${e.depends.join('  ')}\n` +
            `Make Deps       : ${e.makedepends.join('  ') || 'None'}\nVotes           : ${e.votes}\nPopularity      : ${e.popularity}\nMaintainer      : ${e.maintainer.split(' <')[0]}\n\n`,
        );
      }
      return 0;
    }
    if (op === 'S' && (mods.includes('u') || mods.includes('y')) && !targets.length) {
      if (isRoot(sh)) ctx.err(' -> Avoid running yay as root/sudo.\n');
      if (mods.includes('u')) {
        ctx.out(':: Searching AUR for updates...\n');
        const aurInstalled = PACKAGES.filter((p) => isForeign('arch', p) && isInstalled(sh, p));
        ctx.out(aurInstalled.length ? ` -> ${aurInstalled.length} AUR package(s) checked, all up to date\n` : ' -> No AUR packages installed\n');
      }
      return asRootPacman([`-S${mods}`, ...(noconfirm ? ['--noconfirm'] : [])]);
    }
    if (op === 'S' && !mods.replace(/[yu]/g, '')) {
      const aurTargets = targets.filter((t) => AUR[t]);
      const repoTargets = targets.filter((t) => !AUR[t]);
      for (const t of repoTargets) {
        const p = findPackage('arch', t, sh);
        if (!p || isForeign('arch', p)) {
          ctx.err(` -> No AUR package found for ${t}\n -> Could not find all required packages:\n\t${t} (Target)\n`);
          return 1;
        }
      }
      if (!aurTargets.length) return asRootPacman([`-S${mods}`, ...(noconfirm ? ['--noconfirm'] : []), ...repoTargets]);
      if (isRoot(sh)) {
        ctx.err(' -> Refusing to install AUR packages as root, aborting.\n');
        return 1;
      }
      if (!sh.installed['base-devel']) {
        ctx.err(' -> Missing dependency: base-devel\n');
        ctx.err(dim(sh, { sv: 'Tips från simulatorn: sudo pacman -S --needed base-devel', en: 'Simulator tip: sudo pacman -S --needed base-devel' }));
        return 1;
      }
      const user = sh.currentUser();
      const g = user.groups[0];
      const deps = missingDeps(sh, aurTargets.flatMap((t) => [...AUR[t].depends, ...AUR[t].makedepends]));
      const repoPkgs = repoTargets.map((t) => findPackage('arch', t, sh)!);
      ctx.out(
        (repoPkgs.length ? `Sync Explicit (${repoPkgs.length}): ${repoPkgs.map((p) => `${p.names.arch}-${availableVersion(sh, p)}`).join(', ')}\n` : '') +
          `AUR Explicit (${aurTargets.length}): ${aurTargets.map((t) => `${t}-${AUR[t].pkgver}-${AUR[t].pkgrel}`).join(', ')}\n` +
          (deps.length ? `Sync Make Dependency (${deps.length}): ${deps.map((d) => `${d.pkg.names.arch}-${availableVersion(sh, d.pkg)}`).join(', ')}\n` : ''),
      );
      aurTargets.forEach((t, i) => {
        const e = AUR[t];
        ctx.out(`:: (${i + 1}/${aurTargets.length}) Downloaded PKGBUILD: ${t}\n`);
        const cache = `${sh.home}/.cache/yay/${t}`;
        // Byggkatalogen i ~/.cache/yay – där kan du läsa PKGBUILD i efterhand.
        let path = '';
        for (const seg of cache.split('/').filter(Boolean)) {
          path += '/' + seg;
          if (!sh.vfs.tryLookup(path, user)) sh.vfs.mkdir(path, user);
        }
        sh.vfs.insert(`${cache}/PKGBUILD`, makeFile(pkgbuild(t, e), user.name, 0o644, g), user);
        const built = makeFile(`(byggt paket ${t} – simulerat)\n`, user.name, 0o644, g);
        built.size = Math.round(pkgById(e.pkgId).sizeKb * 400);
        sh.vfs.insert(`${cache}/${pkgFileName(t, e)}`, built, user);
      });
      ctx.out(dim(sh, { sv: '(yay visar PKGBUILD-filerna här om du vill läsa dem – de ligger i ~/.cache/yay/.)', en: '(yay shows the PKGBUILD files here if you want to read them - they are in ~/.cache/yay/.)' }));
      for (const t of aurTargets) {
        const e = AUR[t];
        ctx.out(`==> Making package: ${t} ${e.pkgver}-${e.pkgrel} (${longDate()})\n==> Retrieving sources...\n==> Extracting sources...\n`);
        if (e.build.length) ctx.out('==> Starting build()...\n');
        ctx.out(`==> Entering fakeroot environment...\n==> Starting package()...\n==> Creating package "${t}"...\n==> Leaving fakeroot environment.\n==> Finished making: ${t} ${e.pkgver}-${e.pkgrel} (${longDate()})\n`);
      }
      const all = [...deps.map((d) => d.pkg), ...repoPkgs, ...aurTargets.map((t) => pkgById(AUR[t].pkgId))];
      return sh.runAs('root', () => pacmanTransaction(ctx, all, noconfirm, () => 0, () => 1));
    }
    // Allt annat (-Q, -R, -Si för vanliga paket ...) skickas vidare till pacman.
    const needsRoot = op === 'R' || op === 'S' || op === 'U';
    return needsRoot ? asRootPacman(args) : sh.invoke(['pacman', ...args], ctx);
  },
};

// ================================================================ Programmen

const SYNODIC = 29.530588853;
const NEW_MOON_2000 = Date.UTC(2000, 0, 6, 18, 14);

/** Månens ålder i dagar sedan senaste nymåne. */
export function moonAge(ms: number): number {
  const age = ((ms - NEW_MOON_2000) / 86_400_000) % SYNODIC;
  return age < 0 ? age + SYNODIC : age;
}

const PHASES = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];

function moonArt(age: number): string {
  const angle = (2 * Math.PI * age) / SYNODIC;
  const waxing = age < SYNODIC / 2;
  const R = 5;
  const rows: string[] = [];
  for (let yi = 0; yi < 2 * R; yi++) {
    const y = yi - R + 0.5;
    const w = Math.sqrt(R * R - y * y);
    let row = '';
    for (let xi = -2 * R; xi <= 2 * R; xi++) {
      const x = xi / 2;
      if (Math.abs(x) > w + 0.25) {
        row += ' ';
        continue;
      }
      const t = w * Math.cos(angle);
      const lit = waxing ? x > t : x < -t;
      row += lit ? '@' : '.';
    }
    rows.push(row.replace(/\s+$/, ''));
  }
  return rows.join('\n') + '\n';
}

const moonphase: CommandDef = {
  name: 'moonphase',
  summary: 'Visar månens fas (påhittat program från PPA, AUR och COPR)',
  summaryEn: 'Shows the phase of the moon (made-up program from a PPA, the AUR and COPR)',
  man: `NAMN
       moonphase - visa månens fas i terminalen

SYNOPSIS
       moonphase [--version]

BESKRIVNING
       Ritar månen som den ser ut i dag och berättar hur stor del som är
       upplyst. Ett påhittat program som finns i de extra förråden
       ppa:lunatool/moonphase, AUR och COPR-projektet lunatool/moonphase.`,
  manEn: `NAME
       moonphase - show the phase of the moon in the terminal

SYNOPSIS
       moonphase [--version]

DESCRIPTION
       Draws the moon as it looks today and tells you how much of it is
       lit. A made-up program that lives in the extra repositories
       ppa:lunatool/moonphase, the AUR and the COPR project
       lunatool/moonphase.`,
  run(ctx) {
    if (ctx.args[0] === '--version' || ctx.args[0] === '-V') {
      ctx.out(`moonphase ${(ctx.sh.installed.moonphase ?? '1.4.2').split('-')[0]}\n`);
      return 0;
    }
    if (ctx.args.length) {
      ctx.err(`moonphase: unknown option '${ctx.args[0]}'\nUsage: moonphase [--version]\n`);
      return 2;
    }
    const now = Date.now();
    const age = moonAge(now);
    const illum = Math.round(((1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2) * 100);
    const name = PHASES[Math.floor(((age + SYNODIC / 16) % SYNODIC) / (SYNODIC / 8))];
    const toFull = (SYNODIC / 2 - age + SYNODIC) % SYNODIC;
    const full = new Date(now + toFull * 86_400_000).toISOString().slice(0, 10);
    ctx.out(`${moonArt(age)}\n${name}, ${illum}% illuminated (day ${age.toFixed(1)} of ${SYNODIC.toFixed(1)})\nNext full moon: ${full}\n`);
    return 0;
  },
};

const snowfall: CommandDef = {
  name: 'snowfall',
  summary: 'Låter det snöa i terminalen (påhittat AUR-paket)',
  summaryEn: 'Lets it snow in the terminal (made-up AUR package)',
  man: `NAMN
       snowfall - låt det snöa i terminalen

BESKRIVNING
       Ett påhittat program från AUR. Tryck q för att avsluta.`,
  manEn: `NAME
       snowfall - let it snow in the terminal

DESCRIPTION
       A made-up program from the AUR. Press q to quit.`,
  run(ctx) {
    ctx.out(
      '   *        .     *       .    *\n .     *       .      *         .\n     .    *        .      *  .\n' +
        '  *      .     *      .     *    \n    .  *     .     *     .    *\n__/\\___/\\__/\\____/\\___/\\___/\\___\n',
    );
    ctx.out(dim(ctx.sh, { sv: '(I en riktig terminal faller snön tills du trycker q.)', en: '(In a real terminal the snow keeps falling until you press q.)' }));
    return 0;
  },
};

const go: CommandDef = {
  name: 'go',
  summary: 'Kompilatorn för programspråket Go',
  summaryEn: 'The compiler for the Go programming language',
  man: `NAMN
       go - verktyg för programspråket Go

BESKRIVNING
       I simulatorn stöds bara "go version".`,
  manEn: `NAME
       go - tool for the Go programming language

DESCRIPTION
       Only "go version" is supported in the simulator.`,
  run(ctx) {
    if (ctx.args[0] === 'version') {
      ctx.out('go version go1.25.3 linux/amd64\n');
      return 0;
    }
    if (!ctx.args.length) {
      ctx.out('Go is a tool for managing Go source code.\n\nUsage:\n\n\tgo <command> [arguments]\n');
      return 2;
    }
    ctx.out(dim(ctx.sh, { sv: `go ${ctx.args[0]} stöds inte i simulatorn.`, en: `go ${ctx.args[0]} is not supported in the simulator.` }));
    return 1;
  },
};

export const REPO_COMMANDS: CommandDef[] = [addAptRepository, makepkg, yay, moonphase, snowfall, go];
