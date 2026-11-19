// Port of Commands/Pkg/PkgCmd.Pacman.cs – the pacman command: the package manager in Arch Linux.

import { Js } from "../../Js.js";
import type { PackageDef } from "../../Packages/PackageDef.js";
import { availableVersion, findPackage, formatMiB, installPackage, isForeign, isInstalled, packages, removePackage, searchPackages, upgradable } from "../../Packages/PackagesLib.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { confirm, familyPackages, flag, isRoot, pkgName } from "./PkgCmd.js";

/** Removes the first occurrence of find. */
function replaceFirst(s: string, find: string): string {
  const i = s.indexOf(find);
  return i < 0 ? s : s.slice(0, i) + s.slice(i + find.length);
}

function bar(label: string): string {
  return `${label.padEnd(48)} [${Js.repeat("#", 22)}] 100%\n`;
}

export const pacman: CommandDef = {
  name: "pacman",
  summary: "Pakethanteraren i Arch Linux",
  man: `NAMN
       pacman - pakethanterare för Arch Linux och liknande

SYNOPSIS
       pacman ÅTGÄRD [FLAGGOR] [PAKET]...

ÅTGÄRDER (stor bokstav)
       -S    synkronisera: installera paket från förråden
       -R    ta bort paket
       -Q    fråga databasen över installerade paket

VANLIGA KOMBINATIONER
       pacman -Syu          uppdatera paketdatabasen och uppgradera allt
       pacman -S PAKET      installera ett paket
       pacman -Ss ORD       sök efter paket
       pacman -Si PAKET     visa information om ett paket
       pacman -R PAKET      ta bort ett paket
       pacman -Rs PAKET     ta bort paket och beroenden som inte behövs
       pacman -Q            lista installerade paket
       pacman -Qi PAKET     information om ett installerat paket

FLAGGOR
       --noconfirm   fråga inte om bekräftelse
       --needed      installera inte om paket som redan är aktuella

BESKRIVNING
       Arch är en "rolling release": paketen uppdateras hela tiden. Kör
       alltid -Syu i stället för bara -Sy, annars riskerar du att få en
       halvuppgraderad (partial upgrade) och trasig installation.`,
  run: runPacman,
};

