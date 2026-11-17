// Port of Commands/Git/GitCmd.Diff.cs – diff (line diff, hunks, patches and stats), the three-way merge, and git
// diff.

import { Js } from "../../Js.js";
import { parseArgs } from "./GitCmd.Args.js";
import { needRepo, needWork, type Repo } from "./GitCmd.Files.js";
import { readIndex } from "./GitCmd.Index.js";
import { JsMap, union } from "./GitCmd.Json.js";
import { commitTree, readBlob } from "./GitCmd.Objects.js";
import { readHead } from "./GitCmd.Refs.js";
import { needCommit, revTree } from "./GitCmd.Revisions.js";
import { rangeSepRe, revsAndPaths } from "./GitCmd.Subs.js";
import { scanWork, specMatch, toSpec } from "./GitCmd.WorkTree.js";
import { Col, Zero, fatal, raise, short, type G } from "./GitCmd.js";

/** One line of a diff: ' ' (same), '-' (removed) or '+' (added). */
interface Op {
  t: string;
  s: string;
}

const NoEol = "\u0000";

function diffLinesOf(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  else lines[lines.length - 1] += NoEol;
  return lines;
}

/** Line diff (longest common subsequence). */
function diffOps(a: string[], b: string[]): Op[] {
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const A = a.slice(pre, a.length - suf);
  const B = b.slice(pre, b.length - suf);
  const mid: Op[] = [];
  const n = A.length;
  const m = B.length;
  if (n * m > 4_000_000) {
    for (const s of A) mid.push({ t: "-", s });
    for (const s of B) mid.push({ t: "+", s });
  } else {
    const dp = new Int32Array((n + 1) * (m + 1));
    for (let ii = n - 1; ii >= 0; ii--)
      for (let jj = m - 1; jj >= 0; jj--)
        dp[ii * (m + 1) + jj] = A[ii] === B[jj] ? dp[(ii + 1) * (m + 1) + jj + 1]! + 1 : Math.max(dp[(ii + 1) * (m + 1) + jj]!, dp[ii * (m + 1) + jj + 1]!);
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && A[i] === B[j]) {
        mid.push({ t: " ", s: A[i]! });
        i++;
        j++;
      } else if (j < m && (i === n || dp[i * (m + 1) + j + 1]! >= dp[(i + 1) * (m + 1) + j]!)) {
        if (i < n && dp[i * (m + 1) + j + 1] === dp[(i + 1) * (m + 1) + j]) mid.push({ t: "-", s: A[i++]! });
        else mid.push({ t: "+", s: B[j++]! });
      } else mid.push({ t: "-", s: A[i++]! });
    }
  }
  const res: Op[] = a.slice(0, pre).map((s) => ({ t: " ", s }));
  res.push(...mid);
  res.push(...b.slice(b.length - suf).map((s) => ({ t: " ", s })));
  return res;
}

function countChanges(oldText: string, newText: string): { ins: number; del: number } {
  let ins = 0;
  let del = 0;
  for (const op of diffOps(diffLinesOf(oldText), diffLinesOf(newText))) {
    if (op.t === "+") ins++;
    else if (op.t === "-") del++;
  }
  return { ins, del };
}

