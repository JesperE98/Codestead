// Port of Commands/Pkg/PkgCmd.cs (src/shell/commands/pkg.ts) – simulated package managers: apt (Debian/Ubuntu),
// pacman (Arch) and dnf (Fedora/RHEL). The output imitates the real programs, but simplified.
// This is the group's root file (helpers and the command list); the commands themselves are PkgCmd.<Name>.ts.

import type { PackageDef } from "../../Packages/PackageDef.js";
import * as PackagesLib from "../../Packages/PackagesLib.js";
import type { Shell } from "../../Shell/Shell.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import type { Sink } from "../../Types/Sink.js";
import { makeApt } from "./PkgCmd.Apt.js";
import { dnf } from "./PkgCmd.Dnf.js";
import { pacman } from "./PkgCmd.Pacman.js";

export * from "./PkgCmd.Apt.js";
export * from "./PkgCmd.Dnf.js";
export * from "./PkgCmd.Pacman.js";

export function isRoot(ctx: CmdCtx): boolean {
  return ctx.sh.currentUser().uid === 0;
}

export function pkgName(ctx: CmdCtx, p: PackageDef): string {
  return p.names.get(ctx.sh.distro.family)!;
}

export function familyPackages(ctx: CmdCtx): PackageDef[] {
  return PackagesLib.packages.filter((p) => !!p.names.get(ctx.sh.distro.family) && PackagesLib.isKnown(ctx.sh, p));
}

export function flag(sh: Shell, key: string): boolean {
  return sh.flags.get(key) === true;
}

/**
 * Asks "continue? [Y/n]" unless -y/--noconfirm was given.
 * If input comes from a pipe (e.g. `yes | apt ...`) the answer is read from there.
 */
export function confirm(ctx: CmdCtx, question: string, defaultYes: boolean, assumeYes: boolean, onYes: (io: Sink) => number, onNo: (io: Sink) => number): number {
  if (assumeYes) return onYes(ctx);
  if (ctx.stdin !== null) {
    const answer = ctx.stdin.split("\n")[0]!.trim();
    ctx.out(question + answer + "\n");
    const yes = answer === "" ? defaultYes : /^(y|yes|j|ja)$/i.test(answer);
    return yes ? onYes(ctx) : onNo(ctx);
  }
  ctx.sh.ask(question, defaultYes, (yes, io) => (yes ? onYes(io) : onNo(io)));
  return 0;
}

let list: CommandDef[] | null = null;

/** The group's commands, in the C# order (built on first use). */
export function all(): CommandDef[] {
  return (list ??= [makeApt("apt"), makeApt("apt-get"), pacman, dnf("dnf"), dnf("dnf5")]);
}
