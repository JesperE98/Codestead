// Port of Commands/Git/GitCmd.Show.cs – git show.

import { parseArgs } from "./GitCmd.Args.js";
import { fmtDate } from "./GitCmd.Config.js";
import { printPatch, treeChanges } from "./GitCmd.Diff.js";
import { needRepo } from "./GitCmd.Files.js";
import { union } from "./GitCmd.Json.js";
import { commitTree, parseIdent, peel, readBlob, readCommit, readObj, readTree, subject } from "./GitCmd.Objects.js";
import { readHead } from "./GitCmd.Refs.js";
import { resolveRev, revTree } from "./GitCmd.Revisions.js";
import { commitHeader, decorate, decorations } from "./GitCmd.Subs.js";
import { toSpec } from "./GitCmd.WorkTree.js";
import { Col, fail, fatal, raise, short, type G } from "./GitCmd.js";

const tagBodyRe = /\ntag ([^\n]*)\ntagger ([^\n]*)\n\n([\s\S]*)$/;

export function cmdShow(g: G, args: string[]): number {
  const o = parseArgs(args, ["stat", "name-only", "name-status", "oneline", "s|no-patch", "pretty=", "format="], "show");
  const r = needRepo(g);
  const targets = o.operands.length > 0 ? o.operands : ["HEAD"];
  const deco = g.tty ? decorations(r) : null;
  for (let n = 0; n < targets.length; n++) {
    const rev = targets[n]!;
    if (n !== 0) g.out("\n");
    const colon = rev.indexOf(":");
    if (colon >= 0) {
      const revPart = rev.slice(0, colon);
      const t = revTree(r, revPart !== "" ? revPart : "HEAD") ?? raise(fatal(`invalid object name '${revPart}'.`));
      let p = rev.slice(colon + 1);
      if (p.startsWith("./") && r.root !== null) p = toSpec(r, p).rel;
      const hh = t.get(p);
      if (!hh) {
        const dir = t.keys.filter((x) => x.startsWith(p !== "" ? p + "/" : ""));
        if (dir.length === 0) throw fatal(`path '${p}' does not exist in '${revPart !== "" ? revPart : "HEAD"}'`);
        const names = union(
          dir.map((x) => {
            const rest = x.slice(p !== "" ? p.length + 1 : 0);
            return rest.split("/")[0]! + (rest.includes("/") ? "/" : "");
          }),
        );
        g.out(`tree ${rev}\n\n${names.join("\n")}\n`);
        continue;
      }
      g.out(readBlob(r, hh));
      continue;
    }
    const h = resolveRev(r, rev);
    if (h === null) {
      if (rev === "HEAD") throw fatal(`your current branch '${readHead(r).branch}' does not have any commits yet`);
      throw fail(`fatal: ambiguous argument '${rev}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`, 128);
    }
    const obj = readObj(r, h)!;
    if (obj.type === "blob") {
      g.out(obj.data);
      continue;
    }
    if (obj.type === "tree") {
      g.out(`tree ${rev}\n\n${readTree(r, h).keys.join("\n")}\n`);
      continue;
    }
    let ch = h;
    if (obj.type === "tag") {
      const tag = tagBodyRe.exec(obj.data);
      if (tag) {
        const t = parseIdent(tag[2]!);
        g.out(`${g.c(Col.yellow, `tag ${tag[1]}`)}\nTagger: ${t.name} <${t.email}>\nDate:   ${fmtDate(t)}\n\n${tag[3]}\n`);
      }
      ch = peel(r, h);
    }
    const c = readCommit(r, ch);
    if (o.has("oneline")) g.out(`${g.c(Col.yellow, short(c.hash))}${decorate(g, deco, c.hash)} ${subject(c)}\n`);
    else g.out(commitHeader(r, c, deco).join("\n") + "\n");
    if (o.has("no-patch") || c.parents.length > 1) continue;
    const changes = treeChanges(commitTree(r, c.parents.length > 0 ? c.parents[0] : null), readTree(r, c.tree));
    if (changes.length > 0 && !o.has("oneline")) g.out("\n");
    printPatch(r, changes, o.has("stat") ? "stat" : o.has("name-only") ? "name-only" : o.has("name-status") ? "name-status" : "patch");
  }
  return 0;
}
