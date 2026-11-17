// Port of Commands/Git/GitCmd.Checks.cs – helpers for the chapter checks: the state of a repository as seen by the
// tasks.

import { Js } from "../../Js.js";
import type { Shell } from "../../Shell/Shell.js";
import { CmdCtx } from "../../Types/CmdCtx.js";
import { IO } from "../../Types/IO.js";
import { normKey, parseConfig, splitKey } from "./GitCmd.Config.js";
import { join, looksLikeGitDir, openRepo, type Repo } from "./GitCmd.Files.js";
import { commitTree } from "./GitCmd.Objects.js";
import { listRefs, readHead, readRef } from "./GitCmd.Refs.js";
import { ancestors, isAncestor } from "./GitCmd.Revisions.js";
import { makeG } from "./GitCmd.js";
import type { RepoState } from "./RepoState.js";

/** Opens the repository in `dir` as root (for task checks and tests). */
function repoFor(sh: Shell, dir: string): Repo | null {
  const g = makeG(
    new CmdCtx(
      new IO(
        () => {},
        () => {},
      ),
      sh,
      "git",
      [],
    ),
  );
  g.user = sh.rootUser();
  return looksLikeGitDir(g, join(dir, ".git")) ? openRepo(g, join(dir, ".git"), dir) : null;
}

/** A summary of the repository in the directory `dir`, or null if there is no repository there. */
export function gitRepoState(sh: Shell, dir: string): RepoState | null {
  try {
    const r = repoFor(sh, dir);
    if (r === null) return null;
    const head = readHead(r);
    const branches = Js.obj<string>();
    for (const b of listRefs(r, "refs/heads/")) branches.set(b, readRef(r, `refs/heads/${b}`)!);
    return { branch: head.branch, head: head.hash, branches, files: commitTree(r, head.hash).keys, commits: ancestors(r, head.hash).size };
  } catch {
    return null;
  }
}

/** True if the commit `a` is in the history behind `b` (or is `b`). */
export function gitIsAncestor(sh: Shell, dir: string, a: string, b: string): boolean {
  try {
    const r = repoFor(sh, dir);
    return r !== null && isAncestor(r, a, b);
  } catch {
    return false;
  }
}

/** The value of a key in the global git configuration (~/.gitconfig) of the user with the home `home`. */
export function gitGlobalConfig(sh: Shell, home: string, key: string): string | null {
  const text = sh.vfs.tryLookup(`${home}/.gitconfig`, sh.rootUser())?.content ?? "";
  const k = splitKey(key);
  if (k === null) return null;
  return parseConfig(text).filter((e) => e.key === normKey(k)).at(-1)?.value ?? null;
}