export function hunkLines(g: G, oldText: string, newText: string, context = 3): string[] {
  const ops = diffOps(diffLinesOf(oldText), diffLinesOf(newText));
  const aPos: number[] = [];
  const bPos: number[] = [];
  let a = 0;
  let b = 0;
  for (const op of ops) {
    aPos.push(a);
    bPos.push(b);
    if (op.t !== "+") a++;
    if (op.t !== "-") b++;
  }
  const changes = ops.map((op, i) => (op.t === " " ? -1 : i)).filter((i) => i >= 0);
  const ranges: [number, number][] = [];
  for (const i of changes) {
    const start = Math.max(0, i - context);
    const end = Math.min(ops.length - 1, i + context);
    const last = ranges.length > 0 ? ranges.at(-1)! : null;
    if (last !== null && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else ranges.push([start, end]);
  }
  const fmt = (start: number, count: number): string => (count === 0 ? `${start},0` : count === 1 ? `${start + 1}` : `${start + 1},${count}`);
  const res: string[] = [];
  for (const [s, e] of ranges) {
    const slice = ops.slice(s, e + 1);
    const aCount = slice.filter((o) => o.t !== "+").length;
    const bCount = slice.filter((o) => o.t !== "-").length;
    res.push(g.c(Col.cyan, `@@ -${fmt(aPos[s]!, aCount)} +${fmt(bPos[s]!, bCount)} @@`));
    for (const op of slice) {
      const noEol = op.s.endsWith(NoEol);
      const text = op.t + (noEol ? op.s.slice(0, -1) : op.s);
      res.push(op.t === "-" ? g.c(Col.red, text) : op.t === "+" ? g.c(Col.green, text) : text);
      if (noEol) res.push("\\ No newline at end of file");
    }
  }
  return res;
}

export interface Change {
  /** A, M, D or R. */
  status: string;
  path: string;
  oldPath?: string | null;
  oldHash?: string | null;
  newHash?: string | null;
}

/** The differences between two trees, with simple rename detection (same content). */
export function treeChanges(A: JsMap<string>, B: JsMap<string>, filter: ((p: string) => boolean) | null = null): Change[] {
  let changes: Change[] = [];
  for (const p of union(A.keys, B.keys)) {
    if (filter !== null && !filter(p)) continue;
    if (A.get(p) === B.get(p)) continue;
    if (!A.has(p)) changes.push({ status: "A", path: p, newHash: B.get(p) });
    else if (!B.has(p)) changes.push({ status: "D", path: p, oldHash: A.get(p) });
    else changes.push({ status: "M", path: p, oldHash: A.get(p), newHash: B.get(p) });
  }
  for (const add of changes.filter((c) => c.status === "A")) {
    const del = changes.find((c) => c.status === "D" && c.oldHash === add.newHash);
    if (del === undefined) continue;
    changes = changes.filter((c) => c !== del);
    add.status = "R";
    add.oldPath = del.path;
    add.oldHash = del.oldHash;
  }
  return changes.sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
}

export function printPatch(r: Repo, changes: Change[], mode = "patch"): void {
  const g = r.g;
  if (mode === "stat") {
    g.out(statText(r, changes, false));
    return;
  }
  for (const ch of changes) {
    if (mode === "name-only") {
      g.out(ch.path + "\n");
      continue;
    }
    if (mode === "name-status") {
      g.out(ch.status === "R" ? `R100\t${ch.oldPath}\t${ch.path}\n` : `${ch.status}\t${ch.path}\n`);
      continue;
    }
    const oldP = ch.oldPath ?? ch.path;
    const lines = [`diff --git a/${oldP} b/${ch.path}`];
    if (ch.status === "A") lines.push("new file mode 100644");
    if (ch.status === "D") lines.push("deleted file mode 100644");
    if (ch.status === "R") lines.push("similarity index 100%", `rename from ${oldP}`, `rename to ${ch.path}`);
    if (ch.status !== "R") lines.push(`index ${short(ch.oldHash ?? Zero)}..${short(ch.newHash ?? Zero)}${ch.status === "M" ? " 100644" : ""}`);
    const oldText = ch.oldHash ? readBlob(r, ch.oldHash) : "";
    const newText = ch.newHash ? readBlob(r, ch.newHash) : "";
    const hunks = oldText === newText ? [] : hunkLines(g, oldText, newText);
    if (hunks.length > 0) {
      lines.push(ch.status === "A" ? "--- /dev/null" : `--- a/${oldP}`);
      lines.push(ch.status === "D" ? "+++ /dev/null" : `+++ b/${ch.path}`);
    }
    g.out(lines.map((l) => g.c(Col.bold, l)).join("\n") + "\n");
    if (hunks.length > 0) g.out(hunks.join("\n") + "\n");
  }
}

function summaryLine(files: number, ins: number, del: number): string {
  let s = ` ${files} file${files === 1 ? "" : "s"} changed`;
  if (ins !== 0 || del === 0) s += `, ${ins} insertion${ins === 1 ? "" : "s"}(+)`;
  if (del !== 0 || ins === 0) s += `, ${del} deletion${del === 1 ? "" : "s"}(-)`;
  return s + "\n";
}

/** Diffstat as after `git merge` (bar chart) or `git commit` (summary only, short=true). */
export function statText(r: Repo, changes: Change[], isShort: boolean): string {
  const g = r.g;
  const rows = changes.map((ch) => {
    const { ins, del } = countChanges(ch.oldHash ? readBlob(r, ch.oldHash) : "", ch.newHash ? readBlob(r, ch.newHash) : "");
    const name = ch.status === "R" ? `${ch.oldPath} => ${ch.path}` : ch.path;
    return { ch, ins, del, name };
  });
  const totalIns = rows.reduce((n, x) => n + x.ins, 0);
  const totalDel = rows.reduce((n, x) => n + x.del, 0);
  let sb = "";
  if (!isShort) {
    const nameW = Math.max(0, ...rows.map((x) => x.name.length));
    const numW = Math.max(1, ...rows.map((x) => Js.num(x.ins + x.del).length));
    const maxBar = Math.max(1, ...rows.map((x) => x.ins + x.del));
    const scale = maxBar > 50 ? 50 / maxBar : 1;
    for (const x of rows) {
      let plus = Math.round(x.ins * scale);
      if (plus === 0) plus = x.ins !== 0 ? 1 : 0;
      let minus = Math.round(x.del * scale);
      if (minus === 0) minus = x.del !== 0 ? 1 : 0;
      const bar = g.c(Col.green, "+".repeat(plus)) + g.c(Col.red, "-".repeat(minus));
      sb += ` ${x.name.padEnd(nameW)} | ${Js.num(x.ins + x.del).padStart(numW)}${bar !== "" ? " " + bar : ""}\n`;
    }
  }
  if (rows.length > 0) sb += summaryLine(rows.length, totalIns, totalDel);
  for (const x of rows) {
    if (x.ch.status === "A") sb += ` create mode 100644 ${x.ch.path}\n`;
    else if (x.ch.status === "D") sb += ` delete mode 100644 ${x.ch.path}\n`;
    else if (x.ch.status === "R" && isShort) sb += ` rename ${x.ch.oldPath} => ${x.ch.path} (100%)\n`;
  }
  return sb;
}

/** Which lines in a match lines in b (index in b, or -1). */
function matches(a: string[], b: string[]): number[] {
  const res = new Array<number>(a.length).fill(-1);
  let i = 0;
  let j = 0;
  for (const op of diffOps(a, b)) {
    if (op.t === " ") res[i++] = j++;
    else if (op.t === "-") i++;
    else j++;
  }
  return res;
}

/** Line-based three-way merge (diff3). Returns the text and whether there was a conflict. */
export function merge3(base: string, ours: string, theirs: string, oursLabel: string, theirsLabel: string): { text: string; conflict: boolean } {
  const B = diffLinesOf(base);
  const O = diffLinesOf(ours);
  const T = diffLinesOf(theirs);
  const mo = matches(B, O);
  const mt = matches(B, T);
  const res: string[] = [];
  let conflict = false;
  let i = 0;
  let j = 0;
  let k = 0;
  const eq = (x: string[], y: string[]): boolean => x.length === y.length && x.every((s, n) => s === y[n]);
  while (i < B.length || j < O.length || k < T.length) {
    if (i < B.length && mo[i] === j && mt[i] === k) {
      res.push(B[i]!);
      i++;
      j++;
      k++;
      continue;
    }
    let t = i;
    while (t < B.length && !(mo[t]! >= j && mt[t]! >= k)) t++;
    const oj = t < B.length ? mo[t]! : O.length;
    const tk = t < B.length ? mt[t]! : T.length;
    const b = B.slice(i, t);
    const o = O.slice(j, oj);
    const th = T.slice(k, tk);
    if (eq(o, b)) res.push(...th);
    else if (eq(th, b) || eq(o, th)) res.push(...o);
    else {
      conflict = true;
      // s.replace(NoEol, "") replaces the first occurrence, like the C# ReplaceFirst.
      const strip = (xs: string[]): string[] => xs.map((s) => s.replace(NoEol, ""));
      res.push(`<<<<<<< ${oursLabel}`);
      res.push(...strip(o));
      res.push("=======");
      res.push(...strip(th));
      res.push(`>>>>>>> ${theirsLabel}`);
    }
    i = t;
    j = oj;
    k = tk;
  }
  const last = res.length > 0 ? res.at(-1)! : null;
  const text = res.map((l) => l.replace(NoEol, "")).join("\n") + (res.length > 0 && !last!.endsWith(NoEol) ? "\n" : "");
  return { text, conflict };
}

// diff

export function cmdDiff(g: G, args: string[]): number {
  const o = parseArgs(args, ["staged", "cached", "stat", "name-only", "name-status", "exit-code", "quiet", "no-index"], "diff");
  const r = needRepo(g);
  const { revs, paths } = revsAndPaths(r, o);
  const specs = paths.map((p) => toSpec(r, p));
  const filter = (p: string): boolean => specs.length === 0 || specs.some((s) => specMatch(s, p));
  const staged = o.has("staged") || o.has("cached");
  let A: JsMap<string>;
  let B: JsMap<string>;
  const worktreeTree = (base: JsMap<string>): JsMap<string> => {
    const work = scanWork(r);
    const t = new JsMap<string>();
    for (const p of base.keys) {
      const w = work.get(p);
      if (w !== null) t.set(p, w.hash);
    }
    return t;
  };
  const range = revs.find((x) => x.includes("..")) ?? null;
  if (range !== null || revs.length === 2) {
    const ab = range !== null ? range.split(rangeSepRe) : revs;
    const a = ab[0]!;
    const b = ab.length > 1 ? ab[1]! : "";
    A = commitTree(r, needCommit(r, a !== "" ? a : "HEAD"));
    B = commitTree(r, needCommit(r, b !== "" ? b : "HEAD"));
  } else if (revs.length === 1) {
    A = revTree(r, revs[0]!) ?? raise(fatal(`bad revision '${revs[0]}'`));
    const idx = readIndex(r);
    B = staged ? idx.entries : worktreeTree(A.merge(idx.entries));
  } else if (staged) {
    A = commitTree(r, readHead(r).hash);
    B = readIndex(r).entries;
  } else {
    needWork(r);
    const idx = readIndex(r);
    A = idx.entries.copy();
    for (const p of idx.unmerged.keys) A.delete(p);
    B = worktreeTree(A);
    const unmerged = idx.unmerged.keys.filter(filter);
    if (unmerged.length > 0 && !o.has("quiet")) {
      // Show the conflicted files against "our" version (real git shows a combined diff).
      for (const p of unmerged) {
        const ours = idx.unmerged.get(p)!.ours;
        const w = scanWork(r).get(p);
        g.out(`${g.c(Col.bold, `diff --cc ${p}`)}\n`);
        if (ours !== null && ours !== "" && w !== null) {
          const lines = hunkLines(g, readBlob(r, ours), w.content);
          if (lines.length > 0) g.out(`${g.c(Col.bold, `--- a/${p}`)}\n${g.c(Col.bold, `+++ b/${p}`)}\n${lines.join("\n")}\n`);
        }
      }
    }
  }
  const changes = treeChanges(A, B, filter);
  if (!o.has("quiet")) printPatch(r, changes, o.has("stat") ? "stat" : o.has("name-only") ? "name-only" : o.has("name-status") ? "name-status" : "patch");
  return (o.has("exit-code") || o.has("quiet")) && changes.length > 0 ? 1 : 0;
}
