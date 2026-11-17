// Port of Commands/Repos/ReposCmd.Copr.cs – COPR (Fedora): the known COPR projects and dnf copr
// enable/disable/list.

import type { Copr } from "../../Extrarepo/Copr.js";
import { coprEnabled, coprId, coprRepoPath, parseCopr } from "../../Extrarepo/ExtrarepoLib.js";
import type { PackageDef } from "../../Packages/PackageDef.js";
import type { Shell } from "../../Shell/Shell.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import { askYesNo, isRoot, writeRootFile } from "./ReposCmd.js";

export interface CoprInfo {
  description: string;
  packages: string[];
}

export const coprs = new Map<string, CoprInfo>([["lunatool/moonphase", { description: "moonphase – the phase of the moon in your terminal", packages: ["moonphase"] }]]);

function coprName(c: Copr): string {
  return `${c.owner}/${c.project}`;
}

function coprFull(c: Copr): string {
  return `copr.fedorainfracloud.org/${coprName(c)}`;
}

function coprRepoFile(c: Copr): string {
  const dl = `https://download.copr.fedorainfracloud.org/results/${coprName(c)}`;
  return (
    `[${coprId(c)}]\nname=Copr repo for ${c.project} owned by ${c.owner}\nbaseurl=${dl}/fedora-$releasever-$basearch/\n` +
    `type=rpm-md\nskip_if_unavailable=True\ngpgcheck=1\ngpgkey=${dl}/pubkey.gpg\nrepo_gpgcheck=0\nenabled=1\nenabled_metadata=1\n`
  );
}

const coprFileRe = /^_copr:copr\.fedorainfracloud\.org:([^:]+):(.+)\.repo$/;

/** All COPR repositories that exist as .repo files in /etc/yum.repos.d. */
export function configuredCoprs(sh: Shell): Copr[] {
  const dir = sh.vfs.tryLookup("/etc/yum.repos.d", sh.rootUser());
  const result: Copr[] = [];
  for (const name of [...(dir?.children?.keys() ?? [])].sort()) {
    const m = coprFileRe.exec(name);
    if (m) result.push({ owner: m[1]!.replace(/^group_/, "@"), project: m[2]! });
  }
  return result;
}

/** The repository's name in dnf (e.g. in the "Repository" column). */
export function dnfRepoId(p: PackageDef): string {
  const rh = p.extraRepo?.get("redhat");
  const copr = rh ? parseCopr(rh) : null;
  return copr !== null ? coprId(copr) : "fedora";
}

/** Lines for `dnf repolist`: enabled COPR repositories. */
export function dnfCoprRepolist(sh: Shell): string {
  return configuredCoprs(sh)
    .filter((c) => coprEnabled(sh, c))
    .map((c) => `${coprId(c).padEnd(32)} Copr repo for ${c.project} owned by ${c.owner}\n`)
    .join("");
}

/** `dnf copr enable|disable|remove|list`. */
export function dnfCopr(ctx: CmdCtx, args: string[]): number {
  const sh = ctx.sh;
  const assumeYes = args.includes("-y") || args.includes("--assumeyes") || ctx.args.includes("-y") || ctx.args.includes("--assumeyes");
  const positional = args.filter((a) => !a.startsWith("-"));
  const action = positional.length > 0 ? positional[0]! : null;
  const spec = positional.length > 1 ? positional[1]! : null;
  const rootError = (): number => {
    ctx.err("This command has to be run with superuser privileges (under the root user on most systems).\n");
    return 1;
  };
  const usage = (): void =>
    ctx.out(
      "Usage:\n  dnf5 [GLOBAL OPTIONS] copr <COMMAND> ...\n\nCommands:\n  list     list Copr repositories\n  enable   download the repository info from a Copr server and install it\n" +
        "  disable  disable specified Copr repository (if exists), keep the repo file\n  remove   remove specified Copr repository from the system\n",
    );
  if (!action || action === "--help" || action === "help") {
    usage();
    return action ? 0 : 2;
  }
  if (action === "list") {
    for (const c of configuredCoprs(sh)) ctx.out(`${coprFull(c)}${coprEnabled(sh, c) ? "" : " (disabled)"}\n`);
    return 0;
  }
  if (!["enable", "disable", "remove"].includes(action)) {
    ctx.err(`Unknown argument "${action}" for command "copr". Add "--help" for more information about the arguments.\n`);
    return 2;
  }
  const copr = spec ? parseCopr(spec) : null;
  if (copr === null) {
    ctx.err(spec ? `Can't parse Copr repo spec: '${spec}'\n` : `Missing positional argument "PROJECT_SPEC" for command "${action}".\n`);
    return 2;
  }
  if (!isRoot(sh)) return rootError();
  const path = coprRepoPath(copr);
  const exists = sh.vfs.tryLookup(path, sh.rootUser()) !== null;
  if (action === "enable") {
    if (!coprs.has(coprName(copr))) {
      ctx.err(`Failed to download Copr project info from https://copr.fedorainfracloud.org/api_3/project/?ownername=${copr.owner}&projectname=${copr.project}: 404 Not Found\n`);
      return 1;
    }
    ctx.out(
      "Enabling a Copr repository. Please note that this repository is not part\nof the main distribution, and quality may vary.\n\n" +
        "The Fedora Project does not exercise any power over the contents of\nthis repository beyond the rules outlined in the Copr FAQ at\n" +
        "<https://docs.pagure.org/copr.copr/user_documentation.html#what-i-can-build-in-copr>,\nand packages are not held to any quality or security level.\n\n" +
        "Please do not file bug reports about these packages in Fedora\nBugzilla. In case of problems, contact the owner of this repository.\n\n",
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
        io.out("Operation aborted by the user.\n");
        return 1;
      },
    );
  }
  if (!exists) {
    ctx.err(`Repository '${coprFull(copr)}' not found on this system\n`);
    return 1;
  }
  if (action === "disable") {
    const node = sh.vfs.lookup(path, sh.rootUser());
    node.content = (node.content ?? "").replace(/^enabled\s*=.*$/m, "enabled=0");
    ctx.out(`Copr repository '${coprFull(copr)}' in '${path}' disabled.\n`);
    return 0;
  }
  sh.vfs.remove(path, sh.rootUser());
  ctx.out(`Repository '${coprFull(copr)}' removed.\n`);
  return 0;
}
