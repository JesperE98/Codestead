// Port of Commands/Git/GitCmd.Clone.cs – git clone.

import type { CmdCtx } from "../../Types/CmdCtx.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as ReposCmd from "../Repos/ReposCmd.js";
import { parseArgs } from "./GitCmd.Args.js";
import { setConfig } from "./GitCmd.Config.js";
import { existsAt, gpath, openRepo } from "./GitCmd.Files.js";
import { newIndex, writeIndex } from "./GitCmd.Index.js";
import { commitTree, readBlob } from "./GitCmd.Objects.js";
import { listRefs, readHead, readRef, reflog, writeRef } from "./GitCmd.Refs.js";
import { NotARepoTail, copyObjects, expandTilde, fetchRemote, isNetworkUrl, networkError, openRemote } from "./GitCmd.Remote.js";
import { initRepo } from "./GitCmd.Subs.js";
import { writeWorkFile } from "./GitCmd.WorkTree.js";
import { fail, fatal, type G } from "./GitCmd.js";


const trailingSlashesRe = /\/+$/;
const slashDotGitRe = /\/\.git$/;
const dotGitRe = /\.git$/;
const slashColonRe = /[/:]/;

export function cmdClone(g: G, args: string[]): number {
  // Packages from AUR (git clone https://aur.archlinux.org/PACKAGE.git) – see ReposCmd.
  const aur = ReposCmd.aurClone(g.ctx, args);
  if (aur !== null) return aur;
  const o = parseArgs(args, ["q|quiet", "bare", "b|branch=", "o|origin=", "depth="], "clone");
  const url = o.operands.length > 0 ? o.operands[0]! : null;
  const dirArg = o.operands.length > 1 ? o.operands[1]! : null;
  if (!url) throw fail("fatal: You must specify a repository to clone.\n\nusage: git clone [<options>] [--] <repo> [<dir>]", 129);
  const name = dirArg ?? url.replace(trailingSlashesRe, "").replace(slashDotGitRe, "").split(slashColonRe).at(-1)!.replace(dotGitRe, "") + (o.has("bare") ? ".git" : "");
  const dest = VfsLib.resolvePath(g.cwd, expandTilde(g, name));
  const destNode = g.sh.vfs.tryLookup(dest, g.user);
  if (destNode !== null && (destNode.type !== "dir" || (destNode.children?.size ?? 0) > 0)) throw fatal(`destination path '${dirArg ?? name}' already exists and is not an empty directory.`);
  if (!o.has("quiet")) g.err(`Cloning into ${o.has("bare") ? "bare repository " : ""}'${dirArg ?? name}'...\n`);
  if (isNetworkUrl(url)) return networkError(g, url, "clone");
  const src = openRemote(g, url);
  if (src === null) {
    if (!existsAt(g, VfsLib.resolvePath(g.cwd, expandTilde(g, url)))) throw fatal(`repository '${url}' does not exist`);
    g.err(`fatal: '${url}' does not appear to be a git repository\n${NotARepoTail}`);
    return 128;
  }
  const srcHead = readHead(src);
  const branch = o.get("branch") ?? srcHead.branch ?? "main";
  if (o.get("branch") && !readRef(src, `refs/heads/${branch}`)) throw fatal(`Remote branch ${branch} not found in upstream origin`);
  const { gitDir } = initRepo(g, dest, o.has("bare"), branch);
  const r = openRepo(g, gitDir, o.has("bare") ? null : dest);
  const remote = o.get("origin") ?? "origin";
  const abs = src.root ?? src.gitDir;
  copyObjects(src, r);
  if (o.has("bare")) {
    for (const b of listRefs(src, "refs/heads/")) writeRef(r, `refs/heads/${b}`, readRef(src, `refs/heads/${b}`)!);
    for (const t of listRefs(src, "refs/tags/")) writeRef(r, `refs/tags/${t}`, readRef(src, `refs/tags/${t}`)!);
    if (!o.has("quiet")) g.err("done.\n");
    return 0;
  }
  const cfg = gpath(r, "config");
  setConfig(g, cfg, `remote.${remote}.url`, abs);
  setConfig(g, cfg, `remote.${remote}.fetch`, `+refs/heads/*:refs/remotes/${remote}/*`);
  fetchRemote(r, remote, true);
  for (const t of listRefs(src, "refs/tags/")) writeRef(r, `refs/tags/${t}`, readRef(src, `refs/tags/${t}`)!);
  const h = readRef(src, `refs/heads/${branch}`);
  if (h) {
    writeRef(r, `refs/heads/${branch}`, h);
    setConfig(g, cfg, `branch.${branch}.remote`, remote);
    setConfig(g, cfg, `branch.${branch}.merge`, `refs/heads/${branch}`);
    const tree = commitTree(r, h);
    for (const p of tree.keys) writeWorkFile(r, p, readBlob(r, tree.get(p)!));
    writeIndex(r, newIndex(tree.copy()));
    reflog(r, null, h, `clone: from ${abs}`);
    if (!o.has("quiet")) g.err("done.\n");
  } else g.err("warning: You appear to have cloned an empty repository.\n");
  return 0;
}

