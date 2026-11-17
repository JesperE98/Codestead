// Port of Commands/Git/GitCmd.Merge.cs – git merge.

import { parseArgs } from "./GitCmd.Args.js";
import { getConfig } from "./GitCmd.Config.js";
import { gpath, needRepo, needWork, readText, removeFile } from "./GitCmd.Files.js";
import { cmdCommit } from "./GitCmd.Commit.js";
import { readIndex, writeIndex, type Unmerged } from "./GitCmd.Index.js";
import { JsMap, union } from "./GitCmd.Json.js";
import { commitTree, readBlob } from "./GitCmd.Objects.js";
import { previousBranch, readHead } from "./GitCmd.Refs.js";
import { resolveCommit } from "./GitCmd.Revisions.js";
import { upstreamOf } from "./GitCmd.Status.js";
import { mergeInto } from "./GitCmd.Subs.js";
import { removeWorkFile, writeWorkFile } from "./GitCmd.WorkTree.js";
import { fatal, raise, type G } from "./GitCmd.js";

export function cmdMerge(g: G, args: string[]): number {
  const o = parseArgs(args, ["no-ff", "ff", "ff-only", "m|message=", "abort", "continue", "no-edit", "e|edit", "q|quiet", "squash"], "merge");
  const r = needRepo(g);
  needWork(r);
  const mergeHead = readText(g, gpath(r, "MERGE_HEAD"));
  if (o.has("abort")) {
    if (!mergeHead) throw fatal("There is no merge to abort (MERGE_HEAD missing).");
    const head = readHead(r);
    const idx = readIndex(r);
    const t = commitTree(r, head.hash);
    for (const p of union(idx.entries.keys, idx.unmerged.keys)) {
      if (!t.has(p)) removeWorkFile(r, p);
    }
    for (const p of t.keys) writeWorkFile(r, p, readBlob(r, t.get(p)!));
    writeIndex(r, { entries: t.copy(), unmerged: new JsMap<Unmerged>() });
    for (const f of ["MERGE_HEAD", "MERGE_MSG", "MERGE_MODE"]) removeFile(g, gpath(r, f));
    return 0;
  }
  if (o.has("continue")) {
    if (!mergeHead) throw fatal("There is no merge in progress (MERGE_HEAD missing).");
    return cmdCommit(g, []);
  }
  if (mergeHead) throw fatal("You have not concluded your merge (MERGE_HEAD exists).\nPlease, commit your changes before you merge.");
  if (o.has("squash")) {
    g.note("git.mergeSquashUnsupported");
    return 1;
  }
  let name = o.operands.length > 0 ? o.operands[0]! : null;
  const hd = readHead(r);
  if (!name) {
    const up = hd.branch ? upstreamOf(r, hd.branch) : null;
    if (up === null) throw fatal("No remote for the current branch.");
    name = up.name;
  }
  if (o.operands.length > 1) {
    g.note("git.octopusUnsupported");
    return 1;
  }
  if (name === "-") name = previousBranch(r) ?? raise(fatal("No previous branch."));
  const theirs = resolveCommit(r, name) ?? raise(fatal(`${name} - not something we can merge`));
  const msgs = o.getAll("message");
  return mergeInto(r, theirs, name, {
    noFf: o.has("no-ff") || getConfig(g, r, "merge.ff") === "false",
    ffOnly: o.has("ff-only") || getConfig(g, r, "merge.ff") === "only",
    message: msgs !== null ? msgs.join("\n\n") : null,
    reflogName: name,
  });
}
