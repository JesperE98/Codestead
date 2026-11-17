// Port of Commands/Pkg/PkgCmd.Apt.cs – the apt and apt-get commands.

import { Js } from "../../Js.js";
import type { PackageDef } from "../../Packages/PackageDef.js";
import { availableVersion, findPackage, formatKb, installPackage, isInstalled, removePackage, searchPackages, upgradable } from "../../Packages/PackagesLib.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as ReposCmd from "../Repos/ReposCmd.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { confirm, familyPackages, flag, isRoot, pkgName } from "./PkgCmd.js";

/** Math.round for non-negative numbers. */
function round(v: number): number {
  return Math.floor(v + 0.5);
}

const aptReading = "Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n";

function aptMirror(ctx: CmdCtx): string {
  const d = ctx.sh.distro;
  const base = d.mirrors.length > 0 ? d.mirrors[0]!.split(" ")[0]! : "http://deb.debian.org/debian";
  return `${base} ${d.codename ?? ""}/main amd64`;
}

function aptUpdate(ctx: CmdCtx): number {
  const sh = ctx.sh;
  if (!isRoot(ctx)) {
    ctx.out("Reading package lists... Done\n");
    ctx.err("E: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)\nE: Unable to lock directory /var/lib/apt/lists/\n");
    return 100;
  }
  const already = flag(sh, "repoSynced");
  for (let i = 0; i < sh.distro.mirrors.length; i++) {
    const m = sh.distro.mirrors[i]!;
    if (already || i === 0) ctx.out(`Hit:${i + 1} ${m}\n`);
    else ctx.out(`Get:${i + 1} ${m} [${Js.toFixed(118.6 + i * 7.3, 1)} kB]\n`);
  }
  // Added PPAs (see ReposCmd.ts).
  ReposCmd.aptUpdatePpas(ctx, sh.distro.mirrors.length + 1);
  if (!already) ctx.out("Fetched 1,284 kB in 1s (1,107 kB/s)\n");
  sh.flags.set("repoSynced", true);
  ctx.out(aptReading);
  const n = upgradable(sh).length;
  ctx.out(n !== 0 ? `${n} packages can be upgraded. Run 'apt list --upgradable' to see them.\n` : "All packages are up to date.\n");
  return 0;
}

function aptLockError(ctx: CmdCtx): number {
  ctx.err("E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\n" + "E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?\n");
  return 100;
}

function aptInstall(ctx: CmdCtx, names: string[]): number {
  const sh = ctx.sh;
  if (!isRoot(ctx)) return aptLockError(ctx);
  ctx.out(aptReading);
  const toInstall: PackageDef[] = [];
  for (const n of names) {
    const p = findPackage(sh.distro.family, n, sh);
    // Without "apt update" the package lists are empty and apt finds nothing.
    if (p === null || (!flag(sh, "repoSynced") && !isInstalled(sh, p))) {
      ctx.err(`E: Unable to locate package ${n}\n`);
      if (!flag(sh, "repoSynced")) {
        ctx.err(`${UtilCmd.Color.dim}${ctx.sh.msg("pkg.aptListsEmpty")}${UtilCmd.Color.reset}\n`);
      }
      return 100;
    }
    if (isInstalled(sh, p) && sh.installed.get(p.id) === availableVersion(sh, p)) {
      ctx.out(`${n} is already the newest version (${sh.installed.get(p.id)}).\n`);
    } else if (!toInstall.includes(p)) {
      toInstall.push(p);
    }
  }
  const notUpgraded = upgradable(sh).length;
  if (toInstall.length === 0) {
    ctx.out(`0 upgraded, 0 newly installed, 0 to remove and ${notUpgraded} not upgraded.\n`);
    return 0;
  }
  const size = toInstall.reduce((s, p) => s + p.sizeKb, 0);
  ctx.out(`The following NEW packages will be installed:\n  ${toInstall.map((p) => pkgName(ctx, p)).join(" ")}\n`);
  ctx.out(
    `0 upgraded, ${toInstall.length} newly installed, 0 to remove and ${notUpgraded} not upgraded.\n` +
      `Need to get ${formatKb(round(size * 0.4))} of archives.\n` +
      `After this operation, ${formatKb(size)} of additional disk space will be used.\n`,
  );
  for (let i = 0; i < toInstall.length; i++) {
    const p = toInstall[i]!;
    ctx.out(`Get:${i + 1} ${ReposCmd.aptPpaMirror(p) ?? aptMirror(ctx)} ${pkgName(ctx, p)} amd64 ${availableVersion(sh, p)} [${formatKb(round(p.sizeKb * 0.4))}]\n`);
  }
  ctx.out(`Fetched ${formatKb(round(size * 0.4))} in 0s (2,511 kB/s)\n`);
  for (const p of toInstall) {
    const n = pkgName(ctx, p);
    const v = availableVersion(sh, p);
    ctx.out(
      `Selecting previously unselected package ${n}.\n(Reading database ... 74213 files and directories currently installed.)\n` +
        `Preparing to unpack .../${n}_${v}_amd64.deb ...\nUnpacking ${n} (${v}) ...\n`,
    );
  }
  for (const p of toInstall) {
    ctx.out(`Setting up ${pkgName(ctx, p)} (${availableVersion(sh, p)}) ...\n`);
    installPackage(sh, p);
  }
  ctx.out("Processing triggers for man-db (2.12.0-4build2) ...\n");
  return 0;
}

