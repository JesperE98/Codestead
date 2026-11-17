// Port of Commands/Git/GitCmd.Subs.cs – helpers shared by several of the local subcommands (init, commit, log,
// restore, switch, merge).

import * as VfsLib from "../../Vfs/VfsLib.js";
import type { Parsed } from "./GitCmd.Args.js";
import { configBool, fmtDate, getConfig, identity, setConfig } from "./GitCmd.Config.js";
import { merge3, statText, treeChanges } from "./GitCmd.Diff.js";
import { existsAt, gpath, join, looksLikeGitDir, mkdirp, writeText, type Repo } from "./GitCmd.Files.js";
import { readIndex, writeIndex, type Unmerged } from "./GitCmd.Index.js";
import { JsMap, sortedOrdinal, union } from "./GitCmd.Json.js";
import { commitTree, newCommit, peel, readBlob, readCommit, subject, writeCommit, writeObj, writeTree, type Commit } from "./GitCmd.Objects.js";
import { listRefs, moveHead, readHead, readRef, reflog, setHeadBranch, setHeadDetached, writeRef } from "./GitCmd.Refs.js";
import { isAncestor, mergeBase, needCommit, resolveRev, revTree } from "./GitCmd.Revisions.js";
import { computeStatus, trackingText } from "./GitCmd.Status.js";
import { scanWork, show, specMatch, switchTree, toSpec, removeWorkFile, writeWorkFile } from "./GitCmd.WorkTree.js";
import { Col, fail, fatal, raise, short, type G } from "./GitCmd.js";

const Exclude =
  "# git ls-files --others --exclude-from=.git/info/exclude\n" +
  "# Lines that start with '#' are comments.\n" +
  "# For a project mostly in C, the following would be a good set of\n" +
  "# exclude patterns (uncomment them if you want to use them):\n" +
  "# *.[oa]\n" +
  "# *~\n";

/** Creates a new repository. existed is true if it was already there. */
export function initRepo(g: G, dir: string, bare: boolean, branch: string): { gitDir: string; existed: boolean } {
  const gitDir = bare ? dir : join(dir, ".git");
  mkdirp(g, dir);
  if (looksLikeGitDir(g, gitDir)) return { gitDir, existed: true };
  mkdirp(g, gitDir);
  for (const d of ["objects/info", "objects/pack", "refs/heads", "refs/tags", "hooks", "info"]) mkdirp(g, `${gitDir}/${d}`);
  writeText(g, `${gitDir}/HEAD`, `ref: refs/heads/${branch}\n`);
  writeText(
    g,
    `${gitDir}/config`,
    `[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = ${bare ? "true" : "false"}\n${bare ? "" : "\tlogallrefupdates = true\n"}`,
  );
  writeText(g, `${gitDir}/description`, "Unnamed repository; edit this file 'description' to name the repository.\n");
  writeText(g, `${gitDir}/info/exclude`, Exclude);
  return { gitDir, existed: false };
}

// commit

export const trailingWsAnyRe = /\s+$/;

export function cleanMessage(msg: string): string {
  const lines = msg
    .split("\n")
    .filter((l) => !l.startsWith("#"))
    .map((l) => l.replace(trailingWsAnyRe, ""));
  while (lines.length > 0 && lines[0] === "") lines.shift();
  while (lines.length > 0 && lines.at(-1) === "") lines.pop();
  const res: string[] = [];
  for (const l of lines) if (!(l === "" && res.length > 0 && res.at(-1) === "")) res.push(l);
  return res.length > 0 ? res.join("\n") + "\n" : "";
}

// log

export interface Deco {
  text: string;
  color: string;
}

export function decorations(r: Repo): Map<string, Deco[]> {
  const map = new Map<string, Deco[]>();
  const add = (h: string | null, text: string, color: string): void => {
    if (h === null || h === "") return;
    let list = map.get(h);
    if (list === undefined) map.set(h, (list = []));
    list.push({ text, color });
  };
  const head = readHead(r);
  if (head.branch) add(head.hash, `HEAD -> ${head.branch}`, "head");
  else add(head.hash, "HEAD", Col.boldCyan);
  for (const b of listRefs(r, "refs/heads/")) if (b !== head.branch) add(readRef(r, `refs/heads/${b}`), b, Col.boldGreen);
  for (const b of listRefs(r, "refs/remotes/")) add(readRef(r, `refs/remotes/${b}`), b, Col.boldRed);
  for (const t of listRefs(r, "refs/tags/")) {
    const h = readRef(r, `refs/tags/${t}`);
    add(h ? peel(r, h) : null, `tag: ${t}`, Col.boldYellow);
  }
  return map;
}

