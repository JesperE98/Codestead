// Port of Commands/Git/GitCmd.Reflog.cs – git reflog.

import { needRepo } from "./GitCmd.Files.js";
import { readHead, readReflog } from "./GitCmd.Refs.js";
import { decorate, decorations } from "./GitCmd.Subs.js";
import { Col, fatal, short, type G } from "./GitCmd.js";

export function cmdReflog(g: G, args: string[]): number {
  const r = needRepo(g);
  const sub = args.length > 0 ? args[0]! : null;
  if (sub && sub !== "show") {
    g.note("git.reflogShowOnly");
    return 1;
  }
  const log = readReflog(r).reverse();
  if (log.length === 0) {
    const head = readHead(r);
    if (!head.hash) throw fatal(`your current branch '${head.branch}' does not have any commits yet`);
  }
  const deco = g.tty ? decorations(r) : null;
  for (let i = 0; i < log.length; i++) {
    const e = log[i]!;
    g.out(`${g.c(Col.yellow, short(e.to))}${i === 0 ? decorate(g, deco, e.to) : ""} HEAD@{${i}}: ${e.msg}\n`);
  }
  return 0;
}
