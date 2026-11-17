// Port of Commands/Git/GitCmd.LsFiles.cs – git ls-files.

import { parseArgs } from "./GitCmd.Args.js";
import { needRepo, needWork, relPath } from "./GitCmd.Files.js";
import { readIndex } from "./GitCmd.Index.js";
import { sortedOrdinal, union } from "./GitCmd.Json.js";
import { scanWork, specMatch, toSpec } from "./GitCmd.WorkTree.js";
import type { G } from "./GitCmd.js";

export function cmdLsFiles(g: G, args: string[]): number {
  const o = parseArgs(args, ["s|stage", "o|others", "c|cached", "u|unmerged", "exclude-standard", "i|ignored", "d|deleted", "m|modified"], "ls-files");
  const r = needRepo(g);
  needWork(r);
  const idx = readIndex(r);
  const specs = o.operands.map((p) => toSpec(r, p));
  const pick = (p: string): boolean => specs.length === 0 || specs.some((s) => specMatch(s, p));
  const prefix = relPath(r.root!, g.cwd) === "." ? "" : relPath(r.root!, g.cwd) + "/";
  const inCwd = (p: string): boolean => p.startsWith(prefix);
  let list: string[];
  if (o.has("others") || o.has("ignored")) {
    const work = scanWork(r);
    list = [...work.files]
      .filter(([k, v]) => !idx.entries.has(k) && (o.has("ignored") ? v.ignored : !o.has("exclude-standard") || !v.ignored))
      .map(([k]) => k);
  } else if (o.has("deleted") || o.has("modified")) {
    const work = scanWork(r);
    list = idx.entries.keys.filter((p) => (o.has("deleted") && !work.files.has(p)) || (o.has("modified") && (work.get(p)?.hash ?? null) !== idx.entries.get(p)));
  } else list = union(idx.entries.keys, idx.unmerged.keys);
  for (const p of sortedOrdinal(list.filter(pick).filter(inCwd))) {
    const name = p.slice(prefix.length);
    if (o.has("stage")) {
      const u = idx.unmerged.get(p);
      if (u !== null) {
        for (const [v, n] of [
          [u.base, 1],
          [u.ours, 2],
          [u.theirs, 3],
        ] as const)
          if (v) g.out(`100644 ${v} ${n}\t${name}\n`);
      } else g.out(`100644 ${idx.entries.get(p)} 0\t${name}\n`);
    } else g.out(name + "\n");
  }
  return 0;
}