function aptRemove(ctx: CmdCtx, names: string[], assumeYes: boolean): number {
  const sh = ctx.sh;
  if (!isRoot(ctx)) return aptLockError(ctx);
  ctx.out(aptReading);
  const toRemove: PackageDef[] = [];
  for (const n of names) {
    const p = findPackage(sh.distro.family, n, sh);
    if (p === null) {
      ctx.err(`E: Unable to locate package ${n}\n`);
      return 100;
    }
    if (!isInstalled(sh, p)) {
      ctx.out(`Package '${n}' is not installed, so not removed\n`);
      continue;
    }
    if (p.essential === true) {
      ctx.err("E: Removing essential system-critical packages is not permitted. This might break the system.\n");
      ctx.err(`${UtilCmd.Color.dim}(${ctx.sh.msg("pkg.essentialPackage", { pkg: n })})${UtilCmd.Color.reset}\n`);
      return 100;
    }
    toRemove.push(p);
  }
  const notUpgraded = upgradable(sh).length;
  if (toRemove.length === 0) {
    ctx.out(`0 upgraded, 0 newly installed, 0 to remove and ${notUpgraded} not upgraded.\n`);
    return 0;
  }
  const size = toRemove.reduce((s, p) => s + p.sizeKb, 0);
  ctx.out(
    `The following packages will be REMOVED:\n  ${toRemove.map((p) => pkgName(ctx, p)).join(" ")}\n` +
      `0 upgraded, 0 newly installed, ${toRemove.length} to remove and ${notUpgraded} not upgraded.\n` +
      `After this operation, ${formatKb(size)} disk space will be freed.\n`,
  );
  return confirm(
    ctx,
    "Do you want to continue? [Y/n] ",
    true,
    assumeYes,
    (io) => {
      io.out("(Reading database ... 74213 files and directories currently installed.)\n");
      for (const p of toRemove) {
        io.out(`Removing ${pkgName(ctx, p)} (${sh.installed.get(p.id)}) ...\n`);
        removePackage(sh, p);
      }
      io.out("Processing triggers for man-db (2.12.0-4build2) ...\n");
      return 0;
    },
    (io) => {
      io.out("Abort.\n");
      return 1;
    },
  );
}

