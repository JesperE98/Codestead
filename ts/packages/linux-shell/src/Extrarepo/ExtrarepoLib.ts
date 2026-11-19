// Port of Extrarepo/ExtrarepoLib.cs (src/shell/extrarepo.ts) – extra repositories outside the distribution's own:
// PPA (Ubuntu/Debian) and COPR (Fedora). The state lives as files in the virtual file system – just like in a
// real system – so it is saved automatically and the student can look at it with ls and cat.
// AUR (Arch) is no repository for pacman at all; there you build the packages yourself (Commands/Repos/).

import type { Shell } from "../Shell/Shell.js";
import type { Copr } from "./Copr.js";
import type { Ppa } from "./Ppa.js";

export const PpaHost = "ppa.launchpadcontent.net";
export const CoprHost = "copr.fedorainfracloud.org";
/** PPAs are built for Ubuntu's versions – hence "noble" even when added in Debian. */
export const PpaSuite = "noble";

const ppaRe = /^ppa:([a-z0-9][a-z0-9.+-]*)(?:\/([a-z0-9][a-z0-9.+-]*))?$/i;
const coprRe = /^(?:copr:)?(?:copr\.fedorainfracloud\.org\/)?(@?[A-Za-z0-9_.+-]+)\/([A-Za-z0-9_.+-]+)$/;
// .NET multiline ^ and $ only break lines at \n (JavaScript's m flag also at \r and the Unicode line separators).
const enabledRe = /(?:^|(?<=\n))enabled\s*=\s*(1|true)\s*(?=\n|$)/i;

/** "ppa:user/name" (or "ppa:user", which means "ppa:user/ppa"). */
export function parsePpa(spec: string): Ppa | null {
  const m = ppaRe.exec(spec);
  return m ? { user: m[1]!.toLowerCase(), name: (m[2] ?? "ppa").toLowerCase() } : null;
}

export function ppaUri(p: Ppa): string {
  return `https://${PpaHost}/${p.user}/${p.name}/ubuntu/`;
}

export function ppaSourcesPath(p: Ppa): string {
  return `/etc/apt/sources.list.d/${p.user}-ubuntu-${p.name}-${PpaSuite}.sources`;
}

/** The package list `apt update` fetches for the PPA. If it exists, apt can install from here. */
export function ppaListPath(p: Ppa): string {
  return `/var/lib/apt/lists/${PpaHost}_${p.user}_${p.name}_ubuntu_dists_${PpaSuite}_InRelease`;
}

/** "owner/project", "copr:owner/project" or "copr.fedorainfracloud.org/owner/project". */
export function parseCopr(spec: string): Copr | null {
  const m = coprRe.exec(spec);
  return m ? { owner: m[1]!, project: m[2]! } : null;
}

export function coprId(c: Copr): string {
  // JS str.replace(string, string): only the first occurrence.
  return `copr:${CoprHost}:${c.owner.replace("@", "group_")}:${c.project}`;
}

export function coprRepoPath(c: Copr): string {
  return `/etc/yum.repos.d/_${coprId(c)}.repo`;
}

function fileContent(sh: Shell, path: string): string | null {
  const node = sh.vfs.tryLookup(path, sh.rootUser());
  return node?.type === "file" ? (node.content ?? "") : null;
}

/** Is the COPR repository added and enabled (enabled=1)? */
export function coprEnabled(sh: Shell, c: Copr): boolean {
  return enabledRe.test(fileContent(sh, coprRepoPath(c)) ?? "");
}

/**
 * Can the package manager install from the extra repository right now?
 * PPA: once `apt update` has fetched its package list. COPR: when the .repo file is enabled.
 * AUR: never – AUR packages are built with makepkg (or a helper such as yay).
 */
export function extraRepoEnabled(sh: Shell, repo: string): boolean {
  const ppa = parsePpa(repo);
  if (ppa) return fileContent(sh, ppaListPath(ppa)) !== null && fileContent(sh, ppaSourcesPath(ppa)) !== null;
  if (repo.startsWith("copr:")) {
    const copr = parseCopr(repo);
    return copr !== null && coprEnabled(sh, copr);
  }
  return false;
}

/** Creates the directory and any missing parents (like `mkdir -p`), as root. */
export function ensureDir(sh: Shell, path: string): void {
  const root = sh.rootUser();
  let cur = "";
  for (const seg of path.split("/").filter((s) => s.length > 0)) {
    cur += "/" + seg;
    if (sh.vfs.tryLookup(cur, root) === null) sh.vfs.mkdir(cur, root);
  }
}
