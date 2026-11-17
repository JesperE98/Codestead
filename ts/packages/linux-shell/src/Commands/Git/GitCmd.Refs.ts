// Port of Commands/Git/GitCmd.Refs.cs – references: branches, HEAD and the reflog.

import { netTrim } from "../../Js.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import { identity, now, tzNow } from "./GitCmd.Config.js";
import { gpath, pruneDirs, readText, removeFile, writeText, type Repo } from "./GitCmd.Files.js";
import { jsKeyOrder, sortedOrdinal } from "./GitCmd.Json.js";
import { fmtIdent } from "./GitCmd.Objects.js";
import { GitExit, Zero, type G } from "./GitCmd.js";

export const hash40Re = /^[0-9a-f]{40}$/;

export function readRef(r: Repo, name: string, depth = 0): string | null {
  const text = readText(r.g, gpath(r, name));
  if (text === null) return null;
  const t = netTrim(text);
  if (t.startsWith("ref: ")) return depth > 5 ? null : readRef(r, t.slice(5), depth + 1);
  return hash40Re.test(t) ? t : null;
}

export function writeRef(r: Repo, name: string, h: string): void {
  writeText(r.g, gpath(r, name), h + "\n");
}

export function deleteRef(r: Repo, name: string): void {
  removeFile(r.g, gpath(r, name));
  pruneDirs(r.g, VfsLib.dirname(gpath(r, name)), gpath(r, "refs"));
}

/** The names of all references under e.g. "refs/heads/" (without the prefix), sorted. */
export function listRefs(r: Repo, prefix: string): string[] {
  const names: string[] = [];
  const walk = (node: FsNode, rel: string): void => {
    if (!node.children) return;
    for (const name of jsKeyOrder(node.children.keys())) {
      const child = node.children.get(name)!;
      const p = rel !== "" ? `${rel}/${name}` : name;
      if (child.type === "dir") walk(child, p);
      else names.push(p);
    }
  };
  const dir = r.g.sh.vfs.tryLookup(gpath(r, prefix.endsWith("/") ? prefix.slice(0, -1) : prefix), r.g.user);
  if (dir?.type === "dir") walk(dir, "");
  return sortedOrdinal(names);
}

export interface Head {
  /** The branch HEAD points at, or null if HEAD is detached. */
  branch: string | null;
  /** The commit HEAD points at (missing in an empty repository). */
  hash: string | null;
}

export function readHead(r: Repo): Head {
  const text = netTrim(readText(r.g, gpath(r, "HEAD")) ?? "");
  if (text.startsWith("ref: refs/heads/")) {
    const branch = text.slice("ref: refs/heads/".length);
    return { branch, hash: readRef(r, `refs/heads/${branch}`) };
  }
  return { branch: null, hash: hash40Re.test(text) ? text : null };
}

export function setHeadBranch(r: Repo, branch: string): void {
  writeText(r.g, gpath(r, "HEAD"), `ref: refs/heads/${branch}\n`);
}

export function setHeadDetached(r: Repo, h: string): void {
  writeText(r.g, gpath(r, "HEAD"), h + "\n");
}

/** Moves the branch HEAD points at (or HEAD itself if detached). */
export function moveHead(r: Repo, h: string, reflogMsg: string): void {
  const head = readHead(r);
  if (head.branch !== null && head.branch !== "") writeRef(r, `refs/heads/${head.branch}`, h);
  else setHeadDetached(r, h);
  reflog(r, head.hash, h, reflogMsg);
}

export function reflog(r: Repo, from: string | null, to: string, msg: string): void {
  const id = identity(r.g, r, false) ?? { name: r.g.user.name, email: `${r.g.user.name}@${r.g.sh.distro.hostname}`, time: now(), tz: tzNow() };
  const path = gpath(r, "logs/HEAD");
  const old = readText(r.g, path) ?? "";
  writeText(r.g, path, old + `${from ?? Zero} ${to} ${fmtIdent(id)}\t${msg}\n`);
}

export interface ReflogEntry {
  to: string;
  msg: string;
}

export function readReflog(r: Repo): ReflogEntry[] {
  return (readText(r.g, gpath(r, "logs/HEAD")) ?? "")
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => {
      const parts = l.split(" ");
      return { to: parts.length > 1 ? parts[1]! : "", msg: l.slice(l.indexOf("\t") + 1) };
    });
}

const checkoutMoveRe = /^checkout: moving from (\S+) to /;

/** The branch you were on before the latest switch (for `git switch -`). */
export function previousBranch(r: Repo): string | null {
  const log = readReflog(r);
  for (let i = log.length - 1; i >= 0; i--) {
    const m = checkoutMoveRe.exec(log[i]!.msg);
    if (m) return m[1]!;
  }
  return null;
}

// eslint-disable-next-line no-control-regex
const badRefRe = /\.\.|@\{|\/\/|\/\.|^\.|[\s~^:?*[\\\x00-\x1f\x7f]/;

export function validBranchName(name: string | null | undefined): boolean {
  return (
    name !== null &&
    name !== undefined &&
    name !== "" &&
    !name.startsWith("-") &&
    !name.startsWith("/") &&
    !name.endsWith("/") &&
    !name.endsWith(".") &&
    !name.endsWith(".lock") &&
    name !== "HEAD" &&
    name !== "@" &&
    !badRefRe.test(name)
  );
}

export function checkBranchName(g: G, name: string): void {
  if (validBranchName(name)) return;
  g.err(`fatal: '${name}' is not a valid branch name\n`);
  g.hint('See `man git check-ref-format`\nDisable this message with "git config set advice.refSyntax false"');
  throw new GitExit("", 128);
}

export function branchExists(r: Repo, b: string): boolean {
  return readRef(r, `refs/heads/${b}`) !== null;
}
