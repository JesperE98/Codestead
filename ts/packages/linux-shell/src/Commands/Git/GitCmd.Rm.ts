// Port of Commands/Git/GitCmd.Rm.cs – git rm.

import { parseArgs } from "./GitCmd.Args.js";
import { needRepo, needWork } from "./GitCmd.Files.js";
import { readIndex, writeIndex } from "./GitCmd.Index.js";
import { sortedOrdinal, union } from "./GitCmd.Json.js";
import { commitTree } from "./GitCmd.Objects.js";
import { readHead } from "./GitCmd.Refs.js";
import { removeWorkFile, scanWork, show, specMatch, toSpec } from "./GitCmd.WorkTree.js";
import { fail, fatal, type G } from "./GitCmd.js";

export function cmdRm(g: G, args: string[]): number {
  const o = parseArgs(args, ["cached", "r", "f|force", "q|quiet", "n|dry-run"], "rm");
  const r = needRepo(g);
  needWork(r);
  const raw = [...o.operands, ...(o.paths ?? [])];
  if (raw.length === 0)
    throw fail(
      "usage: git rm [-f | --force] [-n] [-r] [--cached] [--ignore-unmatch]\n              [--quiet] [--pathspec-from-file=<file> [--pathspec-file-nul]]\n              [--] [<pathspec>...]",
      129,
    );
  const idx = readIndex(r);
  const head = commitTree(r, readHead(r).hash);
  const work = scanWork(r);
  const targets: string[] = [];
  for (const s of raw.map((x) => toSpec(r, x))) {
    const hits = idx.entries.keys.filter((p) => specMatch(s, p));
    if (hits.length === 0) throw fatal(`pathspec '${s.raw}' did not match any files`);
    if (!o.has("r") && hits.some((p) => p !== s.rel) && s.glob === null) throw fatal(`not removing '${s.raw}' recursively without -r`);
    targets.push(...hits);
  }
  if (!o.has("force")) {
    const staged = targets.filter((p) => idx.entries.get(p) !== head.get(p) && (work.get(p)?.hash ?? null) === idx.entries.get(p));
    const local = targets.filter((p) => work.files.has(p) && work.get(p)!.hash !== idx.entries.get(p));
    const both = local.filter((p) => idx.entries.get(p) !== head.get(p));
    if (both.length > 0 && !o.has("cached"))
      throw fail(
        `error: the following file${both.length > 1 ? "s have" : " has"} staged content different from both the\nfile and the HEAD:\n${both.map((p) => `    ${show(r, p)}\n`).join("")}(use -f to force removal)`,
      );
    if (!o.has("cached")) {
      if (staged.length > 0)
        throw fail(
          `error: the following file${staged.length > 1 ? "s have" : " has"} changes staged in the index:\n${staged.map((p) => `    ${show(r, p)}\n`).join("")}(use --cached to keep the file, or -f to force removal)`,
        );
      if (local.length > 0)
        throw fail(
          `error: the following file${local.length > 1 ? "s have" : " has"} local modifications:\n${local.map((p) => `    ${show(r, p)}\n`).join("")}(use --cached to keep the file, or -f to force removal)`,
        );
    }
  }
  for (const p of sortedOrdinal(union(targets))) {
    if (!o.has("quiet")) g.out(`rm '${p}'\n`);
    if (o.has("dry-run")) continue;
    idx.entries.delete(p);
    idx.unmerged.delete(p);
    if (!o.has("cached")) removeWorkFile(r, p);
  }
  if (!o.has("dry-run")) writeIndex(r, idx);
  return 0;
}
