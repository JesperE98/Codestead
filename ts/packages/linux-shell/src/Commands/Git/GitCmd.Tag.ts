// Port of Commands/Git/GitCmd.Tag.cs – git tag.

import { parseArgs } from "./GitCmd.Args.js";
import { identity } from "./GitCmd.Config.js";
import { needRepo } from "./GitCmd.Files.js";
import { fmtIdent, writeObj } from "./GitCmd.Objects.js";
import { deleteRef, listRefs, readRef, validBranchName, writeRef } from "./GitCmd.Refs.js";
import { needCommit } from "./GitCmd.Revisions.js";
import { cleanMessage } from "./GitCmd.Subs.js";
import { fail, fatal, short, type G } from "./GitCmd.js";

export function cmdTag(g: G, args: string[]): number {
  const o = parseArgs(args, ["a|annotate", "m|message=", "d|delete", "l|list", "f|force", "n"], "tag");
  const r = needRepo(g);
  if (o.has("delete")) {
    for (const t of o.operands) {
      const h = readRef(r, `refs/tags/${t}`);
      if (!h) throw fail(`error: tag '${t}' not found.`);
      deleteRef(r, `refs/tags/${t}`);
      g.out(`Deleted tag '${t}' (was ${short(h)})\n`);
    }
    return 0;
  }
  if (o.operands.length === 0 || o.has("list")) {
    for (const t of listRefs(r, "refs/tags/")) g.out(t + "\n");
    return 0;
  }
  const name = o.operands[0]!;
  const rev = o.operands.length > 1 ? o.operands[1]! : null;
  if (!validBranchName(name)) throw fatal(`'${name}' is not a valid tag name.`);
  if (readRef(r, `refs/tags/${name}`) && !o.has("force")) throw fatal(`tag '${name}' already exists`);
  const target = needCommit(r, rev ?? "HEAD");
  if (o.has("annotate") || o.has("message")) {
    const msgs = o.getAll("message");
    const msg = msgs !== null ? msgs.join("\n\n") : null;
    if (!msg) {
      g.note("git.tagNoEditor");
      return 1;
    }
    const id = identity(g, r)!;
    const h = writeObj(r, "tag", `object ${target}\ntype commit\ntag ${name}\ntagger ${fmtIdent(id)}\n\n${cleanMessage(msg)}`);
    writeRef(r, `refs/tags/${name}`, h);
  } else writeRef(r, `refs/tags/${name}`, target);
  return 0;
}
