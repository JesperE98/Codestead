// Port of Commands/Git/GitCmd.Log.cs – git log.

import { Js } from "../../Js.js";
import { parseArgs } from "./GitCmd.Args.js";
import { printPatch, treeChanges } from "./GitCmd.Diff.js";
import { needRepo, type Repo } from "./GitCmd.Files.js";
import { union } from "./GitCmd.Json.js";
import { commitTree, peel, readCommit, readObj, readTree, subject, type Commit } from "./GitCmd.Objects.js";
import { listRefs, readHead, readRef } from "./GitCmd.Refs.js";
import { ancestors, needCommit } from "./GitCmd.Revisions.js";
import { commitHeader, decorate, decorations, rangeSepRe, revsAndPaths, sliceEnd, trailingWsAnyRe } from "./GitCmd.Subs.js";
import { specMatch, toSpec } from "./GitCmd.WorkTree.js";
import { Col, fatal, short, type G } from "./GitCmd.js";

/**
 * Commits reachable from `starts` (but not from `exclude`), newest first and children before parents.
 * With `topo` (as `git log --graph`), the order no longer depends on the commit times: after a merge
 * the merged branch is shown before the first parent's line, like git's --topo-order.
 */
export function walkCommits(r: Repo, starts: string[], exclude: string[] | null = null, firstParent = false, topo = false): Commit[] {
  exclude ??= [];
  const hidden = new Set<string>();
  for (const e of exclude) for (const h of ancestors(r, e)) hidden.add(h);
  const all = new Map<string, Commit>();
  const order = new Map<string, number>();
  const queue = [...starts];
  const parentsOf = (c: Commit): string[] => (firstParent ? c.parents.slice(0, 1) : c.parents);
  while (queue.length > 0) {
    const h = queue.shift()!;
    if (all.has(h) || hidden.has(h)) continue;
    const c = readCommit(r, h);
    all.set(h, c);
    order.set(h, order.size);
    for (const p of parentsOf(c)) queue.push(p);
  }
  const pending = new Map<string, number>();
  for (const c of all.values()) for (const p of parentsOf(c)) if (all.has(p)) pending.set(p, (pending.get(p) ?? 0) + 1);
  const ready = [...all.keys()].filter((h) => (pending.get(h) ?? 0) === 0);
  const byDate = (a: string, b: string): number => {
    const d = Math.sign(all.get(b)!.committer.time - all.get(a)!.committer.time);
    return d !== 0 ? d : order.get(a)! - order.get(b)!;
  };
  const res: Commit[] = [];
  if (topo) {
    // A stack: the newest tip on top, and a commit's last parent is taken first.
    ready.sort(byDate);
    ready.reverse();
  }
  while (ready.length > 0) {
    let h: string;
    if (topo) h = ready.pop()!;
    else {
      ready.sort(byDate);
      h = ready.shift()!;
    }
    const c = all.get(h)!;
    res.push(c);
    for (const p of parentsOf(c)) {
      if (!all.has(p)) continue;
      const n = pending.get(p)! - 1;
      pending.set(p, n);
      if (n === 0) ready.push(p);
    }
  }
  return res;
}

/** Draws one graph row: an array that grows when assigned past its end (holes join as ""). */
function draw(width: number, set: (arr: string[]) => void): string {
  const arr = new Array<string>(Math.max(0, width)).fill(" ");
  set(arr);
  return arr.join("").replace(trailingWsAnyRe, "");
}

/** Draws a simple graph (like `git log --graph`) to the left of every commit. */
function graphLines(commits: Commit[], render: (c: Commit) => string[]): string[] {
  const inSet = new Set(commits.map((c) => c.hash));
  let cols: string[] = [];
  const res: string[] = [];
  for (const c of commits) {
    let idx = cols.indexOf(c.hash);
    if (idx < 0) {
      cols.push(c.hash);
      idx = cols.length - 1;
    }
    const parents = c.parents.filter((p) => inSet.has(p));
    const next = [...cols];
    next.splice(idx, 1);
    if (parents.length > 0) next.splice(idx, 0, parents[0]!);
    const extra = parents.slice(1).filter((p) => !next.includes(p));
    next.splice(Math.min(idx + 1, next.length), 0, ...extra);
    const width = Math.max(cols.length, next.length) * 2;
    const row = cols.map((_, i) => (i === idx ? "*" : "|")).join(" ");
    const prefixes: string[] = [];
    if (parents.length > 1) {
      if (extra.length > 0) {
        const colsCount = cols.length;
        prefixes.push(
          draw(next.length * 2, (arr) => {
            for (let k = 0; k <= idx; k++) arr[2 * k] = "|";
            arr[2 * idx + 1] = "\\";
            for (let k = idx + 1; k < colsCount; k++) arr[2 * k + 1] = "\\";
          }),
        );
      } else {
        const q = next.indexOf(parents[1]!);
        const nextCount = next.length;
        prefixes.push(
          draw(next.length * 2, (arr) => {
            for (let k = 0; k < nextCount; k++) arr[2 * k] = "|";
            // arr[-1] = x in JavaScript sets a property, not an element: it is not drawn.
            if (q < idx) {
              if (2 * idx - 1 >= 0) arr[2 * idx - 1] = "/";
            } else arr[2 * idx + 1] = "\\";
          }),
        );
      }
    } else if (parents.length === 0 && idx < cols.length - 1) {
      const colsCount = cols.length;
      prefixes.push(
        draw(cols.length * 2, (arr) => {
          for (let k = 0; k < idx; k++) arr[2 * k] = "|";
          for (let k = idx + 1; k < colsCount; k++) arr[2 * k - 1] = "/";
        }),
      );
    }
    cols = next;
    const bars = cols.map(() => "|").join(" ");
    const body = render(c);
    res.push(row.padEnd(width) + body[0]);
    const rest = body.slice(1);
    for (let i = 0; i < Math.max(rest.length, prefixes.length); i++) {
      const pre = i < prefixes.length ? prefixes[i]! : bars;
      const line = i < rest.length ? rest[i]! : "";
      res.push(line !== "" ? pre.padEnd(width) + line : pre);
    }
    // Two columns waiting for the same commit are joined.
    for (let j = 0; j < cols.length; j++) {
      const i = cols.indexOf(cols[j]!);
      if (i === j) continue;
      const jj = j;
      const colsCount = cols.length;
      res.push(
        draw(cols.length * 2, (arr) => {
          for (let k = 0; k < jj; k++) arr[2 * k] = "|";
          arr[2 * jj - 1] = "/";
          for (let k = jj + 1; k < colsCount; k++) arr[2 * k - 1] = "/";
        }),
      );
      cols.splice(j, 1);
      j--;
    }
  }
  return res;
}