function aptUpgrade(ctx: CmdCtx, assumeYes: boolean): number {
  const sh = ctx.sh;
  if (!isRoot(ctx)) return aptLockError(ctx);
  ctx.out(aptReading + "Calculating upgrade... Done\n");
  const ups = upgradable(sh);
  if (ups.length === 0) {
    ctx.out("0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n");
    if (flag(sh, "repoSynced")) sh.flags.set("upgraded", true);
    else ctx.out(`${UtilCmd.Color.dim}${ctx.sh.msg("pkg.aptUpgradeNeedsUpdate")}${UtilCmd.Color.reset}\n`);
    return 0;
  }
  const size = ups.reduce((s, p) => s + p.sizeKb, 0);
  ctx.out(
    `The following packages will be upgraded:\n  ${ups.map((p) => pkgName(ctx, p)).join(" ")}\n` +
      `${ups.length} upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n` +
      `Need to get ${formatKb(round(size * 0.4))} of archives.\n` +
      "After this operation, 12.3 kB of additional disk space will be used.\n",
  );
  return confirm(
    ctx,
    "Do you want to continue? [Y/n] ",
    true,
    assumeYes,
    (io) => {
      for (let i = 0; i < ups.length; i++) io.out(`Get:${i + 1} ${aptMirror(ctx)} ${pkgName(ctx, ups[i]!)} amd64 ${availableVersion(sh, ups[i]!)}\n`);
      for (const p of ups) {
        io.out(`Preparing to unpack .../${pkgName(ctx, p)}_${availableVersion(sh, p)}_amd64.deb ...\n`);
        io.out(`Unpacking ${pkgName(ctx, p)} (${availableVersion(sh, p)}) over (${sh.installed.get(p.id)}) ...\n`);
      }
      for (const p of ups) {
        io.out(`Setting up ${pkgName(ctx, p)} (${availableVersion(sh, p)}) ...\n`);
        installPackage(sh, p);
      }
      sh.flags.set("upgraded", true);
      return 0;
    },
    (io) => {
      io.out("Abort.\n");
      return 1;
    },
  );
}

const aptManExtra =
  "\n       search ORD      sök efter paket\n       show PAKET      visa information om ett paket" +
  "\n       list --installed   lista installerade paket\n       list --upgradable  lista paket som kan uppgraderas";

const aptYesFlags = ["-y", "--yes", "--assume-yes"];

export function makeApt(name: string): CommandDef {
  return {
    name,
    summary: name === "apt" ? "Pakethanteraren i Debian och Ubuntu" : "Äldre, skriptvänlig variant av apt",
    man: `NAMN
       ${name} - pakethanterare för Debian, Ubuntu och liknande

SYNOPSIS
       ${name} [-y] KOMMANDO [PAKET]...

KOMMANDON
       update          hämta nya paketlistor från förråden (repositories)
       upgrade         uppgradera alla installerade paket
       install PAKET   installera paket
       remove PAKET    ta bort paket (inställningsfiler blir kvar)
       purge PAKET     ta bort paket och dess inställningsfiler
       autoremove      ta bort beroenden som inte längre behövs${name === "apt" ? aptManExtra : ""}

FLAGGOR
       -y, --yes       svara ja på alla frågor

BESKRIVNING
       De flesta kommandon kräver root, så de körs med sudo:
           sudo apt update && sudo apt upgrade`,
    run: (ctx) => runApt(ctx, name),
  };
}

