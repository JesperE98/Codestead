// Port of Commands/Git/GitCmd.Pull.cs – git pull.

import { parseArgs } from "./GitCmd.Args.js";
import { gpath, needRepo, needWork, readText } from "./GitCmd.Files.js";
import { readHead, readRef } from "./GitCmd.Refs.js";
import { fetchRemote, remoteUrl } from "./GitCmd.Remote.js";
import { upstreamOf } from "./GitCmd.Status.js";
import { mergeInto } from "./GitCmd.Subs.js";
import { fail, fatal, type G } from "./GitCmd.js";

export function cmdPull(g: G, args: string[]): number {
  const o = parseArgs(args, ["ff-only", "no-ff", "rebase", "no-rebase", "q|quiet"], "pull");
  const r = needRepo(g);
  needWork(r);
  const head = readHead(r);
  if (o.has("rebase")) {
    g.note("git.pullRebaseUnsupported");
    return 1;
  }
  const up = head.branch ? upstreamOf(r, head.branch) : null;
  const remote = (o.operands.length > 0 ? o.operands[0]! : null) ?? up?.remote ?? null;
  if (!remote) {
    throw fail(
      `There is no tracking information for the current branch.\nPlease specify which branch you want to merge with.\nSee git-pull(1) for details.\n\n    git pull <remote> <branch>\n\nIf you wish to set tracking information for this branch you can do so with:\n\n    git branch --set-upstream-to=origin/<branch> ${head.branch ?? ""}`,
      1,
    );
  }
  const code = fetchRemote(r, remote);
  if (code !== 0) return code;
  const branch = (o.operands.length > 1 ? o.operands[1]! : null) ?? (up !== null && up.remote === remote ? up.ref.slice(`refs/remotes/${remote}/`.length) : head.branch);
  const ref = `refs/remotes/${remote}/${branch ?? ""}`;
  const theirs = readRef(r, ref) ?? (remoteUrl(r, remote) ? null : (readText(g, gpath(r, "FETCH_HEAD"))?.split("\t")[0] ?? null));
  if (!theirs) throw fatal(`couldn't find remote ref ${branch ?? ""}`);
  return mergeInto(r, theirs, `${remote}/${branch ?? ""}`, { ffOnly: o.has("ff-only"), noFf: o.has("no-ff"), reflogName: `${remote}/${branch ?? ""}` });
}
