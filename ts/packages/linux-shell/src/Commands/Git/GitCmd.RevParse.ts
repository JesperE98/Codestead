// Port of Commands/Git/GitCmd.RevParse.cs – git rev-parse.

import { Js } from "../../Js.js";
import { discover } from "./GitCmd.Files.js";
import { readHead } from "./GitCmd.Refs.js";
import { resolveRev } from "./GitCmd.Revisions.js";
import { sliceEnd } from "./GitCmd.Subs.js";
import { fail, fatal, raise, type G } from "./GitCmd.js";

export function cmdRevParse(g: G, args: string[]): number {
  const r = discover(g, g.cwd);
  let shortLen = 0;
  let abbrev = false;
  for (const a of args) {
    if (a === "--is-inside-work-tree") {
      g.out(r !== null && r.root !== null ? "true\n" : r !== null ? "false\n" : "");
      if (r === null) throw fatal("not a git repository (or any of the parent directories): .git");
      continue;
    }
    if (r === null) throw fatal("not a git repository (or any of the parent directories): .git");
    const repo = r;
    if (a === "--show-toplevel") g.out((repo.root ?? raise(fatal("this operation must be run in a work tree"))) + "\n");
    else if (a === "--git-dir") g.out((repo.root !== null && repo.root === g.cwd ? ".git" : repo.gitDir) + "\n");
    else if (a === "--is-bare-repository") g.out(repo.root !== null ? "false\n" : "true\n");
    else if (a.startsWith("--short")) {
      const parts = a.split("=");
      shortLen = parts.length > 1 ? Js.number(parts[1]) : 7;
    } else if (a === "--abbrev-ref") abbrev = true;
    else if (a.startsWith("-")) continue;
    else {
      if (abbrev && (a === "HEAD" || a === "@")) {
        const head = readHead(repo);
        g.out((head.branch ?? "HEAD") + "\n");
        continue;
      }
      const h = resolveRev(repo, a);
      if (h === null)
        throw fail(
          `${a}\nfatal: ambiguous argument '${a}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`,
          128,
        );
      g.out((shortLen !== 0 && !Number.isNaN(shortLen) ? h.slice(0, sliceEnd(shortLen)) : h) + "\n");
    }
  }
  return 0;
}