function runApt(ctx: CmdCtx, name: string): number {
  const sh = ctx.sh;
  const assumeYes = ctx.args.some((a) => aptYesFlags.includes(a));
  const args = ctx.args.filter((a) => !aptYesFlags.includes(a) && a !== "-q");
  const sub = args.length > 0 ? args[0]! : null;
  const rest = args.slice(1);
  const pkgs = rest.filter((a) => !a.startsWith("-"));
  switch (sub) {
    case null:
    case "-h":
    case "--help":
      ctx.out(
        `${name} 2.8.3 (amd64)\nUsage: ${name} [options] command\n\nMost used commands:\n` +
          "  list - list packages based on package names\n  search - search in package descriptions\n" +
          "  show - show package details\n  install - install packages\n  remove - remove packages\n" +
          "  autoremove - automatically remove all unused packages\n  update - update list of available packages\n" +
          "  upgrade - upgrade the system by installing/upgrading packages\n",
      );
      return sub !== null ? 0 : 1;
    case "update":
      return aptUpdate(ctx);
    case "install":
      if (pkgs.length === 0) {
        if (!isRoot(ctx)) return aptLockError(ctx);
        ctx.out(aptReading + `0 upgraded, 0 newly installed, 0 to remove and ${upgradable(sh).length} not upgraded.\n`);
        return 0;
      }
      return aptInstall(ctx, pkgs);
    case "remove":
    case "purge":
      return aptRemove(ctx, pkgs, assumeYes);
    case "upgrade":
    case "full-upgrade":
    case "dist-upgrade":
      return aptUpgrade(ctx, assumeYes);
    case "autoremove":
      if (!isRoot(ctx)) return aptLockError(ctx);
      ctx.out(aptReading + `0 upgraded, 0 newly installed, 0 to remove and ${upgradable(sh).length} not upgraded.\n`);
      return 0;
    case "search": {
      if (name === "apt-get") break;
      if (pkgs.length === 0) {
        ctx.err("E: You must give at least one search pattern\n");
        return 100;
      }
      ctx.out("Sorting... Done\nFull Text Search... Done\n");
      const results = searchPackages(sh.distro.family, pkgs.join(" "), sh);
      for (const p of results) {
        const n = ctx.isTTY ? `${UtilCmd.Color.green}${pkgName(ctx, p)}${UtilCmd.Color.reset}` : pkgName(ctx, p);
        ctx.out(`${n}/${sh.distro.codename ?? ""} ${availableVersion(sh, p)} amd64${isInstalled(sh, p) ? " [installed]" : ""}\n  ${p.description}\n\n`);
      }
      return 0;
    }
    case "show": {
      if (name === "apt-get") break;
      let code = 0;
      for (const n of pkgs) {
        const p = findPackage(sh.distro.family, n, sh);
        if (p === null) {
          ctx.err(`N: Unable to locate package ${n}\nE: No packages found\n`);
          code = 100;
          continue;
        }
        ctx.out(
          `Package: ${n}\nVersion: ${availableVersion(sh, p)}\nPriority: ${p.essential === true ? "required" : "optional"}\n` +
            `Section: utils\nInstalled-Size: ${formatKb(p.sizeKb)}\n` +
            `APT-Manual-Installed: ${isInstalled(sh, p) ? "yes" : "no"}\nDescription: ${p.description}\n\n`,
        );
      }
      return code;
    }
    case "policy":
      if (name === "apt-get") break;
      return ReposCmd.aptPolicy(ctx, pkgs);
    case "list": {
      if (name === "apt-get") break;
      ctx.out("Listing... Done\n");
      const cn = sh.distro.codename ?? "";
      if (rest.includes("--upgradable")) {
        for (const p of upgradable(sh)) {
          ctx.out(`${pkgName(ctx, p)}/${cn}-updates ${availableVersion(sh, p)} amd64 [upgradable from: ${sh.installed.get(p.id)}]\n`);
        }
        return 0;
      }
      const onlyInstalled = rest.includes("--installed");
      for (const p of familyPackages(ctx).sort((a, b) => Js.localeCompare(pkgName(ctx, a), pkgName(ctx, b)))) {
        if (onlyInstalled && !isInstalled(sh, p)) continue;
        const v = isInstalled(sh, p) ? sh.installed.get(p.id) : availableVersion(sh, p);
        ctx.out(`${pkgName(ctx, p)}/${cn},now ${v} amd64${isInstalled(sh, p) ? " [installed]" : ""}\n`);
      }
      return 0;
    }
  }
  ctx.err(`E: Invalid operation ${sub ?? ""}\n`);
  return 100;
}
