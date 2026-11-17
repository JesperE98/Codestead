// Port of Commands/Git/GitCmd.Status.cs – status: what has changed between HEAD, the index and the work tree, how it
// is printed, and git status.

import { parseArgs } from "./GitCmd.Args.js";
import { getConfig } from "./GitCmd.Config.js";
import { treeChanges, type Change } from "./GitCmd.Diff.js";
import { existsAt, gpath, needRepo, needWork, type Repo } from "./GitCmd.Files.js";
import { readIndex, type Index } from "./GitCmd.Index.js";
import { JsMap, sortedOrdinal, union } from "./GitCmd.Json.js";
import { commitTree } from "./GitCmd.Objects.js";
import { readHead, readRef, type Head } from "./GitCmd.Refs.js";
import { ancestors } from "./GitCmd.Revisions.js";
import { scanWork, show, type Work } from "./GitCmd.WorkTree.js";
import { Col, Zero, short, type G } from "./GitCmd.js";

interface UnmergedRow {
  path: string;
  code: string;
  label: string;
}

export interface StatusInfo {
  head: Head;
  headTree: JsMap<string>;
  index: Index;
  work: Work;
  staged: Change[];
  unstaged: Change[];
  unmerged: UnmergedRow[];
  untracked: string[];
  merging: boolean;
}

function collapseUntracked(paths: string[], tracked: string[]): string[] {
  const trackedDirs = new Set<string>();
  for (const t of tracked) {
    const parts = t.split("/");
    for (let i = 1; i < parts.length; i++) trackedDirs.add(parts.slice(0, i).join("/"));
  }
  const units: string[] = [];
  for (const p of paths) {
    const parts = p.split("/");
    let unit = p;
    for (let i = 1; i < parts.length; i++) {
      const d = parts.slice(0, i).join("/");
      if (!trackedDirs.has(d)) {
        unit = d + "/";
        break;
      }
    }
    units.push(unit);
  }
  return sortedOrdinal(union(units));
}

const byPath = (a: { path: string }, b: { path: string }): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export function computeStatus(r: Repo, all = false): StatusInfo {
  const head = readHead(r);
  const headTree = commitTree(r, head.hash);
  const index = readIndex(r);
  const work = scanWork(r);
  const clean = new JsMap<string>();
  for (const p of index.entries.keys) if (!index.unmerged.has(p)) clean.set(p, index.entries.get(p)!);
  const headClean = new JsMap<string>();
  for (const p of headTree.keys) if (!index.unmerged.has(p)) headClean.set(p, headTree.get(p)!);
  const staged = treeChanges(headClean, clean);
  const unstaged: Change[] = [];
  for (const p of clean.keys) {
    const h = clean.get(p);
    const w = work.get(p);
    if (w === null) unstaged.push({ status: "D", path: p, oldHash: h });
    else if (w.hash !== h) unstaged.push({ status: "M", path: p, oldHash: h, newHash: w.hash });
  }
  unstaged.sort(byPath);
  const unmerged = index.unmerged.keys
    .map((path): UnmergedRow => {
      const u = index.unmerged.get(path)!;
      if ((u.base === null || u.base === "") && u.ours && u.theirs) return { path, code: "AA", label: "both added:" };
      if (!u.ours) return { path, code: "DU", label: "deleted by us:" };
      if (!u.theirs) return { path, code: "UD", label: "deleted by them:" };
      return { path, code: "UU", label: "both modified:" };
    })
    .sort(byPath);
  const untrackedFiles = [...work.files].filter(([k, v]) => !index.entries.has(k) && !index.unmerged.has(k) && !v.ignored).map(([k]) => k);
  const untracked = all ? sortedOrdinal(untrackedFiles) : collapseUntracked(untrackedFiles, index.entries.keys);
  return {
    head,
    headTree,
    index,
    work,
    staged,
    unstaged,
    unmerged,
    untracked,
    merging: existsAt(r.g, gpath(r, "MERGE_HEAD")),
  };
}

export interface Upstream {
  remote: string;
  ref: string;
  name: string;
}

const refsHeadsRe = /^refs\/heads\//;

