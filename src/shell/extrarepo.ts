// Extra förråd utanför distributionens egna: PPA (Ubuntu/Debian) och COPR (Fedora).
// Tillståndet ligger som filer i det virtuella filsystemet – precis som i ett riktigt
// system – så det sparas automatiskt och eleven kan titta på det med ls och cat.
// AUR (Arch) är inget förråd för pacman alls; där bygger man paketen själv (commands/repos.ts).

import type { Shell } from './shell';

export const PPA_HOST = 'ppa.launchpadcontent.net';
export const COPR_HOST = 'copr.fedorainfracloud.org';
/** PPA:er byggs för Ubuntus versioner – därför "noble" även om de läggs till i Debian. */
export const PPA_SUITE = 'noble';

export interface Ppa {
  user: string;
  name: string;
}

/** "ppa:användare/namn" (eller "ppa:användare", som betyder "ppa:användare/ppa"). */
export function parsePpa(spec: string): Ppa | null {
  const m = /^ppa:([a-z0-9][a-z0-9.+-]*)(?:\/([a-z0-9][a-z0-9.+-]*))?$/i.exec(spec);
  return m ? { user: m[1].toLowerCase(), name: (m[2] ?? 'ppa').toLowerCase() } : null;
}

export const ppaUri = (p: Ppa) => `https://${PPA_HOST}/${p.user}/${p.name}/ubuntu/`;
export const ppaSourcesPath = (p: Ppa) => `/etc/apt/sources.list.d/${p.user}-ubuntu-${p.name}-${PPA_SUITE}.sources`;
/** Paketlistan som `apt update` hämtar för PPA:t. Finns den kan apt installera härifrån. */
export const ppaListPath = (p: Ppa) => `/var/lib/apt/lists/${PPA_HOST}_${p.user}_${p.name}_ubuntu_dists_${PPA_SUITE}_InRelease`;

export interface Copr {
  owner: string;
  project: string;
}

/** "ägare/projekt", "copr:ägare/projekt" eller "copr.fedorainfracloud.org/ägare/projekt". */
export function parseCopr(spec: string): Copr | null {
  const m = /^(?:copr:)?(?:copr\.fedorainfracloud\.org\/)?(@?[\w.+-]+)\/([\w.+-]+)$/.exec(spec);
  return m ? { owner: m[1], project: m[2] } : null;
}

export const coprId = (c: Copr) => `copr:${COPR_HOST}:${c.owner.replace('@', 'group_')}:${c.project}`;
export const coprRepoPath = (c: Copr) => `/etc/yum.repos.d/_${coprId(c)}.repo`;

function fileContent(sh: Shell, path: string): string | null {
  const node = sh.vfs.tryLookup(path, sh.rootUser());
  return node?.type === 'file' ? (node.content ?? '') : null;
}

/** Är COPR-förrådet tillagt och aktiverat (enabled=1)? */
export function coprEnabled(sh: Shell, c: Copr): boolean {
  return /^enabled\s*=\s*(1|true)\s*$/im.test(fileContent(sh, coprRepoPath(c)) ?? '');
}

/**
 * Kan pakethanteraren installera från det extra förrådet just nu?
 * PPA: när `apt update` hämtat dess paketlista. COPR: när .repo-filen är aktiverad.
 * AUR: aldrig – AUR-paket byggs med makepkg (eller en hjälpare som yay).
 */
export function extraRepoEnabled(sh: Shell, repo: string): boolean {
  const ppa = parsePpa(repo);
  if (ppa) return fileContent(sh, ppaListPath(ppa)) !== null && fileContent(sh, ppaSourcesPath(ppa)) !== null;
  if (repo.startsWith('copr:')) {
    const copr = parseCopr(repo);
    return !!copr && coprEnabled(sh, copr);
  }
  return false;
}

/** Skapar katalogen och de föräldrar som saknas (som `mkdir -p`), som root. */
export function ensureDir(sh: Shell, path: string): void {
  const root = sh.rootUser();
  let cur = '';
  for (const seg of path.split('/').filter(Boolean)) {
    cur += '/' + seg;
    if (!sh.vfs.tryLookup(cur, root)) sh.vfs.mkdir(cur, root);
  }
}
