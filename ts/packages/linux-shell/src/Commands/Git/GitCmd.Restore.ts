// Port of Commands/Git/GitCmd.Restore.cs – git restore.

import { parseArgs } from "./GitCmd.Args.js";
import { needRepo, needWork } from "./GitCmd.Files.js";
import { restorePaths } from "./GitCmd.Subs.js";
import { fatal, type G } from "./GitCmd.js";

export function cmdRestore(g: G, args: string[]): number {
  const o = parseArgs(args, ["S|staged", "W|worktree", "s|source=", "ours", "theirs", "q|quiet"], "restore");
  const r = needRepo(g);
  needWork(r);
  const paths = [...o.operands, ...(o.paths ?? [])];
  if (paths.length === 0) throw fatal("you must specify path(s) to restore");
  const staged = o.has("staged");
  const worktree = o.has("worktree") || !staged;
  return restorePaths(r, paths, { staged, worktree, source: o.get("source"), ours: o.has("ours"), theirs: o.has("theirs") });
}
