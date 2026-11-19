// Port of Commands/Pkg/PkgCmd.Dnf.cs – the dnf and dnf5 commands.

import { Js } from "../../Js.js";
import type { PackageDef } from "../../Packages/PackageDef.js";
import { availableVersion, findPackage, formatMiB, installPackage, isInstalled, removePackage, searchPackages, upgradable } from "../../Packages/PackagesLib.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as ReposCmd from "../Repos/ReposCmd.js";
import { confirm, familyPackages, flag, isRoot, pkgName } from "./PkgCmd.js";

const dnfYesFlags = ["-y", "--assumeyes"];
const dnfHeader = "Package                      Arch    Version                    Repository       Size\n";

export function dnf(name: string): CommandDef {
  return {
    name,
    summary: "Pakethanteraren i Fedora och Red Hat",
    man: `NAMN
       dnf - pakethanterare för Fedora, RHEL, Rocky Linux och liknande

SYNOPSIS
       dnf [-y] KOMMANDO [PAKET]...

KOMMANDON
       install PAKET     installera paket
       remove PAKET      ta bort paket
       upgrade           uppgradera alla paket
       check-update      visa vilka paket som kan uppgraderas
       makecache         hämta ny metadata från förråden
       search ORD        sök efter paket
       info PAKET        visa information om ett paket
       list --installed  lista installerade paket
       repolist          visa aktiverade förråd (repositories)

FLAGGOR
       -y, --assumeyes   svara ja på alla frågor

BESKRIVNING
       dnf uppdaterar metadata automatiskt när den är gammal, så det
       finns inget separat "update"-steg som i apt. Observera att frågan
       "Is this ok [y/N]" har Nej som standard – tryck y och Enter.`,
    run: runDnf,
  };
}

const lastDash = /-(?=[^-]+$)/;