/** The upstream branch of a local branch, e.g. "origin/main". */
export function upstreamOf(r: Repo, branch: string): Upstream | null {
  const remote = getConfig(r.g, r, `branch.${branch}.remote`);
  const merge = getConfig(r.g, r, `branch.${branch}.merge`);
  if (remote === null || remote === "" || merge === null || merge === "") return null;
  const b = merge.replace(refsHeadsRe, "");
  return { remote, ref: `refs/remotes/${remote}/${b}`, name: `${remote}/${b}` };
}

export function trackingText(r: Repo, branch: string, hash: string | null): string {
  const up = upstreamOf(r, branch);
  if (up === null) return "";
  const upHash = readRef(r, up.ref);
  if (upHash === null) return `Your branch is based on '${up.name}', but the upstream is gone.\n  (use "git branch --unset-upstream" to fixup)\n`;
  const mine = ancestors(r, hash);
  const theirs = ancestors(r, upHash);
  const ahead = [...mine].filter((x) => !theirs.has(x)).length;
  const behind = [...theirs].filter((x) => !mine.has(x)).length;
  const commits = (n: number): string => `${n} commit${n === 1 ? "" : "s"}`;
  if (ahead === 0 && behind === 0) return `Your branch is up to date with '${up.name}'.\n`;
  if (ahead !== 0 && behind === 0) return `Your branch is ahead of '${up.name}' by ${commits(ahead)}.\n  (use "git push" to publish your local commits)\n`;
  if (ahead === 0) return `Your branch is behind '${up.name}' by ${commits(behind)}, and can be fast-forwarded.\n  (use "git pull" to update your local branch)\n`;
  return `Your branch and '${up.name}' have diverged,\nand have ${ahead} and ${behind} different commits each, respectively.\n  (use "git pull" if you want to integrate the remote branch with yours)\n`;
}

export function printLongStatus(r: Repo, s: StatusInfo): void {
  const g = r.g;
  let sb = s.head.branch ? `On branch ${s.head.branch}\n` : `HEAD detached at ${short(s.head.hash ?? Zero)}\n`;
  if (s.head.branch && s.head.hash) {
    const t = trackingText(r, s.head.branch, s.head.hash);
    if (t !== "") sb += t + "\n";
  }
  if (s.merging) {
    sb +=
      s.unmerged.length > 0
        ? 'You have unmerged paths.\n  (fix conflicts and run "git commit")\n  (use "git merge --abort" to abort the merge)\n\n'
        : 'All conflicts fixed but you are still merging.\n  (use "git commit" to conclude merge)\n\n';
  }
  if (!s.head.hash) sb += "\nNo commits yet\n\n";
  // Every section ends with an empty line, just like in real git.
  const section = (title: string, hints: string[], lines: string[]): void => {
    sb += `${title}\n${hints.map((h) => `  (${h})\n`).join("")}${lines.join("")}\n`;
  };
  const label = (ch: Change): string => (ch.status === "A" ? "new file:" : ch.status === "M" ? "modified:" : ch.status === "D" ? "deleted:" : "renamed:").padEnd(12);
  const name = (ch: Change): string => (ch.status === "R" ? `${show(r, ch.oldPath!)} -> ${show(r, ch.path)}` : show(r, ch.path));
  if (s.staged.length > 0) {
    const hint = s.merging ? [] : [s.head.hash ? 'use "git restore --staged <file>..." to unstage' : 'use "git rm --cached <file>..." to unstage'];
    section(
      "Changes to be committed:",
      hint,
      s.staged.map((ch) => `\t${g.c(Col.green, label(ch) + name(ch))}\n`),
    );
  }
  if (s.unmerged.length > 0) {
    section(
      "Unmerged paths:",
      [s.unmerged.some((u) => u.code !== "UU" && u.code !== "AA") ? 'use "git add/rm <file>..." as appropriate to mark resolution' : 'use "git add <file>..." to mark resolution'],
      s.unmerged.map((u) => `\t${g.c(Col.red, u.label.padEnd(17) + show(r, u.path))}\n`),
    );
  }
  if (s.unstaged.length > 0) {
    const del = s.unstaged.some((c) => c.status === "D");
    section(
      "Changes not staged for commit:",
      [del ? 'use "git add/rm <file>..." to update what will be committed' : 'use "git add <file>..." to update what will be committed', 'use "git restore <file>..." to discard changes in working directory'],
      s.unstaged.map((ch) => `\t${g.c(Col.red, label(ch) + name(ch))}\n`),
    );
  }
  if (s.untracked.length > 0) {
    section(
      "Untracked files:",
      ['use "git add <file>..." to include in what will be committed'],
      s.untracked.map((p) => `\t${g.c(Col.red, show(r, p))}\n`),
    );
  }
  if (s.staged.length === 0) {
    if (s.unstaged.length > 0 || s.unmerged.length > 0) sb += 'no changes added to commit (use "git add" and/or "git commit -a")\n';
    else if (s.untracked.length > 0) sb += 'nothing added to commit but untracked files present (use "git add" to track)\n';
    else if (!s.head.hash) sb += 'nothing to commit (create/copy files and use "git add" to track)\n';
    else sb += "nothing to commit, working tree clean\n";
  }
  g.out(sb);
}

