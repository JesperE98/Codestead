// Port of Commands/Git/GitCmd.Add.cs – git add.

import { parseArgs } from "./GitCmd.Args.js";
import { isDirAt, join, needRepo, needWork } from "./GitCmd.Files.js";
import { readIndex, writeIndex } from "./GitCmd.Index.js";
import { sortedOrdinal, union } from "./GitCmd.Json.js";
import { writeObj } from "./GitCmd.Objects.js";
import { scanWork, show, specMatch, toSpec } from "./GitCmd.WorkTree.js";
import { fatal, type G } from "./GitCmd.js";

export function cmdAdd(g: G, args: string[]): number {
  const o = parseArgs(args, ["A|all", "u|update", "f|force", "v|verbose", "n|dry-run", "no-all"], "add");
  const r = needRepo(g);
  needWork(r);
  const specsRaw = [...o.operands, ...(o.paths ?? [])];
  if (specsRaw.length === 0) {
    if (!o.has("all") && !o.has("update")) {
      g.out("Nothing specified, nothing added.\n");
      g.hint("Maybe you wanted to say 'git add .'?\nDisable this message with \"git config set advice.addEmptyPathspec false\"");
      return 0;
    }
    specsRaw.push(r.root!);
  }
  const specs = specsRaw.map((s) => toSpec(r, s));
  const work = scanWork(r);
  const idx = readIndex(r);
  const candidates = sortedOrdinal(union(work.files.keys(), idx.entries.keys, idx.unmerged.keys));
  const ignoredHits: string[] = [];
  const log: string[] = [];
  for (const spec of specs) {
    let matched = false;
    let ignoredOnly = false;
    for (const p of candidates) {
      if (!specMatch(spec, p)) continue;
      const w = work.get(p);
      const tracked = idx.entries.has(p) || idx.unmerged.has(p);
      if (w !== null) {
        if (w.ignored && !tracked && !o.has("force")) {
          ignoredOnly = true;
          continue;
        }
        if (o.has("update") && !tracked) continue;
        matched = true;
        if (idx.entries.get(p) !== w.hash || idx.unmerged.has(p)) {
          if (!o.has("dry-run")) {
            writeObj(r, "blob", w.content);
            idx.entries.set(p, w.hash);
            idx.unmerged.delete(p);
          }
          log.push(`add '${show(r, p)}'`);
        }
      } else if (tracked) {
        matched = true;
        if (!o.has("dry-run")) {
          idx.entries.delete(p);
          idx.unmerged.delete(p);
        }
        log.push(`remove '${show(r, p)}'`);
      }
    }
    if (!matched) {
      if (ignoredOnly) ignoredHits.push(spec.raw);
      else if (!(spec.rel === "" || isDirAt(g, join(r.root!, spec.rel)))) throw fatal(`pathspec '${spec.raw}' did not match any files`);
    }
  }
  if (!o.has("dry-run")) writeIndex(r, idx);
  if (o.has("verbose") || o.has("dry-run")) g.out(log.map((l) => l + "\n").join(""));
  if (ignoredHits.length > 0) {
    g.err(`The following paths are ignored by one of your .gitignore files:\n${ignoredHits.join("\n")}\n`);
    g.hint('Use -f if you really want to add them.\nDisable this message with "git config set advice.addIgnoredFile false"');
    return 1;
  }
  return 0;
}