export function decorate(g: G, map: Map<string, Deco[]> | null, h: string): string {
  const list = map?.get(h);
  if (list === undefined || list.length === 0) return "";
  const parts = list.map((d) => {
    if (d.color === "head") {
      const segs = d.text.split(" -> ");
      const b = segs.length > 1 ? segs[1]! : "";
      return `${g.c(Col.boldCyan, "HEAD")}${g.c(Col.yellow, " -> ")}${g.c(Col.boldGreen, b)}`;
    }
    return g.c(d.color, d.text);
  });
  return ` ${g.c(Col.yellow, "(")}${parts.join(g.c(Col.yellow, ", "))}${g.c(Col.yellow, ")")}`;
}

export function commitHeader(r: Repo, c: Commit, deco: Map<string, Deco[]> | null): string[] {
  const g = r.g;
  const lines = [`${g.c(Col.yellow, `commit ${c.hash}`)}${decorate(g, deco, c.hash)}`];
  if (c.parents.length > 1) lines.push(`Merge: ${c.parents.map(short).join(" ")}`);
  lines.push(`Author: ${c.author.name} <${c.author.email}>`);
  lines.push(`Date:   ${fmtDate(c.author)}`);
  lines.push("");
  const msg = c.message.endsWith("\n") ? c.message.slice(0, -1) : c.message;
  for (const l of msg.split("\n")) lines.push(l !== "" ? `    ${l}` : "");
  return lines;
}

export const rangeSepRe = /\.{2,3}/;

/** Splits the arguments into revisions and paths, like real git. */
export function revsAndPaths(r: Repo, o: Parsed): { revs: string[]; paths: string[] } {
  const revs: string[] = [];
  const paths = [...(o.paths ?? [])];
  for (const a of o.operands) {
    const range = a.includes("..") ? a.split(rangeSepRe) : [a];
    const isRev = range.every((x) => x === "" || resolveRev(r, x) !== null);
    if (isRev && paths.length === 0) revs.push(a);
    else if (r.root !== null && existsAt(r.g, VfsLib.resolvePath(r.g.cwd, a))) paths.push(a);
    else if (r.root !== null && o.paths === null && readIndex(r).entries.keys.some((p) => specMatch(toSpec(r, a), p))) paths.push(a);
    else
      throw fail(
        `fatal: ambiguous argument '${a}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`,
        128,
      );
  }
  return { revs, paths };
}

/** arr.slice(0, limit): JavaScript's slice already treats NaN as 0 and clamps ±Infinity (the C# converted it). */
export function sliceEnd(limit: number): number {
  return limit;
}

// restore / checkout of files

export interface RestoreOpts {
  staged?: boolean;
  worktree?: boolean;
  source?: string | null;
  ours?: boolean;
  theirs?: boolean;
  checkoutStyle?: boolean;
}

export function restorePaths(r: Repo, pathspecs: string[], opts: RestoreOpts): number {
  const g = r.g;
  const specs = pathspecs.map((p) => toSpec(r, p));
  const idx = readIndex(r);
  const head = readHead(r);
  let source: JsMap<string> | null = null;
  if (opts.source) source = revTree(r, opts.source) ?? raise(fatal(`could not resolve ${opts.source}`));
  else if (opts.staged === true) source = commitTree(r, head.hash);
  const work = scanWork(r);
  const known = union(idx.entries.keys, idx.unmerged.keys, source?.keys ?? []);
  let count = 0;
  for (const spec of specs) {
    const hits = known.filter((p) => specMatch(spec, p));
    if (hits.length === 0) throw fail(`error: pathspec '${spec.raw}' did not match any file(s) known to git`);
    for (const p of sortedOrdinal(hits)) {
      const u = idx.unmerged.get(p);
      if (opts.worktree === true) {
        if (u !== null && !opts.source) {
          const side = opts.ours === true ? u.ours : opts.theirs === true ? u.theirs : null;
          if (opts.ours !== true && opts.theirs !== true) throw fail(`error: path '${show(r, p)}' is unmerged`);
          if (!side) throw fail(`error: path '${show(r, p)}' does not have ${opts.ours === true ? "our" : "their"} version`);
          writeWorkFile(r, p, readBlob(r, side));
          count++;
          continue;
        }
        const want = source !== null ? source.get(p) : idx.entries.get(p);
        if (want === null) {
          if (source !== null && idx.entries.has(p) && work.files.has(p)) {
            removeWorkFile(r, p);
            count++;
          }
        } else if (work.get(p)?.hash !== want) {
          writeWorkFile(r, p, readBlob(r, want));
          count++;
        } else count++;
      }
      if (opts.staged === true) {
        const want = source!.get(p);
        if (want === null) idx.entries.delete(p);
        else idx.entries.set(p, want);
        idx.unmerged.delete(p);
      }
    }
  }
  writeIndex(r, idx);
  if (opts.checkoutStyle === true) g.err(`Updated ${count} path${count === 1 ? "" : "s"} from ${opts.source ? "the tree" : "the index"}\n`);
  return 0;
}

