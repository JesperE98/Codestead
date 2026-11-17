// Port of Commands/Git/GitCmd.Reset.cs – git reset.

import * as VfsLib from "../../Vfs/VfsLib.js";
import { parseArgs } from "./GitCmd.Args.js";
import { existsAt, gpath, needRepo, needWork, removeFile, type Repo } from "./GitCmd.Files.js";
import { newIndex, readIndex, writeIndex } from "./GitCmd.Index.js";
import { JsMap, union } from "./GitCmd.Json.js";
import { commitTree, readCommit, subject } from "./GitCmd.Objects.js";
import { moveHead, readHead } from "./GitCmd.Refs.js";
import { resolveCommit, revTree } from "./GitCmd.Revisions.js";
import { computeStatus } from "./GitCmd.Status.js";
import { specMatch, switchTree, toSpec } from "./GitCmd.WorkTree.js";
import { fatal, raise, short, type G } from "./GitCmd.js";

export function cmdReset(g: G, args: string[]): number {
  const o = parseArgs(args, ["soft", "mixed", "hard", "q|quiet", "keep", "merge"], "reset");
  const r = needRepo(g);
  const head = readHead(r);
  let rev = "HEAD";
  const ops = [...o.operands];
  if (ops.length > 0 && resolveCommit(r, ops[0]!) !== null && (o.paths !== null || ops.length === 1 || !existsAt(g, VfsLib.resolvePath(g.cwd, ops[0]!)))) {
    rev = ops.shift()!;
  }
  const paths = [...ops, ...(o.paths ?? [])];
  if (paths.length > 0) {
    if (o.has("hard") || o.has("soft")) throw fatal(`Cannot do ${o.has("hard") ? "hard" : "soft"} reset with paths.`);
    needWork(r);
    const t = rev === "HEAD" && !head.hash ? new JsMap<string>() : (revTree(r, rev) ?? raise(fatal(`Failed to resolve '${rev}' as a valid revision.`)));
    const specs = paths.map((p) => toSpec(r, p));
    const idx = readIndex(r);
    for (const p of union(idx.entries.keys, t.keys)) {
      if (!specs.some((s) => specMatch(s, p))) continue;
      const tp = t.get(p);
      if (tp) idx.entries.set(p, tp);
      else idx.entries.delete(p);
      idx.unmerged.delete(p);
    }
    writeIndex(r, idx);
    printUnstaged(r, o.has("quiet"));
    return 0;
  }
  const target = rev === "HEAD" && !head.hash ? null : (resolveCommit(r, rev) ?? raise(fatal(`ambiguous argument '${rev}': unknown revision or path not in the working tree.`)));
  const tree = commitTree(r, target);
  if (o.has("hard")) {
    needWork(r);
    switchTree(r, commitTree(r, head.hash), tree, "checkout", true);
  } else if (!o.has("soft")) {
    writeIndex(r, newIndex(tree.copy()));
  }
  for (const f of ["MERGE_HEAD", "MERGE_MSG", "MERGE_MODE"]) removeFile(g, gpath(r, f));
  if (target && target !== head.hash) moveHead(r, target, `reset: moving to ${rev}`);
  if (o.has("hard")) {
    if (target && !o.has("quiet")) g.out(`HEAD is now at ${short(target)} ${subject(readCommit(r, target))}\n`);
  } else if (!o.has("soft") && r.root !== null) printUnstaged(r, o.has("quiet"));
  return 0;
}

function printUnstaged(r: Repo, quiet: boolean): void {
  if (quiet) return;
  const s = computeStatus(r);
  if (s.unstaged.length === 0) return;
  r.g.out(`Unstaged changes after reset:\n${s.unstaged.map((c) => `${c.status}\t${c.path}\n`).join("")}`);
}
