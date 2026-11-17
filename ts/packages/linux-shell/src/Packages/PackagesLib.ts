// Port of Packages/PackagesLib.cs (src/shell/packages.ts) – the package database used by apt, pacman and dnf in
// the simulator. The same program can be called different things in different families – an important point!
// The catalog itself is in PackagesLib.Catalog.ts (re-exported here, as one static class in C#).

import type { Family } from "../Distros/Distro.js";
import * as ExtrarepoLib from "../Extrarepo/ExtrarepoLib.js";
import { Js } from "../Js.js";
import * as ServicesLib from "../Services/ServicesLib.js";
import type { Shell } from "../Shell/Shell.js";
import * as VfsLib from "../Vfs/VfsLib.js";
import type { PackageDef } from "./PackageDef.js";
import { packages } from "./PackagesLib.Catalog.js";

export { packages } from "./PackagesLib.Catalog.js";

export function packageName(pkg: PackageDef, family: Family): string | null {
  return pkg.names.get(family) ?? null;
}

/**
 * Is the package in the repositories enabled in the shell? Packages from an extra repository
 * (PPA, COPR) only show up once the repository has been added; AUR packages never (they are built
 * with makepkg). Without a shell only the normal repositories count.
 */
export function inRepos(sh: Shell | null, pkg: PackageDef): boolean {
  const family = sh?.distro.family;
  if (!family || !pkg.extraRepo) return !pkg.extraRepo;
  const repo = pkg.extraRepo.get(family);
  return !repo || ExtrarepoLib.extraRepoEnabled(sh!, repo);
}

/** The package is in the repositories or already installed. */
export function isKnown(sh: Shell | null, pkg: PackageDef): boolean {
  return inRepos(sh, pkg) || (sh !== null && isInstalled(sh, pkg));
}

export function findPackage(family: Family, name: string, sh: Shell | null = null): PackageDef | null {
  return packages.find((p) => p.names.get(family) === name && isKnown(sh, p)) ?? null;
}

/** Packages that do not come from the distribution's own repositories (e.g. AUR – `pacman -Qm`). */
export function isForeign(family: Family, pkg: PackageDef): boolean {
  return !!pkg.extraRepo?.get(family);
}

/** The package that provides a certain command (for "command not found" hints). */
export function packageProviding(family: Family, command: string): PackageDef | null {
  return packages.find((p) => !!p.names.get(family) && p.provides.includes(command) && !p.extraRepo?.get(family)) ?? null;
}

export function availableVersion(sh: Shell, pkg: PackageDef): string {
  const fam = sh.distro.family;
  const newV = pkg.newVersion?.get(fam);
  const v = sh.flags.get("repoSynced") === true && newV ? newV : pkg.version.get(fam)!;
  // Debian and Ubuntu share a family, but the version numbers look a little different.
  return sh.distro.id === "debian" ? v.replaceAll("ubuntu", "+deb13u") : v;
}

export function isInstalled(sh: Shell, pkg: PackageDef): boolean {
  return sh.installed.has(pkg.id);
}

export function upgradable(sh: Shell): PackageDef[] {
  return packages.filter((p) => isInstalled(sh, p) && sh.installed.get(p.id) !== availableVersion(sh, p));
}

export function searchPackages(family: Family, query: string, sh: Shell | null = null): PackageDef[] {
  const q = query.toLowerCase();
  return packages
    .filter((p) => !!p.names.get(family) && isKnown(sh, p) && (p.names.get(family)!.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)))
    .sort((a, b) => Js.localeCompare(a.names.get(family)!, b.names.get(family)!));
}

/** Installs (or upgrades) the package: puts the commands in /usr/bin. */
export function installPackage(sh: Shell, pkg: PackageDef): void {
  sh.installed.set(pkg.id, availableVersion(sh, pkg));
  for (const cmd of pkg.provides) installCommand(sh, cmd);
  if (pkg.shells) updateEtcShells(sh, pkg.shells, true);
  if (pkg.id === "cron" && sh.distro.family === "arch") ServicesLib.cronieUnit(sh, true);
}

/** Puts the package's commands in /usr/bin. */
export function placeBinaries(sh: Shell, pkg: PackageDef): void {
  for (const cmd of pkg.provides) installCommand(sh, cmd);
}

/** Puts a simulated binary for the command in /usr/bin. */
export function installCommand(sh: Shell, cmd: string): void {
  const bin = sh.vfs.lookup("/usr/bin", sh.rootUser());
  const node = VfsLib.makeFile(`${VfsLib.Elf}\u0002\u0001\u0001 (simulated binary: ${cmd})`, "root", cmd === "sudo" ? Js.oct(4755) : Js.oct(755));
  node.size = 30_000 + ((cmd.length * 7919) % 150_000);
  bin.children!.set(cmd, node);
}

/** Adds or removes shells in /etc/shells (as the packages' install scripts do). */
function updateEtcShells(sh: Shell, shells: string[], add: boolean): void {
  const root = sh.rootUser();
  const node = sh.vfs.tryLookup("/etc/shells", root);
  if (node?.type !== "file") return;
  const lines = (node.content ?? "").split("\n").filter((l) => l !== "" && !shells.includes(l));
  if (add) lines.push(...shells);
  node.content = lines.join("\n") + "\n";
}

export function removePackage(sh: Shell, pkg: PackageDef): void {
  sh.installed.delete(pkg.id);
  const bin = sh.vfs.lookup("/usr/bin", sh.rootUser());
  for (const cmd of pkg.provides) bin.children!.delete(cmd);
  if (pkg.shells) updateEtcShells(sh, pkg.shells, false);
  if (pkg.id === "cron" && sh.distro.family === "arch") ServicesLib.cronieUnit(sh, false);
}

export function formatKb(kb: number): string {
  if (kb >= 1000) {
    let s = Js.toFixed(kb / 1000, 1);
    const i = s.indexOf(".0");
    if (i >= 0) s = s.slice(0, i) + s.slice(i + 2);
    return `${s} MB`;
  }
  return `${Js.num(kb)} kB`;
}

export function formatMiB(kb: number): string {
  return `${Js.toFixed(kb / 1024, 2)} MiB`;
}
