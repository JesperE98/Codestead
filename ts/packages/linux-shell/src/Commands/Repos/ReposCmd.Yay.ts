// Port of Commands/Repos/ReposCmd.Yay.cs – the yay command (AUR helper): pacman plus packages from the AUR in one
// command.

import { Js } from "../../Js.js";
import { availableVersion, findPackage, isForeign, isInstalled, packages, searchPackages } from "../../Packages/PackagesLib.js";
import { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { dim, has, isRoot, pkgById, round } from "./ReposCmd.js";
import { aur, aurGet, missingDeps, pacmanTransaction, pkgbuild, pkgFileName } from "./ReposCmd.Aur.js";

function aurSearch(query: string): string[] {
  const q = query.toLowerCase();
  return [...aur.keys()].filter((n) => n.includes(q) || pkgById(aur.get(n)!.pkgId).description.toLowerCase().includes(q)).sort();
}

export const yay: CommandDef = {
  name: "yay",
  summary: "AUR-hjälpare: pacman + paket från AUR i ett och samma kommando",
  summaryEn: "AUR helper: pacman plus packages from the AUR in one command",
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
  run: runYay,
};

const shortFlags = /^-[A-Za-z]+$/;

function runYay(ctx: CmdCtx): number {
  const sh = ctx.sh;
  const args = ctx.args.length !== 0 ? ctx.args : ["-Syu"];
  if (args[0] === "--version" || args[0] === "-V") {
    ctx.out("yay v12.5.2 - libalpm v15.0.0\n");
    return 0;
  }
  const noconfirm = args.includes("--noconfirm");
  const flags = args
    .filter((a) => shortFlags.test(a))
    .join("")
    .replaceAll("-", "");
  const targets = args.filter((a) => !a.startsWith("-"));
  const op = [...flags].find((c) => c >= "A" && c <= "Z") ?? null;
  let mods: string;
  if (op !== null) {
    const at = flags.indexOf(op);
    mods = flags.slice(0, at) + flags.slice(at + 1);
  } else mods = "";
  const asRootPacman = (argv: string[]): number => sh.runAs("root", () => sh.invoke(["pacman", ...argv], ctx));
  const noconfirmArg = (): string[] => (noconfirm ? ["--noconfirm"] : []);

  // Only search terms (e.g. "yay moonphase") search and let you choose – here: show the search result.
  if (op === null && targets.length !== 0) return runYay(new CmdCtx(ctx, ctx.sh, ctx.name, ["-Ss", ...targets]));

  if (op === "S" && mods.includes("s")) {
    const q = targets.join(" ");
    const repo = searchPackages("arch", q, sh).filter((p) => !isForeign("arch", p));
    for (const p of repo) {
      ctx.out(`${p.archRepo ?? "extra"}/${p.names.get("arch")} ${availableVersion(sh, p)}${isInstalled(sh, p) ? " (Installed)" : ""}\n    ${p.description}\n`);
    }
    const found = aurSearch(q);
    for (const n of found) {
      const e = aur.get(n)!;
      const p = pkgById(e.pkgId);
      const inst = isInstalled(sh, p) && p.names.get("arch") === n ? " (Installed)" : "";
      ctx.out(`aur/${n} ${e.pkgver}-${e.pkgrel} (+${e.votes} ${Js.toFixed(e.popularity, 2)})${inst}\n    ${p.description}\n`);
    }
    return repo.length !== 0 || found.length !== 0 ? 0 : 1;
  }
  if (op === "S" && mods.includes("i") && targets.every((t) => aurGet(t) !== null)) {
    for (const t of targets) {
      const e = aur.get(t)!;
      const p = pkgById(e.pkgId);
      const makeDeps = e.makedepends.join("  ");
      ctx.out(
        `Repository      : aur\nName            : ${t}\nVersion         : ${e.pkgver}-${e.pkgrel}\nDescription     : ${p.description}\nURL             : ${e.url}\n` +
          `AUR URL         : https://aur.archlinux.org/packages/${t}\nLicenses        : ${e.license}\nDepends On      : ${e.depends.join("  ")}\n` +
          `Make Deps       : ${makeDeps !== "" ? makeDeps : "None"}\nVotes           : ${e.votes}\nPopularity      : ${Js.num(e.popularity)}\nMaintainer      : ${e.maintainer.split(" <")[0]}\n\n`,
      );
    }
    return 0;
  }
  if (op === "S" && (mods.includes("u") || mods.includes("y")) && targets.length === 0) {
    if (isRoot(sh)) ctx.err(" -> Avoid running yay as root/sudo.\n");
    if (mods.includes("u")) {
      ctx.out(":: Searching AUR for updates...\n");
      const aurInstalled = packages.filter((p) => isForeign("arch", p) && isInstalled(sh, p));
      ctx.out(aurInstalled.length !== 0 ? ` -> ${aurInstalled.length} AUR package(s) checked, all up to date\n` : " -> No AUR packages installed\n");
    }
    return asRootPacman([`-S${mods}`, ...noconfirmArg()]);
  }
  if (op === "S" && mods.replace(/[yu]/g, "") === "") {
    const aurTargets = targets.filter((t) => aurGet(t) !== null);
    const repoTargets = targets.filter((t) => aurGet(t) === null);
    for (const t of repoTargets) {
      const p = findPackage("arch", t, sh);
      if (p === null || isForeign("arch", p)) {
        ctx.err(` -> No AUR package found for ${t}\n -> Could not find all required packages:\n\t${t} (Target)\n`);
        return 1;
      }
    }
    if (aurTargets.length === 0) return asRootPacman([`-S${mods}`, ...noconfirmArg(), ...repoTargets]);
    if (isRoot(sh)) {
      ctx.err(" -> Refusing to install AUR packages as root, aborting.\n");
      return 1;
    }
    if (!has(sh, "base-devel")) {
      ctx.err(" -> Missing dependency: base-devel\n");
      ctx.err(dim(sh, "repos.baseDevelTip"));
      return 1;
    }
    const user = sh.currentUser();
    const g = user.groups[0] ?? null;
    const deps = missingDeps(
      sh,
      aurTargets.flatMap((t) => [...aur.get(t)!.depends, ...aur.get(t)!.makedepends]),
    );
    const repoPkgs = repoTargets.map((t) => findPackage("arch", t, sh)!);
    ctx.out(
      (repoPkgs.length !== 0 ? `Sync Explicit (${repoPkgs.length}): ${repoPkgs.map((p) => `${p.names.get("arch")}-${availableVersion(sh, p)}`).join(", ")}\n` : "") +
        `AUR Explicit (${aurTargets.length}): ${aurTargets.map((t) => `${t}-${aur.get(t)!.pkgver}-${aur.get(t)!.pkgrel}`).join(", ")}\n` +
        (deps.length !== 0 ? `Sync Make Dependency (${deps.length}): ${deps.map((d) => `${d.pkg.names.get("arch")}-${availableVersion(sh, d.pkg)}`).join(", ")}\n` : ""),
    );
    for (let i = 0; i < aurTargets.length; i++) {
      const t = aurTargets[i]!;
      const e = aur.get(t)!;
      ctx.out(`:: (${i + 1}/${aurTargets.length}) Downloaded PKGBUILD: ${t}\n`);
      const cache = `${sh.home}/.cache/yay/${t}`;
      // The build directory in ~/.cache/yay – you can read the PKGBUILD there afterwards.
      let path = "";
      for (const seg of cache.split("/").filter((s) => s !== "")) {
        path += "/" + seg;
        if (sh.vfs.tryLookup(path, user) === null) sh.vfs.mkdir(path, user);
      }
      sh.vfs.insert(`${cache}/PKGBUILD`, VfsLib.makeFile(pkgbuild(t, e), user.name, Js.oct(644), g), user);
      const built = VfsLib.makeFile(`(built package ${t} - simulated)\n`, user.name, Js.oct(644), g);
      built.size = round(pkgById(e.pkgId).sizeKb * 400);
      sh.vfs.insert(`${cache}/${pkgFileName(t, e)}`, built, user);
    }
    ctx.out(dim(sh, "repos.yayPkgbuildHint"));
    for (const t of aurTargets) {
      const e = aur.get(t)!;
      ctx.out(`==> Making package: ${t} ${e.pkgver}-${e.pkgrel} (${UtilCmd.longDate()})\n==> Retrieving sources...\n==> Extracting sources...\n`);
      if (e.build.length !== 0) ctx.out("==> Starting build()...\n");
      ctx.out(
        `==> Entering fakeroot environment...\n==> Starting package()...\n==> Creating package "${t}"...\n==> Leaving fakeroot environment.\n==> Finished making: ${t} ${e.pkgver}-${e.pkgrel} (${UtilCmd.longDate()})\n`,
      );
    }
    const allPkgs = [...deps.map((d) => d.pkg), ...repoPkgs, ...aurTargets.map((t) => pkgById(aur.get(t)!.pkgId))];
    return sh.runAs("root", () =>
      pacmanTransaction(
        ctx,
        allPkgs,
        noconfirm,
        () => 0,
        () => 1,
      ),
    );
  }
  // Everything else (-Q, -R, -Si for normal packages ...) is passed on to pacman.
  const needsRoot = op === "R" || op === "S" || op === "U";
  return needsRoot ? asRootPacman(args) : sh.invoke(["pacman", ...args], ctx);
}