interface ShortRow {
  x: string;
  y: string;
  name: string;
}

function printShortStatus(r: Repo, s: StatusInfo, branch: boolean, color: boolean): void {
  const g = r.g;
  const C = (col: string, t: string): string => (color ? g.c(col, t) : t);
  let sb = "";
  if (branch) {
    if (!s.head.branch) sb += `## ${C(Col.red, "HEAD (no branch)")}\n`;
    else if (!s.head.hash) sb += `## No commits yet on ${C(Col.green, s.head.branch)}\n`;
    else {
      const up = upstreamOf(r, s.head.branch);
      let extra = "";
      if (up !== null) {
        const upHash = readRef(r, up.ref);
        if (upHash !== null) {
          const mine = ancestors(r, s.head.hash);
          const theirs = ancestors(r, upHash);
          const ahead = [...mine].filter((x) => !theirs.has(x)).length;
          const behind = [...theirs].filter((x) => !mine.has(x)).length;
          const parts = [ahead !== 0 ? `ahead ${ahead}` : "", behind !== 0 ? `behind ${behind}` : ""].filter((x) => x !== "");
          extra = `...${C(Col.red, up.name)}${parts.length > 0 ? ` [${parts.join(", ")}]` : ""}`;
        } else extra = `...${C(Col.red, up.name)} [gone]`;
      }
      sb += `## ${C(Col.green, s.head.branch)}${extra}\n`;
    }
  }
  const rows = new Map<string, ShortRow>();
  for (const ch of s.staged) rows.set(ch.path, { x: ch.status, y: " ", name: ch.status === "R" ? `${show(r, ch.oldPath!)} -> ${show(r, ch.path)}` : show(r, ch.path) });
  for (const ch of s.unstaged) {
    const row = rows.get(ch.path) ?? { x: " ", y: " ", name: show(r, ch.path) };
    row.y = ch.status;
    rows.set(ch.path, row);
  }
  for (const u of s.unmerged) rows.set(u.path, { x: u.code[0]!, y: u.code[1]!, name: show(r, u.path) });
  for (const p of sortedOrdinal(rows.keys())) {
    const row = rows.get(p)!;
    const unmerged = s.unmerged.some((u) => u.path === p);
    if (unmerged) sb += `${C(Col.red, row.x + row.y)} ${row.name}\n`;
    else {
      const x = C(Col.green, row.x.trim());
      const y = C(Col.red, row.y.trim());
      sb += `${x !== "" ? x : " "}${y !== "" ? y : " "} ${row.name}\n`;
    }
  }
  for (const p of s.untracked) sb += `${C(Col.red, "??")} ${show(r, p)}\n`;
  g.out(sb);
}

// status

export function cmdStatus(g: G, args: string[]): number {
  const o = parseArgs(args, ["s|short", "b|branch", "porcelain", "long", "u|untracked-files=", "z"], "status");
  const r = needRepo(g);
  needWork(r);
  const all = o.get("untracked-files") === "all";
  const s = computeStatus(r, all);
  if (o.get("untracked-files") === "no") s.untracked = [];
  if (o.has("porcelain")) printShortStatus(r, s, o.has("branch"), false);
  else if (o.has("short") && !o.has("long")) printShortStatus(r, s, o.has("branch"), true);
  else printLongStatus(r, s);
  return 0;
}
