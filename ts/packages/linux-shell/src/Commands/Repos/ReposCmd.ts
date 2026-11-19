// Port of Commands/Repos/ReposCmd.cs (src/shell/commands/repos.ts) – repositories outside the distribution's own:
//   - PPA (Ubuntu, and at your own risk Debian): add-apt-repository + apt
//   - AUR (Arch): git clone + makepkg, and the AUR helper yay
//   - COPR (Fedora): dnf copr enable/disable/list
// Plus the made-up programs installed from there (moonphase, snowfall).
// The functions that apt and dnf (PkgCmd) call are in ReposCmd.Ppa.ts and ReposCmd.Copr.ts.
// This is the group's root file (helpers and the command list); the commands themselves are ReposCmd.<Name>.ts.

import * as ExtrarepoLib from "../../Extrarepo/ExtrarepoLib.js";
import type { Obj } from "../../Js.js";
import type { PackageDef } from "../../Packages/PackageDef.js";
import * as PackagesLib from "../../Packages/PackagesLib.js";
import type { Shell } from "../../Shell/Shell.js";
import type { MsgArgs } from "../../ShellI18n.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import type { Sink } from "../../Types/Sink.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { addAptRepository } from "./ReposCmd.AddAptRepository.js";
import { go } from "./ReposCmd.Go.js";
import { makepkg } from "./ReposCmd.Makepkg.js";
import { moonphase } from "./ReposCmd.Moonphase.js";
import { snowfall } from "./ReposCmd.Snowfall.js";
import { yay } from "./ReposCmd.Yay.js";

export * from "./ReposCmd.AddAptRepository.js";
export * from "./ReposCmd.Aur.js";
export * from "./ReposCmd.Copr.js";
export * from "./ReposCmd.Go.js";
export * from "./ReposCmd.Makepkg.js";
export * from "./ReposCmd.Moonphase.js";
export * from "./ReposCmd.Ppa.js";
export * from "./ReposCmd.Snowfall.js";
export * from "./ReposCmd.Yay.js";

export function isRoot(sh: Shell): boolean {
  return sh.currentUser().uid === 0;
}

export function dim(sh: Shell, key: string, args?: MsgArgs): string {
  return `${UtilCmd.Color.dim}${sh.msg(key, args)}${UtilCmd.Color.reset}\n`;
}

export function pkgById(id: string): PackageDef {
  return PackagesLib.packages.find((p) => p.id === id)!;
}

/** sh.installed[id] used as a truth value. */
export function has(sh: Shell, id: string): boolean {
  return !!sh.installed.get(id);
}

export function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

/** Math.round for non-negative numbers. */
export function round(v: number): number {
  return Math.floor(v + 0.5);
}

export function kids(...items: [string, FsNode][]): Obj<FsNode> {
  return new Map(items);
}

/**
 * Asks yes/no unless assumeYes. If input comes from a pipe the answer is read from there.
 * (The same behaviour as the package managers in PkgCmd.ts.)
 */
export function askYesNo(ctx: CmdCtx, question: string, defaultYes: boolean, assumeYes: boolean, onYes: (io: Sink) => number, onNo: (io: Sink) => number): number {
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

/** Writes a file as root and creates the directories needed. */
export function writeRootFile(sh: Shell, path: string, content: string): void {
  ExtrarepoLib.ensureDir(sh, path.slice(0, path.lastIndexOf("/")));
  sh.vfs.writeFile(path, content, sh.rootUser());
}

// ================================================================ The programs

export const Synodic = 29.530588853;
const newMoon2000 = Date.UTC(2000, 0, 6, 18, 14, 0);

/** The moon's age in days since the last new moon. */
export function moonAge(ms: number): number {
  const age = ((ms - newMoon2000) / 86_400_000) % Synodic;
  return age < 0 ? age + Synodic : age;
}

let list: CommandDef[] | null = null;

/** The group's commands, in the C# order (built on first use). */
export function all(): CommandDef[] {
  return (list ??= [addAptRepository, makepkg, yay, moonphase, snowfall, go]);
}