function runDnf(ctx: CmdCtx): number {
  const sh = ctx.sh;
  const fam = sh.distro.family;
  const assumeYes = ctx.args.some((a) => dnfYesFlags.includes(a));
  const args = ctx.args.filter((a) => !dnfYesFlags.includes(a));
  const sub = args.length > 0 ? args[0]! : null;
  const rest = args.slice(1);
  const targets = rest.filter((a) => !a.startsWith("-"));
  const ver = (p: PackageDef): string => availableVersion(sh, p);
  const rootError = (): number => {
    ctx.err("This command has to be run with superuser privileges (under the root user on most systems).\n");
    return 1;
  };
  const loadRepos = (): void => {
    if (!flag(sh, "repoSynced")) {
      ctx.out(
        `Updating and loading repositories:\n Fedora ${sh.distro.version} - x86_64 - Updates   100% |   2.1 MiB/s |   5.3 MiB |  00m03s\n` +
          ` Fedora ${sh.distro.version} - x86_64             100% |   9.8 MiB/s |  35.6 MiB |  00m04s\nRepositories loaded.\n`,
      );
      sh.flags.set("repoSynced", true);
    } else {
      ctx.out("Updating and loading repositories:\nRepositories loaded.\n");
    }
  };
  const row = (p: PackageDef, v: string, repo: string): string =>
    ` ${pkgName(ctx, p).padEnd(28)} x86_64  ${v.padEnd(26)} ${repo.padEnd(10)} ${formatMiB(p.sizeKb).padStart(10)}\n`;
  const sum = (list: PackageDef[]): number => list.reduce((s, p) => s + p.sizeKb, 0);

  switch (sub) {
    case null:
    case "--help":
    case "help":
      ctx.out(
        "Usage:\n  dnf5 [GLOBAL OPTIONS] <COMMAND> ...\n\nSoftware Management Commands:\n  install    Install software\n  upgrade    Upgrade software\n  remove     Remove (uninstall) software\n  search     Search for software\n  info       Provide detailed information about installed or available packages\n  list       List installed or available packages\n  check-upgrade  Check for available package upgrades\n  makecache  Generate the metadata cache\n  repolist   List repositories\n",
      );
      return sub !== null ? 0 : 2;
    case "install":
    case "in": {
      if (!isRoot(ctx)) return rootError();
      loadRepos();
      const list: PackageDef[] = [];
      for (const t of targets) {
        const p = findPackage(fam, t, sh);
        if (p === null) {
          ctx.err(`Failed to resolve the transaction:\nNo match for argument: ${t}\nYou can try to add to command line:\n  --skip-unavailable to skip unavailable packages\n`);
          return 1;
        }
        if (isInstalled(sh, p) && sh.installed.get(p.id) === ver(p)) ctx.out(`Package "${t}-${ver(p)}.x86_64" is already installed.\n`);
        else if (!list.includes(p)) list.push(p);
      }
      if (list.length === 0) {
        ctx.out("\nNothing to do.\n");
        return 0;
      }
      const size = sum(list);
      ctx.out(dnfHeader + "Installing:\n" + list.map((p) => row(p, ver(p), ReposCmd.dnfRepoId(p))).join(""));
      ctx.out(
        `\nTransaction Summary:\n Installing:        ${list.length} package${list.length > 1 ? "s" : ""}\n\n` +
          `Total size of inbound packages is ${formatMiB(size * 0.4)}. Need to download ${formatMiB(size * 0.4)}.\n` +
          `After this operation, ${formatMiB(size)} extra will be used (install ${formatMiB(size)}, remove 0 B).\n`,
      );
      return confirm(
        ctx,
        "Is this ok [y/N]: ",
        false,
        assumeYes,
        (io) => {
          for (let i = 0; i < list.length; i++) {
            const p = list[i]!;
            io.out(`[${i + 1}/${list.length}] ${pkgName(ctx, p)}-0:${ver(p)}.x86_64          100% |   1.8 MiB/s | ${formatMiB(p.sizeKb * 0.4)} |  00m00s\n`);
          }
          io.out(`Running transaction\n[1/${list.length + 2}] Verify package files            100%\n[2/${list.length + 2}] Prepare transaction             100%\n`);
          for (let i = 0; i < list.length; i++) {
            const p = list[i]!;
            io.out(`[${i + 3}/${list.length + 2}] Installing ${pkgName(ctx, p)}-0:${ver(p)}.x86_64   100%\n`);
            installPackage(sh, p);
          }
          io.out("Complete!\n");
          return 0;
        },
        (io) => {
          io.out("Operation aborted by the user.\n");
          return 1;
        },
      );
    }
    case "remove":
    case "rm":
    case "erase": {
      if (!isRoot(ctx)) return rootError();
      const list: PackageDef[] = [];
      for (const t of targets) {
        const p = findPackage(fam, t, sh);
        if (p === null || !isInstalled(sh, p)) {
          ctx.out(`No packages to remove for argument: ${t}\n`);
          continue;
        }
        if (p.essential === true) {
          ctx.err(`Failed to resolve the transaction:\nProblem: The operation would result in removing the following protected packages: ${t}\n`);
          return 1;
        }
        list.push(p);
      }
      if (list.length === 0) {
        ctx.out("\nNothing to do.\n");
        return 0;
      }
      ctx.out(dnfHeader + "Removing:\n" + list.map((p) => row(p, sh.installed.get(p.id)!, "@System")).join(""));
      ctx.out(`\nTransaction Summary:\n Removing:          ${list.length} package${list.length > 1 ? "s" : ""}\n\nAfter this operation, ${formatMiB(sum(list))} will be freed.\n`);
      return confirm(
        ctx,
        "Is this ok [y/N]: ",
        false,
        assumeYes,
        (io) => {
          io.out(`Running transaction\n[1/${list.length + 1}] Prepare transaction             100%\n`);
          for (let i = 0; i < list.length; i++) {
            const p = list[i]!;
            io.out(`[${i + 2}/${list.length + 1}] Removing ${pkgName(ctx, p)}-0:${sh.installed.get(p.id)}.x86_64   100%\n`);
            removePackage(sh, p);
          }
          io.out("Complete!\n");
          return 0;
        },
        (io) => {
          io.out("Operation aborted by the user.\n");
          return 1;
        },
      );
    }
    case "upgrade":
    case "update": {
      if (!isRoot(ctx)) return rootError();
      loadRepos();
      const ups = upgradable(sh);
      if (ups.length === 0) {
        ctx.out("Nothing to do.\n");
        sh.flags.set("upgraded", true);
        return 0;
      }
      ctx.out(dnfHeader + "Upgrading:\n" + ups.map((p) => row(p, ver(p), "updates") + `   replacing ${pkgName(ctx, p).padEnd(18)} x86_64  ${sh.installed.get(p.id)}\n`).join(""));
      ctx.out(`\nTransaction Summary:\n Upgrading:         ${ups.length} packages\n Replacing:         ${ups.length} packages\n`);
      return confirm(
        ctx,
        "Is this ok [y/N]: ",
        false,
        assumeYes,
        (io) => {
          io.out("Running transaction\n");
          for (let i = 0; i < ups.length; i++) {
            const p = ups[i]!;
            io.out(`[${i + 1}/${ups.length}] Upgrading ${pkgName(ctx, p)}-0:${ver(p)}.x86_64   100%\n`);
            installPackage(sh, p);
          }
          sh.flags.set("upgraded", true);
          io.out("Complete!\n");
          return 0;
        },
        (io) => {
          io.out("Operation aborted by the user.\n");
          return 1;
        },
      );
    }
    case "check-update":
    case "check-upgrade": {
      loadRepos();
      const ups = upgradable(sh);
      for (const p of ups) ctx.out(`${(pkgName(ctx, p) + ".x86_64").padEnd(30)} ${ver(p).padEnd(26)} updates\n`);
      // Just like the real dnf: exit code 100 means "there are updates".
      return ups.length !== 0 ? 100 : 0;
    }
    case "makecache":
      loadRepos();
      ctx.out("Metadata cache created.\n");
      return 0;
    case "repolist":
      ctx.out(
        `repo id                          repo name\n${ReposCmd.dnfCoprRepolist(sh)}fedora                           Fedora ${sh.distro.version} - x86_64\nupdates                          Fedora ${sh.distro.version} - x86_64 - Updates\n`,
      );
      return 0;
    case "copr":
      return ReposCmd.dnfCopr(ctx, rest);
    case "search": {
      loadRepos();
      const results = searchPackages(fam, targets.join(" "), sh);
      if (results.length === 0) {
        ctx.out("No matches found.\n");
        return 1;
      }
      ctx.out("Matched fields: name, summary\n");
      for (const p of results) ctx.out(` ${pkgName(ctx, p)}.x86_64\t${p.description}\n`);
      return 0;
    }
    case "info": {
      loadRepos();
      let code = 0;
      for (const t of targets) {
        const p = findPackage(fam, t, sh);
        if (p === null) {
          ctx.err("No matching packages to list\n");
          code = 1;
          continue;
        }
        const installedNow = isInstalled(sh, p);
        const parts = (installedNow ? sh.installed.get(p.id)! : ver(p)).split(lastDash);
        const version = parts[0]!;
        const release = parts.length > 1 ? parts[1]! : null;
        ctx.out(
          `${installedNow ? "Installed" : "Available"} packages\nName            : ${t}\nVersion         : ${version}\n` +
            `Release         : ${release ?? "1"}\nArchitecture    : x86_64\nInstalled size  : ${formatMiB(p.sizeKb)}\n` +
            `Repository      : ${installedNow ? "@System" : ReposCmd.dnfRepoId(p)}\n` +
            (installedNow ? `From repository : ${p.base !== null && p.base !== undefined ? "anaconda" : ReposCmd.dnfRepoId(p)}\n` : "") +
            `Summary         : ${p.description}\n\n`,
        );
      }
      return code;
    }
    case "list": {
      loadRepos();
      const installedOnly = rest.includes("--installed") || rest.includes("installed");
      const upgradesOnly = rest.includes("--upgrades") || rest.includes("upgrades");
      const list = familyPackages(ctx).sort((a, b) => Js.localeCompare(pkgName(ctx, a), pkgName(ctx, b)));
      const line = (p: PackageDef, v: string, repo: string): string => `${(pkgName(ctx, p) + ".x86_64").padEnd(30)} ${v.padEnd(26)} ${repo}\n`;
      if (upgradesOnly) {
        ctx.out("Available upgrades\n");
        for (const p of upgradable(sh)) ctx.out(line(p, ver(p), "updates"));
        return 0;
      }
      ctx.out("Installed packages\n");
      for (const p of list.filter((p) => isInstalled(sh, p))) ctx.out(line(p, sh.installed.get(p.id)!, "anaconda"));
      if (!installedOnly) {
        ctx.out("\nAvailable packages\n");
        for (const p of list.filter((p) => !isInstalled(sh, p))) ctx.out(line(p, ver(p), "fedora"));
      }
      return 0;
    }
  }
  ctx.err(`Unknown argument "${sub ?? ""}" for command "dnf5". Add "--help" for more information about the arguments.\n`);
  return 2;
}
