// Port of Commands/Git/GitCmd.LsTree.cs – git ls-tree.

import { parseArgs } from "./GitCmd.Args.js";
import { needRepo } from "./GitCmd.Files.js";
import { JsMap, sortedOrdinal } from "./GitCmd.Json.js";
import { writeTree } from "./GitCmd.Objects.js";
import { revTree } from "./GitCmd.Revisions.js";
import { fail, fatal, raise, type G } from "./GitCmd.js";

export function cmdLsTree(g: G, args: string[]): number {
  const o = parseArgs(args, ["r", "name-only", "l|long"], "ls-tree");
  const r = needRepo(g);
  const rev = o.operands.length > 0 ? o.operands[0]! : null;
  if (!rev) throw fail("usage: git ls-tree [<options>] <tree-ish> [<path>...]", 129);
  const t = revTree(r, rev) ?? raise(fatal("Not a valid object name " + rev));
  const rows = new Map<string, string>();
  for (const p of t.keys) {
    const h = t.get(p);
    if (o.has("r") || !p.includes("/")) rows.set(p, o.has("name-only") ? p : `100644 blob ${h}\t${p}`);
    else {
      const d = p.split("/")[0]!;
      if (!rows.has(d)) {
        const sub = new JsMap<string>();
        for (const q of t.keys) if (q.startsWith(d + "/")) sub.set(q.slice(d.length + 1), t.get(q)!);
        rows.set(d, o.has("name-only") ? d : `040000 tree ${writeTree(r, sub)}\t${d}`);
      }
    }
  }
  for (const k of sortedOrdinal(rows.keys())) g.out(rows.get(k) + "\n");
  return 0;
}