// switch / checkout

function detachedAdvice(g: G, r: Repo, h: string, rev: string): void {
  if (configBool(getConfig(g, r, "advice.detachedHead"), true)) {
    g.err(
      `Note: switching to '${rev}'.\n\nYou are in 'detached HEAD' state. You can look around, make experimental\nchanges and commit them, and you can discard any commits you make in this\nstate without impacting any branches by switching back to a branch.\n\nIf you want to create a new branch to retain commits you create, you may\ndo so (now or later) by using -c with the switch command. Example:\n\n  git switch -c <new-branch-name>\n\nOr undo this operation with:\n\n  git switch -\n\nTurn off this advice by setting config variable advice.detachedHead to false\n\n`,
    );
  }
  g.err(`HEAD is now at ${short(h)} ${subject(readCommit(r, h))}\n`);
}

export interface SwitchTarget {
  branch?: string | null;
  create?: string | null;
  detach?: string | null;
  force?: boolean;
  startRev?: string | null;
  track?: string | null;
}

/** Switches branch (or to a detached commit) and updates the work tree. */
export function doSwitch(r: Repo, target: SwitchTarget): number {
  const g = r.g;
  const head = readHead(r);
  const fromName = head.branch ?? head.hash ?? "HEAD";
  let newHash: string | null;
  if (target.create) newHash = target.startRev ? needCommit(r, target.startRev) : head.hash;
  else if (target.branch) newHash = readRef(r, `refs/heads/${target.branch}`);
  else newHash = target.detach ?? null;
  if (target.branch && target.branch === head.branch && !target.create) {
    g.err(`Already on '${target.branch}'\n`);
    if (head.hash) g.err(trackingText(r, head.branch, head.hash));
    return 0;
  }
  const force = target.force === true;
  if (newHash && newHash !== head.hash) switchTree(r, commitTree(r, head.hash), commitTree(r, newHash), "checkout", force);
  else if (force && newHash) switchTree(r, commitTree(r, head.hash), commitTree(r, newHash), "checkout", true);
  if (target.create) {
    if (newHash) writeRef(r, `refs/heads/${target.create}`, newHash);
    setHeadBranch(r, target.create);
    if (target.track) {
      const segs = target.track.split("/");
      setConfig(g, gpath(r, "config"), `branch.${target.create}.remote`, segs[0]!);
      setConfig(g, gpath(r, "config"), `branch.${target.create}.merge`, `refs/heads/${segs.slice(1).join("/")}`);
      g.out(`branch '${target.create}' set up to track '${target.track}'.\n`);
    }
  } else if (target.branch) setHeadBranch(r, target.branch);
  else setHeadDetached(r, newHash!);
  const toName = target.create ?? target.branch ?? newHash!;
  if (newHash) reflog(r, head.hash, newHash, `checkout: moving from ${fromName} to ${toName}`);
  // Local changes that are carried along are shown like in real git.
  if (r.root !== null) {
    const s = computeStatus(r);
    const changed = new Map<string, string>();
    for (const ch of s.staged) changed.set(ch.path, ch.status === "R" ? "A" : ch.status);
    for (const ch of s.unstaged) changed.set(ch.path, ch.status);
    for (const p of sortedOrdinal(changed.keys())) g.out(`${changed.get(p)}\t${show(r, p)}\n`);
  }
  if (target.detach) {
    detachedAdvice(g, r, newHash!, target.startRev ?? short(newHash!));
    return 0;
  }
  if (!head.branch && head.hash && !target.create) g.err(`Previous HEAD position was ${short(head.hash)} ${subject(readCommit(r, head.hash))}\n`);
  g.err(target.create ? `Switched to a new branch '${target.create}'\n` : `Switched to branch '${target.branch}'\n`);
  const nb = target.create ?? target.branch!;
  const h = readRef(r, `refs/heads/${nb}`);
  if (h) g.out(trackingText(r, nb, h));
  return 0;
}

/** If only origin/<name> exists, git creates a local branch that tracks it. */
export function remoteGuess(r: Repo, name: string): string | null {
  const hits = listRefs(r, "refs/remotes/").filter((x) => x.split("/").slice(1).join("/") === name);
  return hits.length === 1 ? hits[0]! : null;
}

// merge

export interface MergeOpts {
  noFf?: boolean;
  ffOnly?: boolean;
  message?: string | null;
  reflogName: string;
}

