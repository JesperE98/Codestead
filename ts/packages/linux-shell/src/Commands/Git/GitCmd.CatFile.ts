// Port of Commands/Git/GitCmd.CatFile.cs – git cat-file.

import { Js } from "../../Js.js";
import { parseArgs } from "./GitCmd.Args.js";
import { needRepo } from "./GitCmd.Files.js";
import { readObj } from "./GitCmd.Objects.js";
import { resolveRev, revTree } from "./GitCmd.Revisions.js";
import { fail, fatal, type G } from "./GitCmd.js";

export function cmdCatFile(g: G, args: string[]): number {
  const o = parseArgs(args, ["p", "t", "s", "e"], "cat-file");
  const r = needRepo(g);
  const rev = o.operands.length > 0 ? o.operands[0]! : null;
  if (!rev) throw fail("usage: git cat-file <type> <object>\n   or: git cat-file (-e | -p) <object>\n   or: git cat-file (-t | -s) <object>", 129);
  let h: string | null;
  const colon = rev.indexOf(":");
  if (colon >= 0) {
    const revPart = rev.slice(0, colon);
    h = revTree(r, revPart !== "" ? revPart : "HEAD")?.get(rev.slice(colon + 1)) ?? null;
  } else h = resolveRev(r, rev);
  if (o.has("e")) return h && readObj(r, h) !== null ? 0 : 1;
  const obj = h ? readObj(r, h) : null;
  if (obj === null) throw fatal(`Not a valid object name ${rev}`);
  if (o.has("t")) g.out(obj.type + "\n");
  else if (o.has("s")) g.out(Js.utf8Length(obj.data) + "\n");
  else g.out(obj.data);
  return 0;
}
