// Port of Commands/Repos/ReposCmd.Ppa.cs – PPA (Ubuntu): the known PPAs and the functions apt calls for them.

import { parsePpa, PpaHost, ppaListPath, PpaSuite, ppaUri } from "../../Extrarepo/ExtrarepoLib.js";
import type { Ppa } from "../../Extrarepo/Ppa.js";
import type { PackageDef } from "../../Packages/PackageDef.js";
import { availableVersion, findPackage, isInstalled } from "../../Packages/PackagesLib.js";
import type { Shell } from "../../Shell/Shell.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import { trimSlash, writeRootFile } from "./ReposCmd.js";

export interface PpaInfo {
  description: string;
  displayName: string;
  /** Packages (ids in Packages/PackagesLib.Catalog.ts) in the PPA. */
  packages: string[];
}

export const ppas = new Map<string, PpaInfo>([
  [
    "lunatool/moonphase",
    {
      displayName: "Moonphase",
      description: "Stable releases of moonphase – shows the phase of the moon in your terminal.\nBuilt for Ubuntu 24.04 LTS (noble).",
      packages: ["moonphase"],
    },
  ],
]);

export function ppaKey(p: Ppa): string {
  return `${p.user}/${p.name}`;
}

const ppaUriLine = new RegExp(`^URIs:\\s*https?://${PpaHost.replaceAll(".", "\\.")}/([^/\\s]+)/([^/\\s]+)/ubuntu/?\\s*$`, "m");

/** All PPAs that exist as .sources files in /etc/apt/sources.list.d. */
export function configuredPpas(sh: Shell): Ppa[] {
  const dir = sh.vfs.tryLookup("/etc/apt/sources.list.d", sh.rootUser());
  const result: Ppa[] = [];
  for (const node of dir?.children?.values() ?? []) {
    const m = ppaUriLine.exec(node.content ?? "");
    if (node.type === "file" && m) result.push({ user: m[1]!, name: m[2]! });
  }
  return result;
}

/**
 * Called by `apt update`: downloads package lists for added PPAs and removes the lists
 * of PPAs that no longer exist. first is the number of the first line (Get:N).
 */
export function aptUpdatePpas(ctx: CmdCtx, first: number): void {
  const sh = ctx.sh;
  const root = sh.rootUser();
  const list = configuredPpas(sh);
  for (let i = 0; i < list.length; i++) {
    const p = list[i]!;
    const base = `${trimSlash(ppaUri(p))} ${PpaSuite}`;
    if (sh.vfs.tryLookup(ppaListPath(p), root) !== null) {
      ctx.out(`Hit:${first + i} ${base} InRelease\n`);
    } else if (!ppas.has(ppaKey(p))) {
      ctx.out(`Ign:${first + i} ${base} InRelease\nErr:${first + i} ${base} Release\n  404  Not Found [IP: 185.125.190.80 443]\n`);
      ctx.err(`E: The repository '${base} Release' does not have a Release file.\nN: Updating from such a repository can't be done securely, and is therefore disabled by default.\n`);
    } else {
      ctx.out(`Get:${first + i} ${base} InRelease [17.8 kB]\nGet:${first + i + 1} ${base}/main amd64 Packages [1,024 B]\n`);
      writeRootFile(sh, ppaListPath(p), `Origin: LP-PPA-${p.user}-${p.name}\nLabel: ${ppas.get(ppaKey(p))!.displayName}\nSuite: ${PpaSuite}\n`);
    }
  }
  // Package lists from PPAs that have been removed disappear on the next update.
  const lists = sh.vfs.tryLookup("/var/lib/apt/lists", root);
  for (const name of [...(lists?.children?.keys() ?? [])]) {
    if (!name.startsWith(PpaHost + "_")) continue;
    if (!list.some((p) => ppaListPath(p).endsWith("/" + name))) lists!.children!.delete(name);
  }
}

/** The line `apt install` shows when a package is downloaded from a PPA (otherwise null). */
export function aptPpaMirror(p: PackageDef): string | null {
  const deb = p.extraRepo?.get("debian");
  const ppa = deb ? parsePpa(deb) : null;
  return ppa !== null ? `${trimSlash(ppaUri(ppa))} ${PpaSuite}/main amd64` : null;
}

/** `apt policy [PACKAGE]` – where do the packages come from, and with which priority? */
export function aptPolicy(ctx: CmdCtx, names: string[]): number {
  const sh = ctx.sh;
  const d = sh.distro;
  const codename = d.codename ?? "";
  const mirror = (d.mirrors.length > 0 ? d.mirrors[0]! : "http://deb.debian.org/debian").split(" ")[0]!;
  if (names.length === 0) {
    ctx.out("Package files:\n 100 /var/lib/dpkg/status\n     release a=now\n");
    for (const p of configuredPpas(sh)) {
      if (sh.vfs.tryLookup(ppaListPath(p), sh.rootUser()) === null) continue;
      ctx.out(
        ` 500 ${trimSlash(ppaUri(p))} ${PpaSuite}/main amd64 Packages\n     release v=24.04,o=LP-PPA-${p.user}-${p.name},a=${PpaSuite},n=${PpaSuite},l=${ppas.get(ppaKey(p))?.displayName ?? p.name},c=main,b=amd64\n`,
      );
    }
    if (sh.flags.get("repoSynced") === true) ctx.out(` 500 ${mirror} ${codename}/main amd64 Packages\n     release a=${codename},n=${codename},c=main,b=amd64\n`);
    ctx.out("Pinned packages:\n");
    return 0;
  }
  for (const n of names) {
    const p = findPackage("debian", n, sh);
    if (p === null) {
      ctx.err(`N: Unable to locate package ${n}\n`);
      continue;
    }
    const installed = isInstalled(sh, p) ? (sh.installed.get(p.id) ?? null) : null;
    const ppaLine = aptPpaMirror(p);
    const deb = p.extraRepo?.get("debian");
    const ppa = deb ? parsePpa(deb) : null;
    const candidateHere = ppa !== null ? sh.vfs.tryLookup(ppaListPath(ppa), sh.rootUser()) !== null : sh.flags.get("repoSynced") === true;
    const candidate = candidateHere ? availableVersion(sh, p) : installed;
    ctx.out(`${n}:\n  Installed: ${installed ?? "(none)"}\n  Candidate: ${candidate ?? "(none)"}\n  Version table:\n`);
    if (candidateHere) {
      ctx.out(` ${installed === candidate ? "***" : "   "} ${candidate} 500\n        500 ${ppaLine ?? `${mirror} ${codename}/main amd64`} Packages\n`);
      if (installed === candidate) ctx.out("        100 /var/lib/dpkg/status\n");
    }
    if (installed && (installed !== candidate || !candidateHere)) ctx.out(` *** ${installed} 100\n        100 /var/lib/dpkg/status\n`);
  }
  return 0;
}