export function mergeInto(r: Repo, theirs: string, label: string, opts: MergeOpts): number {
  const g = r.g;
  const head = readHead(r);
  if (!head.hash) {
    // Empty branch: the "merge" just points at the other commit.
    switchTree(r, new JsMap<string>(), commitTree(r, theirs), "merge");
    moveHead(r, theirs, `merge ${opts.reflogName}: Fast-forward`);
    return 0;
  }
  if (head.hash === theirs || isAncestor(r, theirs, head.hash)) {
    g.out("Already up to date.\n");
    return 0;
  }
  const base = mergeBase(r, head.hash, theirs);
  const ourTree = commitTree(r, head.hash);
  const theirTree = commitTree(r, theirs);
  if (base === head.hash && opts.noFf !== true) {
    switchTree(r, ourTree, theirTree, "merge");
    moveHead(r, theirs, `merge ${opts.reflogName}: Fast-forward`);
    g.out(`Updating ${short(head.hash)}..${short(theirs)}\nFast-forward\n${statText(r, treeChanges(ourTree, theirTree), false)}`);
    return 0;
  }
  if (opts.ffOnly === true) {
    g.hint('Diverging branches can\'t be fast-forwarded, you need to either:\n\n\tgit merge --no-ff\n\nor:\n\n\tgit rebase\n\nDisable this message with "git config set advice.diverging false"');
    throw fatal("Not possible to fast-forward, aborting.");
  }
  const baseTree = commitTree(r, base);
  const result = new JsMap<string>();
  const unmerged = new JsMap<Unmerged>();
  const conflictFiles = new JsMap<string>();
  const messages: string[] = [];
  const paths = sortedOrdinal(union(baseTree.keys, ourTree.keys, theirTree.keys));
  for (const p of paths) {
    const b = baseTree.get(p);
    const o = ourTree.get(p);
    const t = theirTree.get(p);
    if (o === t || t === b) {
      if (o) result.set(p, o);
      continue;
    }
    if (o === b) {
      if (t) result.set(p, t);
      continue;
    }
    // Both sides changed the file.
    if (!o || !t) {
      const deletedIn = !o ? "HEAD" : label;
      const modifiedIn = !o ? label : "HEAD";
      messages.push(`CONFLICT (modify/delete): ${p} deleted in ${deletedIn} and modified in ${modifiedIn}.  Version ${modifiedIn} of ${p} left in tree.`);
      unmerged.set(p, { base: b, ours: o, theirs: t });
      conflictFiles.set(p, readBlob(r, (o ?? t)!));
      if (o) result.set(p, o);
      continue;
    }
    messages.push(`Auto-merging ${p}`);
    const m = merge3(b ? readBlob(r, b) : "", readBlob(r, o), readBlob(r, t), "HEAD", label);
    if (m.conflict) {
      messages.push(`CONFLICT (${b ? "content" : "add/add"}): Merge conflict in ${p}`);
      unmerged.set(p, { base: b, ours: o, theirs: t });
      conflictFiles.set(p, m.text);
      result.set(p, o);
    } else result.set(p, writeObj(r, "blob", m.text));
  }
  // Check local changes before anything is written.
  const idx = switchTree(r, ourTree, result, "merge", false, unmerged.keys);
  for (const p of conflictFiles.keys) writeWorkFile(r, p, conflictFiles.get(p)!);
  for (const p of unmerged.keys) {
    idx.unmerged.set(p, unmerged.get(p)!);
    if (!unmerged.get(p)!.ours) idx.entries.delete(p);
  }
  writeIndex(r, idx);
  const into = head.branch && head.branch !== "main" && head.branch !== "master" ? ` into ${head.branch}` : "";
  const message = opts.message
    ? cleanMessage(opts.message)
    : `Merge ${label.startsWith("origin/") || label.includes("/") ? "remote-tracking branch" : "branch"} '${label}'${into}\n`;
  if (messages.length > 0) g.out(messages.map((m) => m + "\n").join(""));
  if (unmerged.count > 0) {
    writeText(g, gpath(r, "MERGE_HEAD"), theirs + "\n");
    writeText(g, gpath(r, "MERGE_MODE"), opts.noFf === true ? "no-ff" : "");
    writeText(g, gpath(r, "MERGE_MSG"), `${message}\n# Conflicts:\n${unmerged.keys.map((p) => `#\t${p}\n`).join("")}`);
    g.out("Automatic merge failed; fix conflicts and then commit the result.\n");
    return 1;
  }
  const id = identity(g, r)!;
  const h = writeCommit(r, newCommit(writeTree(r, result), [head.hash, theirs], id, id, message));
  moveHead(r, h, `merge ${opts.reflogName}: Merge made by the 'ort' strategy.`);
  g.out(`Merge made by the 'ort' strategy.\n${statText(r, treeChanges(ourTree, result), false)}`);
  return 0;
}
