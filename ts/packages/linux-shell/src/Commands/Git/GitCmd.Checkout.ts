// Port of Commands/Git/GitCmd.Checkout.cs – git checkout.

import { parseArgs } from "./GitCmd.Args.js";
import { existsAt, gpath, needRepo, needWork } from "./GitCmd.Files.js";
import { branchExists, checkBranchName, previousBranch, readRef } from "./GitCmd.Refs.js";
import { resolveCommit } from "./GitCmd.Revisions.js";
import { doSwitch, remoteGuess, restorePaths } from "./GitCmd.Subs.js";
import { fail, fatal, raise, type G } from "./GitCmd.js";

export function cmdCheckout(g: G, args: string[]): number {
  const o = parseArgs(args, ["b=", "B=", "f|force", "q|quiet", "detach", "ours", "theirs", "t|track"], "checkout");
  const r = needRepo(g);
  needWork(r);
  const create = o.get("b") ?? o.get("B");
  if (create) {
    checkBranchName(g, create);
    if (branchExists(r, create) && !o.has("B")) throw fatal(`a branch named '${create}' already exists`);
    const start = o.operands.length > 0 ? o.operands[0]! : null;
    const track = start && readRef(r, `refs/remotes/${start}`) ? start : null;
    return doSwitch(r, { create, startRev: start, force: o.has("force"), track });
  }
  if (o.paths !== null || o.has("ours") || o.has("theirs")) {
    const source = o.operands.length > 0 ? o.operands[0]! : null;
    const paths = o.paths ?? o.operands;
    if (o.paths !== null && o.operands.length > 1) throw fatal("only one reference expected");
    if (paths.length === 0) throw fatal("you must specify path(s) to restore");
    return restorePaths(r, paths, {
      worktree: true,
      staged: !!source && o.paths !== null,
      source: o.paths !== null ? source : null,
      ours: o.has("ours"),
      theirs: o.has("theirs"),
      checkoutStyle: true,
    });
  }
  let name = o.operands.length > 0 ? o.operands[0]! : null;
  if (!name) return 0;
  if (name === "-") name = previousBranch(r) ?? raise(fatal("invalid reference: @{-1}"));
  if (o.operands.length === 1) {
    if (existsAt(g, gpath(r, "MERGE_HEAD")) && !o.has("force") && (branchExists(r, name) || resolveCommit(r, name) !== null)) {
      throw fail("error: you need to resolve your current index first");
    }
    if (branchExists(r, name) && !o.has("detach")) return doSwitch(r, { branch: name, force: o.has("force") });
    const h = resolveCommit(r, name);
    if (h !== null) return doSwitch(r, { detach: h, startRev: name, force: o.has("force") });
    const remote = remoteGuess(r, name);
    if (remote !== null) return doSwitch(r, { create: name, startRev: remote, track: remote, force: o.has("force") });
  }
  // Otherwise they are files: bring back the version from the index.
  const isRev = o.operands.length > 1 && resolveCommit(r, o.operands[0]!) !== null;
  const files = isRev ? o.operands.slice(1) : o.operands;
  return restorePaths(r, files, { worktree: true, staged: isRev, source: isRev ? o.operands[0]! : null, checkoutStyle: true });
}
