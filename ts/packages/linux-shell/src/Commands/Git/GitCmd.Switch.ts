// Port of Commands/Git/GitCmd.Switch.cs – git switch.

import { parseArgs } from "./GitCmd.Args.js";
import { existsAt, gpath, needRepo, needWork } from "./GitCmd.Files.js";
import { branchExists, checkBranchName, hash40Re, previousBranch, readRef } from "./GitCmd.Refs.js";
import { needCommit, resolveCommit } from "./GitCmd.Revisions.js";
import { doSwitch, remoteGuess } from "./GitCmd.Subs.js";
import { fatal, raise, short, type G } from "./GitCmd.js";

export function cmdSwitch(g: G, args: string[]): number {
  const o = parseArgs(args, ["c|create=", "C|force-create=", "d|detach", "f|force|discard-changes", "t|track", "q|quiet"], "switch");
  const r = needRepo(g);
  needWork(r);
  if (existsAt(g, gpath(r, "MERGE_HEAD")) && !o.has("force")) throw fatal('cannot switch branch while merging\nConsider "git merge --quit" or "git worktree add".');
  const create = o.get("create") ?? o.get("force-create");
  if (create) {
    checkBranchName(g, create);
    if (branchExists(r, create) && !o.has("force-create")) throw fatal(`a branch named '${create}' already exists`);
    const start = o.operands.length > 0 ? o.operands[0]! : null;
    const track = start && readRef(r, `refs/remotes/${start}`) ? start : null;
    return doSwitch(r, { create, startRev: start, force: o.has("force"), track });
  }
  let name = o.operands.length > 0 ? o.operands[0]! : null;
  if (!name) throw fatal("missing branch or commit argument");
  if (name === "-") name = previousBranch(r) ?? raise(fatal("invalid reference: @{-1}"));
  if (o.has("detach")) return doSwitch(r, { detach: needCommit(r, name), startRev: name, force: o.has("force") });
  if (branchExists(r, name)) return doSwitch(r, { branch: name, force: o.has("force") });
  if (hash40Re.test(name) && resolveCommit(r, name) !== null) return doSwitch(r, { detach: name, startRev: short(name), force: o.has("force") });
  const remote = remoteGuess(r, name);
  if (remote !== null) return doSwitch(r, { create: name, startRev: remote, track: remote, force: o.has("force") });
  if (resolveCommit(r, name) !== null) {
    g.err(`fatal: a branch is expected, got ${readRef(r, `refs/tags/${name}`) ? "tag" : "commit"} '${name}'\n`);
    g.hint("If you want to detach HEAD at the commit, try again with the --detach option.");
    return 128;
  }
  throw fatal(`invalid reference: ${name}`);
}