const limitArgRe = /^-([0-9]+)$/;

export function cmdLog(g: G, args: string[]): number {
  let limit = Number.POSITIVE_INFINITY;
  args = args.filter((a) => {
    const m = limitArgRe.exec(a);
    if (m) limit = Js.number(m[1]);
    return !m;
  });
  const o = parseArgs(
    args,
    ["oneline", "n|max-count=", "graph", "all", "decorate", "p|patch", "stat", "reverse", "first-parent", "name-only", "name-status", "pretty=", "format=", "abbrev-commit"],
    "log",
  );
  const maxCount = o.get("max-count");
  if (maxCount !== null && maxCount !== "") limit = Js.number(maxCount);
  const r = needRepo(g);
  const { revs, paths } = revsAndPaths(r, o);
  const head = readHead(r);
  const starts: string[] = [];
  const exclude: string[] = [];
  for (const rev of revs) {
    if (rev.includes("..")) {
      const ab = rev.split(rangeSepRe);
      const a = ab[0]!;
      const b = ab.length > 1 ? ab[1]! : "";
      exclude.push(needCommit(r, a !== "" ? a : "HEAD"));
      starts.push(needCommit(r, b !== "" ? b : "HEAD"));
    } else if (rev.startsWith("^")) exclude.push(needCommit(r, rev.slice(1)));
    else starts.push(needCommit(r, rev));
  }
  if (o.has("all")) {
    if (head.hash) starts.push(head.hash);
    for (const prefix of ["refs/heads/", "refs/remotes/", "refs/tags/"])
      for (const n of listRefs(r, prefix)) {
        const h = readRef(r, prefix + n);
        if (h && readObj(r, peel(r, h))?.type === "commit") starts.push(peel(r, h));
      }
  }
  if (starts.length === 0 && !o.has("all")) {
    if (!head.hash) throw fatal(head.branch ? `your current branch '${head.branch}' does not have any commits yet` : "bad default revision 'HEAD'");
    starts.push(head.hash);
  }
  let commits = walkCommits(r, union(starts), exclude, o.has("first-parent"), o.has("graph"));
  if (paths.length > 0) {
    const specs = paths.map((p) => toSpec(r, p));
    const touches = (c: Commit): boolean =>
      treeChanges(commitTree(r, c.parents.length > 0 ? c.parents[0] : null), readTree(r, c.tree), (p) => specs.some((s) => specMatch(s, p))).length > 0;
    commits = commits.filter(touches);
  }
  commits = commits.slice(0, sliceEnd(limit));
  if (o.has("reverse")) commits.reverse();
  const pretty = o.get("pretty") ?? o.get("format");
  const oneline = o.has("oneline") || pretty === "oneline";
  const deco = o.has("no-decorate") ? null : o.has("decorate") || g.tty ? decorations(r) : null;
  const render = (c: Commit): string[] => {
    let lines: string[];
    if (oneline) lines = [`${g.c(Col.yellow, o.has("oneline") || o.has("abbrev-commit") ? short(c.hash) : c.hash)}${decorate(g, deco, c.hash)} ${subject(c)}`];
    else if (pretty === "short")
      lines = [`${g.c(Col.yellow, `commit ${c.hash}`)}${decorate(g, deco, c.hash)}`, `Author: ${c.author.name} <${c.author.email}>`, "", `    ${subject(c)}`];
    else lines = commitHeader(r, c, deco);
    const mode = o.has("patch") ? "patch" : o.has("stat") ? "stat" : o.has("name-only") ? "name-only" : o.has("name-status") ? "name-status" : null;
    if (mode !== null && c.parents.length < 2) {
      let text = "";
      const saved = g.out;
      g.out = (s) => (text += s);
      try {
        printPatch(r, treeChanges(commitTree(r, c.parents.length > 0 ? c.parents[0] : null), readTree(r, c.tree)), mode);
      } finally {
        g.out = saved;
      }
      if (text !== "") {
        if (!oneline) lines.push("");
        lines.push(...(text.endsWith("\n") ? text.slice(0, -1) : text).split("\n"));
      }
    }
    return lines;
  };
  const blocks: string[] = [];
  if (o.has("graph")) {
    const sep = !oneline;
    blocks.push(
      ...graphLines(commits, (c) => {
        const lines = render(c);
        if (sep && c !== commits.at(-1)) lines.push("");
        return lines;
      }),
    );
  } else {
    for (let i = 0; i < commits.length; i++) {
      blocks.push(...render(commits[i]!));
      if (!oneline && i < commits.length - 1) blocks.push("");
    }
  }
  if (blocks.length > 0) g.out(blocks.join("\n") + "\n");
  return 0;
}
