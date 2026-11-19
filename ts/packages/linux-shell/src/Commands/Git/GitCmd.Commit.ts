// Port of Commands/Git/GitCmd.Commit.cs – git commit.

import { netTrim } from "../../Js.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import { parseArgs } from "./GitCmd.Args.js";
import { fmtDate, identity } from "./GitCmd.Config.js";
import { statText, treeChanges } from "./GitCmd.Diff.js";
import { gpath, needRepo, needWork, readText, removeFile } from "./GitCmd.Files.js";
import { readIndex, writeIndex } from "./GitCmd.Index.js";
import { JsMap } from "./GitCmd.Json.js";
import { newCommit, readCommit, readTree, subject, writeCommit, writeObj, writeTree } from "./GitCmd.Objects.js";
import { moveHead, readHead } from "./GitCmd.Refs.js";
import { computeStatus, printLongStatus } from "./GitCmd.Status.js";
import { cleanMessage } from "./GitCmd.Subs.js";
import { scanWork, specMatch, toSpec, type Spec } from "./GitCmd.WorkTree.js";
import { fail, fatal, raise, short, type G } from "./GitCmd.js";

export function cmdCommit(g: G, args: string[]): number {
  const o = parseArgs(args, ["m|message=", "a|all", "amend", "allow-empty", "q|quiet", "no-edit", "v|verbose", "F|file=", "e|edit"], "commit");
  const r = needRepo(g);
  needWork(r);
  const id = identity(g, r)!;
  const head = readHead(r);
  const idx = readIndex(r);
  const mergeHeadText = readText(g, gpath(r, "MERGE_HEAD"));
  const mergeHead = mergeHeadText !== null ? netTrim(mergeHeadText) : null;
  if (idx.unmerged.count > 0) {
    throw fail(
      "error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.",
      128,
    );
  }
  if (o.has("amend") && !head.hash) throw fatal("You have nothing to amend.");
  if (o.has("amend") && mergeHead) throw fatal("You are in the middle of a merge -- cannot amend.");
  const paths = [...o.operands, ...(o.paths ?? [])];
  if (o.has("all") || paths.length > 0) {
    if (o.has("all") && paths.length > 0) throw fatal("paths with -a does not make sense.");
    if (mergeHead && paths.length > 0) throw fatal("cannot do a partial commit during a merge.");
    const work = scanWork(r);
    const specs = paths.map((p) => toSpec(r, p));
    const used = new Set<Spec>();
    for (const p of idx.entries.keys) {
      const hit = specs.filter((s) => specMatch(s, p));
      if (specs.length > 0 && hit.length === 0) continue;
      for (const s of hit) used.add(s);
      const w = work.get(p);
      if (w !== null) {
        writeObj(r, "blob", w.content);
        idx.entries.set(p, w.hash);
      } else idx.entries.delete(p);
    }
    for (const s of specs) if (!used.has(s)) throw fail(`error: pathspec '${s.raw}' did not match any file(s) known to git`);
  }
  let message: string;
  const ms = o.getAll("message");
  if (ms !== null) message = ms.join("\n\n");
  else if (o.get("file") !== null) {
    const f = o.get("file")!;
    message = f === "-" ? (g.ctx.stdin ?? "") : (readText(g, VfsLib.resolvePath(g.cwd, f)) ?? raise(fatal(`could not read log file '${f}': No such file or directory`)));
  } else if (o.has("amend")) message = readCommit(r, head.hash!).message;
  else if (mergeHead) {
    message = readText(g, gpath(r, "MERGE_MSG")) ?? `Merge commit '${mergeHead}'\n`;
    g.note("git.mergeMsgUsed");
  } else {
    g.note("git.commitNoEditor");
    g.err("Aborting commit due to empty commit message.\n");
    return 1;
  }
  message = cleanMessage(message);
  if (message === "") {
    g.err("Aborting commit due to empty commit message.\n");
    return 1;
  }
  const parents = o.has("amend") ? [...readCommit(r, head.hash!).parents] : head.hash ? [head.hash] : [];
  if (mergeHead) parents.push(mergeHead);
  const tree = writeTree(r, idx.entries);
  const parentTree = parents.length > 0 && parents[0] !== "" ? readCommit(r, parents[0]!).tree : writeTree(r, new JsMap<string>());
  if (tree === (head.hash ? readCommit(r, head.hash).tree : "") && !o.has("allow-empty") && !mergeHead && !o.has("amend")) {
    writeIndex(r, idx);
    printLongStatus(r, computeStatus(r));
    return 1;
  }
  if (!head.hash && idx.entries.count === 0 && !o.has("allow-empty")) {
    printLongStatus(r, computeStatus(r));
    return 1;
  }
  writeIndex(r, idx);
  const author = o.has("amend") ? readCommit(r, head.hash!).author : id;
  const h = writeCommit(r, newCommit(tree, parents, author, id, message));
  const kind = o.has("amend") ? " (amend)" : mergeHead ? " (merge)" : parents.length === 0 ? " (initial)" : "";
  moveHead(r, h, `commit${kind}: ${subject(message)}`);
  removeFile(g, gpath(r, "MERGE_HEAD"));
  removeFile(g, gpath(r, "MERGE_MSG"));
  removeFile(g, gpath(r, "MERGE_MODE"));
  if (o.has("quiet")) return 0;
  const where = head.branch ?? "detached HEAD";
  let res = `[${where}${parents.length > 0 ? "" : " (root-commit)"} ${short(h)}] ${message.split("\n")[0]}\n`;
  if (o.has("amend")) res += ` Date: ${fmtDate(author)}\n`;
  res += statText(r, treeChanges(readTree(r, parentTree), idx.entries), true);
  g.out(res);
  return 0;
}
