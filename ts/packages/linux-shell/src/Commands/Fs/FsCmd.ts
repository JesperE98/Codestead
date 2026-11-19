// Port of Commands/Fs/FsCmd.cs (src/shell/commands/fs.ts) – navigating and handling files: cd, pwd, ls, mkdir,
// touch, rm, cp, mv, find, chmod, chown. This is the group's root file: the shared helpers and the command list.
// The commands themselves are FsCmd.<Name>.ts.

import { Js } from "../../Js.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import type { User } from "../../Vfs/User.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { cd } from "./FsCmd.Cd.js";
import { chmod } from "./FsCmd.Chmod.js";
import { chown } from "./FsCmd.Chown.js";
import { cp } from "./FsCmd.Cp.js";
import { find } from "./FsCmd.Find.js";
import { ls } from "./FsCmd.Ls.js";
import { mkdir } from "./FsCmd.Mkdir.js";
import { mv } from "./FsCmd.Mv.js";
import { pwd } from "./FsCmd.Pwd.js";
import { rm } from "./FsCmd.Rm.js";
import { rmdir } from "./FsCmd.Rmdir.js";
import { touch } from "./FsCmd.Touch.js";

export * from "./FsCmd.Cd.js";
export * from "./FsCmd.Chmod.js";
export * from "./FsCmd.Chown.js";
export * from "./FsCmd.Cp.js";
export * from "./FsCmd.Find.js";
export * from "./FsCmd.Ls.js";
export * from "./FsCmd.Mkdir.js";
export * from "./FsCmd.Mv.js";
export * from "./FsCmd.Pwd.js";
export * from "./FsCmd.Rm.js";
export * from "./FsCmd.Rmdir.js";
export * from "./FsCmd.Touch.js";

export function joinPath(dir: string, name: string): string {
  return dir === "/" ? `/${name}` : `${dir}/${name}`;
}

function chownTree(node: FsNode, user: User): void {
  node.owner = user.name;
  node.group = user.groups[0]!;
  node.mtime = Js.now();
  for (const c of [...(node.children?.values() ?? [])]) chownTree(c, user);
}

