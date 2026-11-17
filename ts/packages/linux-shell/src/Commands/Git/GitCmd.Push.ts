// Port of Commands/Git/GitCmd.Push.cs – git push.

import { parseArgs } from "./GitCmd.Args.js";
import { configAll, setConfig } from "./GitCmd.Config.js";
import { gpath, needRepo } from "./GitCmd.Files.js";
import { readObj } from "./GitCmd.Objects.js";
import { branchExists, deleteRef, listRefs, readHead, readRef, writeRef } from "./GitCmd.Refs.js";
import { NotARepoTail, copyObjects, isNetworkUrl, networkError, openRemote, remoteNameOfKey, remoteUrl, remoteUrlKeyRe } from "./GitCmd.Remote.js";
import { isAncestor, resolveCommit } from "./GitCmd.Revisions.js";
import { upstreamOf } from "./GitCmd.Status.js";
import { fail, fatal, short, type G } from "./GitCmd.js";

const refsHeadsRe = /^refs\/heads\//;

export function cmdPush(g: G, args: string[]): number {
  const o = parseArgs(args, ["u|set-upstream", "f|force", "all", "d|delete", "q|quiet", "tags"], "push");
  const r = needRepo(g);
  const head = readHead(r);
  const up = head.branch ? upstreamOf(r, head.branch) : null;
  const remotes = configAll(g, r).filter((e) => e.scope === "local" && remoteUrlKeyRe.test(e.key));
  const remote = (o.operands.length > 0 ? o.operands[0]! : null) ?? up?.remote ?? (remotes.length === 1 ? remoteNameOfKey(remotes[0]!.key) : null);
  if (!remote) {
    throw fail(
      "fatal: No configured push destination.\nEither specify the URL from the command-line or configure a remote repository using\n\n    git remote add <name> <url>\n\nand then push using the remote name\n\n    git push <name>\n",
      128,
    );
  }
  let specs = o.operands.slice(1);
  if (specs.length === 0) {
    if (o.has("all")) specs = listRefs(r, "refs/heads/");
    else if (!head.branch)
      throw fatal(
        "You are not currently on a branch.\nTo push the history leading to the current (detached HEAD)\nstate now, use\n\n    git push " + remote + " HEAD:<name-of-remote-branch>\n",
      );
    else if (up === null && !o.has("set-upstream"))
      throw fail(
        `fatal: The current branch ${head.branch} has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream ${remote} ${head.branch}\n`,
        128,
      );
    else specs = [up !== null && !o.has("set-upstream") ? `${head.branch}:${up.ref.slice(`refs/remotes/${up.remote}/`.length)}` : head.branch];
  }
  const url = remoteUrl(r, remote) ?? remote;
  if (isNetworkUrl(url)) return networkError(g, url, "push");
  const dst = openRemote(g, url);
  if (dst === null) {
    g.err(`fatal: '${url}' does not appear to be a git repository\n${NotARepoTail}`);
    return 128;
  }
  const dstHead = readHead(dst);
  const lines: string[] = [];
  let failed = false;
  let rejectedFf = false;
  copyObjects(r, dst);
  for (const spec of specs) {
    let srcName: string;
    let dstName0: string;
    if (spec.includes(":")) {
      const parts = spec.split(":");
      srcName = parts[0]!;
      dstName0 = parts[1]!;
    } else srcName = dstName0 = spec;
    const dstName = (dstName0 !== "" ? dstName0 : srcName).replace(refsHeadsRe, "");
    if (o.has("delete")) {
      const oldRef = readRef(dst, `refs/heads/${dstName}`);
      if (!oldRef) {
        g.err(`error: unable to delete '${dstName}': remote ref does not exist\n`);
        failed = true;
        continue;
      }
      deleteRef(dst, `refs/heads/${dstName}`);
      deleteRef(r, `refs/remotes/${remote}/${dstName}`);
      lines.push(` - [deleted]         ${dstName}`);
      continue;
    }
    const h = resolveCommit(r, srcName);
    if (h === null) {
      g.err(`error: src refspec ${srcName} does not match any\n`);
      failed = true;
      continue;
    }
    const old = readRef(dst, `refs/heads/${dstName}`);
    const label = `${srcName} -> ${dstName}`;
    if (old === h) {
      lines.push(` = [up to date]      ${label}`);
      continue;
    }
    if (dst.root !== null && dstHead.branch === dstName) {
      g.err(
        `remote: error: refusing to update checked out branch: refs/heads/${dstName}\nremote: error: By default, updating the current branch in a non-bare repository\nremote: is denied, because it will make the index and work tree inconsistent\nremote: with what you pushed, and will require 'git reset --hard' to match\nremote: the work tree to HEAD.\n`,
      );
      lines.push(` ! [remote rejected] ${label} (branch is currently checked out)`);
      failed = true;
      continue;
    }
    if (old && !isAncestor(r, old, h) && !o.has("force")) {
      lines.push(` ! [rejected]        ${label} (${readObj(r, old) !== null ? "non-fast-forward" : "fetch first"})`);
      failed = true;
      rejectedFf = true;
      continue;
    }
    writeRef(dst, `refs/heads/${dstName}`, h);
    if (remoteUrl(r, remote)) writeRef(r, `refs/remotes/${remote}/${dstName}`, h);
    if (!old) lines.push(` * [new branch]      ${label}`);
    else if (isAncestor(r, old, h)) lines.push(`   ${short(old)}..${short(h)}  ${label}`);
    else lines.push(` + ${short(old)}...${short(h)} ${label} (forced update)`);
    if (o.has("set-upstream") && remoteUrl(r, remote)) {
      const local = srcName === "HEAD" ? head.branch : srcName;
      if (local && branchExists(r, local)) {
        setConfig(g, gpath(r, "config"), `branch.${local}.remote`, remote);
        setConfig(g, gpath(r, "config"), `branch.${local}.merge`, `refs/heads/${dstName}`);
        lines.push(`branch '${local}' set up to track '${remote}/${dstName}'.`);
      }
    }
  }
  if (lines.length > 0 && !o.has("quiet")) {
    const upToDate = lines.every((l) => l.includes("[up to date]"));
    g.err(upToDate ? "Everything up-to-date\n" : `To ${dst.root ?? dst.gitDir}\n${lines.filter((l) => !l.includes("[up to date]")).join("\n")}\n`);
  }
  if (failed) {
    g.err(`error: failed to push some refs to '${dst.root ?? dst.gitDir}'\n`);
    if (rejectedFf)
      g.hint(
        "Updates were rejected because the tip of your current branch is behind\nits remote counterpart. If you want to integrate the remote changes,\nuse 'git pull' before pushing again.\nSee the 'Note about fast-forwards' in 'git push --help' for details.",
      );
    return 1;
  }
  return 0;
}