function runPacman(ctx: CmdCtx): number {
  const sh = ctx.sh;
  const fam = sh.distro.family;
  const noconfirm = ctx.args.includes("--noconfirm");
  const needed = ctx.args.includes("--needed");
  let letters = "";
  const targets: string[] = [];
  for (const a of ctx.args) {
    if (a === "--noconfirm" || a === "--needed") continue;
    if (a === "--help") letters += "h";
    else if (a === "--version") letters += "V";
    else if (a.startsWith("--")) {
      ctx.err(`pacman: unrecognized option '${a}'\n`);
      return 1;
    } else if (a.startsWith("-")) letters += a.slice(1);
    else targets.push(a);
  }
  if (letters.includes("V")) {
    ctx.out("\n .--.                  Pacman v7.0.0 - libalpm v15.0.0\n/ _.-' .-.  .-.  .-.   Copyright (C) 2006-2024 Pacman Development Team\n\\  '-. '-'  '-'  '-'\n '--'\n\n");
    return 0;
  }
  const op = [...letters].find((c) => c >= "A" && c <= "Z") ?? null;
  if (letters.includes("h") && op === null) {
    ctx.out(
      "usage:  pacman <operation> [...]\noperations:\n    pacman {-h --help}\n    pacman {-V --version}\n    pacman {-Q --query}   [options] [package(s)]\n    pacman {-R --remove}  [options] <package(s)>\n    pacman {-S --sync}    [options] [package(s)]\n",
    );
    return 0;
  }
  if (op === null) {
    ctx.err("error: no operation specified (use -h for help)\n");
    return 1;
  }
  const mods = replaceFirst(letters, op);
  const rootError = (): number => {
    ctx.err("error: you cannot perform this operation unless you are root.\n");
    return 1;
  };
  const repo = (p: PackageDef): string => p.archRepo ?? "extra";
  const full = (p: PackageDef): string => `${pkgName(ctx, p)}-${availableVersion(sh, p)}`;
  const sum = (list: PackageDef[]): number => list.reduce((s, p) => s + p.sizeKb, 0);

  if (op === "Q") {
    let list = familyPackages(ctx).filter((p) => isInstalled(sh, p));
    if (mods.includes("s")) {
      const q = targets.join(" ");
      list = searchPackages(fam, q, sh).filter((p) => isInstalled(sh, p));
      for (const p of list) ctx.out(`local/${pkgName(ctx, p)} ${sh.installed.get(p.id)}\n    ${p.description}\n`);
      return list.length !== 0 ? 0 : 1;
    }
    if (targets.length !== 0) {
      const picked: PackageDef[] = [];
      for (const t of targets) {
        const p = findPackage(fam, t, sh);
        if (p === null || !isInstalled(sh, p)) {
          ctx.err(`error: package '${t}' was not found\n`);
          return 1;
        }
        picked.push(p);
      }
      list = picked;
    }
    // -Qm: packages that are not in the repositories ("foreign", e.g. from the AUR). -Qn: only those that are.
    if (mods.includes("m")) list = list.filter((p) => isForeign(fam, p));
    if (mods.includes("n")) list = list.filter((p) => !isForeign(fam, p));
    if ((mods.includes("m") || mods.includes("n")) && list.length === 0) return 1;
    list.sort((a, b) => Js.localeCompare(pkgName(ctx, a), pkgName(ctx, b)));
    for (const p of list) {
      if (mods.includes("i")) {
        ctx.out(
          `Name            : ${pkgName(ctx, p)}\nVersion         : ${sh.installed.get(p.id)}\nDescription     : ${p.description}\n` +
            `Architecture    : x86_64\nInstalled Size  : ${formatMiB(p.sizeKb)}\nInstall Reason  : ${p.base !== null && p.base !== undefined ? "Installed as a dependency for another package" : "Explicitly installed"}\n\n`,
        );
      } else {
        ctx.out(`${pkgName(ctx, p)} ${sh.installed.get(p.id)}\n`);
      }
    }
    return 0;
  }

  if (op === "S") {
    if (mods.includes("s")) {
      const results = searchPackages(fam, targets.join(" "), sh).filter((p) => !isForeign(fam, p));
      for (const p of results) {
        ctx.out(`${repo(p)}/${pkgName(ctx, p)} ${availableVersion(sh, p)}${isInstalled(sh, p) ? " [installed]" : ""}\n    ${p.description}\n`);
      }
      return results.length !== 0 ? 0 : 1;
    }
    if (mods.includes("i")) {
      for (const t of targets) {
        const p = findPackage(fam, t, sh);
        if (p === null || isForeign(fam, p)) {
          ctx.err(`error: package '${t}' was not found\n`);
          return 1;
        }
        ctx.out(
          `Repository      : ${repo(p)}\nName            : ${pkgName(ctx, p)}\nVersion         : ${availableVersion(sh, p)}\n` +
            `Description     : ${p.description}\nArchitecture    : x86_64\nDownload Size   : ${formatMiB(p.sizeKb * 0.4)}\n` +
            `Installed Size  : ${formatMiB(p.sizeKb)}\n\n`,
        );
      }
      return 0;
    }
    if (!isRoot(ctx)) return rootError();
    if (mods.includes("y")) {
      ctx.out(":: Synchronizing package databases...\n");
      for (const r of ["core", "extra"]) ctx.out(flag(sh, "repoSynced") && !mods.includes("yy") ? ` ${r} is up to date\n` : ` ${r} downloading...\n`);
      sh.flags.set("repoSynced", true);
    }
    const upgrade = mods.includes("u");
    const list: PackageDef[] = [];
    if (upgrade) {
      ctx.out(":: Starting full system upgrade...\n");
      list.push(...upgradable(sh));
    }
    for (const t of targets) {
      const p = findPackage(fam, t, sh);
      if (p === null || isForeign(fam, p)) {
        ctx.err(`error: target not found: ${t}\n`);
        if (packages.some((x) => x.names.get("arch") === t && isForeign(fam, x))) {
          ctx.err(`${UtilCmd.Color.dim}${sh.msg("pkg.onlyInAur", { pkg: t })}${UtilCmd.Color.reset}\n`);
        }
        return 1;
      }
      if (isInstalled(sh, p) && sh.installed.get(p.id) === availableVersion(sh, p)) {
        if (needed) {
          ctx.err(`warning: ${full(p)} is up to date -- skipping\n`);
          continue;
        }
        ctx.err(`warning: ${full(p)} is up to date -- reinstalling\n`);
      }
      if (!list.includes(p)) list.push(p);
    }
    if (list.length === 0) {
      if (upgrade) {
        ctx.out(" there is nothing to do\n");
        if (flag(sh, "repoSynced")) sh.flags.set("upgraded", true);
        return 0;
      }
      if (mods.includes("y")) return 0;
      if (targets.length !== 0) {
        ctx.out(" there is nothing to do\n");
        return 0;
      }
      ctx.err("error: no targets specified (use -h for help)\n");
      return 1;
    }
    const size = sum(list);
    ctx.out(
      `resolving dependencies...\nlooking for conflicting packages...\n\nPackages (${list.length}) ${list.map(full).join("  ")}\n\n` +
        `Total Download Size:   ${formatMiB(size * 0.4)}\nTotal Installed Size:  ${formatMiB(size)}\n\n`,
    );
    return confirm(
      ctx,
      ":: Proceed with installation? [Y/n] ",
      true,
      noconfirm,
      (io) => {
        const n = list.length;
        io.out(":: Retrieving packages...\n");
        for (const p of list) io.out(` ${full(p)}-x86_64 downloading...\n`);
        for (const step of ["checking keys in keyring", "checking package integrity", "loading package files", "checking for file conflicts"]) {
          io.out(bar(`(${n}/${n}) ${step}`));
        }
        io.out(":: Processing package changes...\n");
        for (let i = 0; i < list.length; i++) {
          const p = list[i]!;
          io.out(bar(`(${i + 1}/${n}) ${isInstalled(sh, p) ? "upgrading" : "installing"} ${pkgName(ctx, p)}`));
          installPackage(sh, p);
        }
        io.out(":: Running post-transaction hooks...\n(1/1) Arming ConditionNeedsUpdate...\n");
        if (upgrade && flag(sh, "repoSynced")) sh.flags.set("upgraded", true);
        return 0;
      },
      () => 1,
    );
  }

  if (op === "R") {
    if (targets.length === 0) {
      ctx.err("error: no targets specified (use -h for help)\n");
      return 1;
    }
    if (!isRoot(ctx)) return rootError();
    const list: PackageDef[] = [];
    for (const t of targets) {
      const p = findPackage(fam, t, sh);
      if (p === null || !isInstalled(sh, p)) {
        ctx.err(`error: target not found: ${t}\n`);
        return 1;
      }
      if (p.essential === true) {
        ctx.err(`checking dependencies...\nerror: failed to prepare transaction (could not satisfy dependencies)\n:: removing ${t} breaks dependency '${t}' required by base\n`);
        return 1;
      }
      list.push(p);
    }
    const size = sum(list);
    ctx.out(`checking dependencies...\n\nPackages (${list.length}) ${list.map((p) => `${pkgName(ctx, p)}-${sh.installed.get(p.id)}`).join("  ")}\n\nTotal Removed Size:  ${formatMiB(size)}\n\n`);
    return confirm(
      ctx,
      ":: Do you want to remove these packages? [Y/n] ",
      true,
      noconfirm,
      (io) => {
        io.out(":: Processing package changes...\n");
        for (let i = 0; i < list.length; i++) {
          const p = list[i]!;
          io.out(bar(`(${i + 1}/${list.length}) removing ${pkgName(ctx, p)}`));
          removePackage(sh, p);
        }
        return 0;
      },
      () => 1,
    );
  }

  ctx.err(`error: invalid option '-${op}'\n`);
  return 1;
}