/** Shared logic for cp and mv. */
export function copyOrMove(ctx: CmdCtx, move: boolean): number {
  const o = UtilCmd.parseOpts(ctx.args, {
    flags: move ? "fivn" : "rRfivan",
    long: { recursive: "r", force: "f", verbose: "v", archive: "a", interactive: "i" },
  });
  if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
  const name = ctx.name;
  const ops = [...o.operands];
  if (ops.length === 0) return UtilCmd.badOption(ctx, "missing file operand");
  if (ops.length === 1) return UtilCmd.badOption(ctx, `missing destination file operand after '${ops[0]}'`);
  const sh = ctx.sh;
  const user = sh.currentUser();
  const dest = ops.pop()!;
  const destPath = sh.resolve(dest);
  const destNode = sh.vfs.tryLookup(destPath, user);
  if (ops.length > 1 && destNode?.type !== "dir") {
    ctx.err(`${name}: target '${dest}' is not a directory\n`);
    return 1;
  }
  const recursive = move || o.flags.has("r") || o.flags.has("R") || o.flags.has("a");
  let code = 0;
  for (const src of ops) {
    const srcPath = sh.resolve(src);
    let node: FsNode;
    try {
      // mv moves a symbolic link itself; cp copies what it points to.
      node = sh.vfs.lookup(srcPath, user, !move || src.endsWith("/"));
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      ctx.err(`${name}: cannot stat '${src}': ${e.message}\n`);
      code = 1;
      continue;
    }
    if (node.type === "dir" && !recursive) {
      ctx.err(`cp: -r not specified; omitting directory '${src}'\n`);
      code = 1;
      continue;
    }
    const target = destNode?.type === "dir" ? joinPath(destPath, VfsLib.basename(srcPath)) : destPath;
    const trimmedDest = dest.replace(/\/+$/, "");
    const targetLabel = destNode?.type === "dir" ? joinPath(trimmedDest !== "" ? trimmedDest : "/", VfsLib.basename(srcPath)) : dest;
    if (target === srcPath) {
      ctx.err(`${name}: '${src}' and '${targetLabel}' are the same file\n`);
      code = 1;
      continue;
    }
    if (node.type === "dir" && target.startsWith(srcPath + "/")) {
      ctx.err(
        move
          ? `mv: cannot move '${src}' to a subdirectory of itself, '${targetLabel}'\n`
          : `cp: cannot copy a directory, '${src}', into itself, '${targetLabel}'\n`,
      );
      code = 1;
      continue;
    }
    const existing = sh.vfs.tryLookup(target, user);
    if (existing?.type === "dir" && node.type !== "dir") {
      ctx.err(`${name}: cannot overwrite directory '${targetLabel}' with non-directory\n`);
      code = 1;
      continue;
    }
    try {
      if (move) {
        const { dir } = sh.vfs.parent(srcPath, user);
        if (!VfsLib.hasPerm(dir, user, "w")) throw new FsError("EACCES");
        sh.vfs.insert(target, node, user);
        dir.children!.delete(VfsLib.basename(srcPath));
      } else {
        if (node.type === "file" && !VfsLib.hasPerm(node, user, "r")) {
          ctx.err(`cp: cannot open '${src}' for reading: Permission denied\n`);
          code = 1;
          continue;
        }
        if (existing?.type === "file") {
          if (!VfsLib.hasPerm(existing, user, "w")) throw new FsError("EACCES");
          existing.content = node.content;
          existing.size = node.size;
          existing.mtime = Js.now();
        } else {
          const copy = VfsLib.cloneNode(node);
          if (!o.flags.has("a")) chownTree(copy, user);
          sh.vfs.insert(target, copy, user);
        }
      }
      if (o.flags.has("v")) ctx.out(move ? `renamed '${src}' -> '${targetLabel}'\n` : `'${src}' -> '${targetLabel}'\n`);
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      const msg = e.message;
      ctx.err(
        move
          ? `mv: cannot move '${src}' to '${targetLabel}': ${msg}\n`
          : `cp: cannot create ${node.type === "dir" ? "directory" : "regular file"} '${targetLabel}': ${msg}\n`,
      );
      code = 1;
    }
  }
  return code;
}

const modeRe = /^([ugoa]*[-+=][rwxXst]*)(,[ugoa]*[-+=][rwxXst]*)*$/;
const octalModeRe = /^[0-7]{1,4}$/;
const clauseRe = /^([ugoa]*)([-+=])([rwxXst]*)$/;

/** The new mode after `chmod spec` (octal or symbolic), or null if spec is not a valid mode. */
export function applyMode(current: number, spec: string, isDir: boolean): number | null {
  if (octalModeRe.test(spec)) return Number.parseInt(spec, 8);
  if (!modeRe.test(spec)) return null;
  let mode = current;
  for (const clause of spec.split(",")) {
    const m = clauseRe.exec(clause)!;
    const who = m[1] !== "" ? m[1]! : "a";
    const classes = who.includes("a") ? ["u", "g", "o"] : [...new Set(who)];
    let bits = 0;
    let clear = 0;
    for (const c of classes) {
      const shift = c === "u" ? 6 : c === "g" ? 3 : 0;
      clear |= 7 << shift;
      for (const p of m[3]!) {
        if (p === "r") bits |= 4 << shift;
        if (p === "w") bits |= 2 << shift;
        if (p === "x") bits |= 1 << shift;
        if (p === "X" && (isDir || (current & Js.oct(111)) !== 0)) bits |= 1 << shift;
        if (p === "s" && c === "u") bits |= Js.oct(4000);
        if (p === "s" && c === "g") bits |= Js.oct(2000);
        if (p === "t" && c === "o") bits |= Js.oct(1000);
      }
    }
    const op = m[2];
    if (op === "+") mode |= bits;
    else if (op === "-") mode &= ~bits;
    else mode = (mode & ~clear) | bits;
  }
  return mode;
}

/** The group's commands, in the C# order. */
export function all(): CommandDef[] {
  return [cd, pwd, ls, mkdir, rmdir, touch, rm, cp, mv, find, chmod, chown];
}
