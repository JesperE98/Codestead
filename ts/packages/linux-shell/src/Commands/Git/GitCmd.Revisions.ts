// Port of Commands/Git/GitCmd.Revisions.cs – revisions: resolving names like HEAD~2 or main^ to commits, ancestors
// and merge bases.

import { Js, netTrim } from "../../Js.js";
import { gpath, readText, type Repo } from "./GitCmd.Files.js";
import type { JsMap } from "./GitCmd.Json.js";
import { allObjects, peel, readCommit, readObj, readTree } from "./GitCmd.Objects.js";
import { hash40Re, previousBranch, readHead, readRef } from "./GitCmd.Refs.js";
import { fatal } from "./GitCmd.js";

// .NET's . is [^\n] (JavaScript's also excludes \r, \u2028 and \u2029).
const revRe = /^([^\n]*?)((?:[~^][0-9]*)*)$/;
const specialHeadRe = /^(HEAD|ORIG_HEAD|MERGE_HEAD|FETCH_HEAD)$/;
const shortHexRe = /^[0-9a-f]{4,40}$/;
const revOpRe = /[~^][0-9]*/g;
const wsRe = /\s/;

/** Resolves e.g. HEAD, main, origin/main, v1.0, a1b2c3d, HEAD~2 and main^2. Returns an object id. */
export function resolveRev(r: Repo, rev: string): string | null {
  const m = revRe.exec(rev);
  if (!m) return null;
  let base = m[1]!;
  const suffix = m[2]!;
  if (base === "" || base === "@") base = "HEAD";
  let h: string | null = null;
  if (specialHeadRe.test(base)) {
    if (base === "HEAD") h = readHead(r).hash;
    else {
      const txt = readText(r.g, gpath(r, base));
      h = txt !== null ? netTrim(txt).split(wsRe)[0]! : null;
    }
  } else if (base === "@{-1}" || base === "-") {
    const prev = previousBranch(r);
    h = prev !== null ? (readRef(r, `refs/heads/${prev}`) ?? (hash40Re.test(prev) ? prev : null)) : null;
  } else {
    const refs = base.startsWith("refs/")
      ? [base]
      : [`refs/${base}`, `refs/tags/${base}`, `refs/heads/${base}`, `refs/remotes/${base}`, `refs/remotes/${base}/HEAD`];
    for (const rf of refs) {
      h = readRef(r, rf);
      if (h !== null && h !== "") break;
    }
    if ((h === null || h === "") && shortHexRe.test(base)) {
      const hits = allObjects(r).filter((id) => id.startsWith(base));
      if (hits.length === 1) h = hits[0]!;
      else if (hits.length > 1) throw fatal(`short object ID ${base} is ambiguous`);
    }
  }
  if (h === null || h === "" || !hash40Re.test(h)) return null;
  for (const opm of suffix.matchAll(revOpRe)) {
    const op = opm[0];
    const n = op.length > 1 ? Js.number(op.slice(1)) : 1;
    let c = readCommit(r, peel(r, h));
    if (op[0] === "~") {
      for (let i = 0; i < n; i++) {
        if (c.parents.length === 0) return null;
        c = readCommit(r, c.parents[0]!);
      }
      h = c.hash;
    } else {
      if (n === 0) {
        h = c.hash;
        continue;
      }
      const pi = n - 1;
      if (pi < 0 || pi >= c.parents.length) return null;
      h = c.parents[pi]!;
    }
  }
  return h;
}

export function resolveCommit(r: Repo, rev: string): string | null {
  const h = resolveRev(r, rev);
  if (h === null) return null;
  const p = peel(r, h);
  return readObj(r, p)?.type === "commit" ? p : null;
}

export function needCommit(r: Repo, rev: string): string {
  const h = resolveCommit(r, rev);
  if (h === null) throw fatal(`not a valid object name: '${rev}'`);
  return h;
}

/** A tree from e.g. "HEAD", a commit or a tree id. */
export function revTree(r: Repo, rev: string): JsMap<string> | null {
  const h = resolveRev(r, rev);
  if (h === null) return null;
  const p = peel(r, h);
  const o = readObj(r, p);
  if (o?.type === "commit") return readTree(r, readCommit(r, p).tree);
  if (o?.type === "tree") return readTree(r, p);
  return null;
}

/** The commits reachable from h (h included), in the order they were found (a Set keeps insertion order). */
export function ancestors(r: Repo, h: string | null | undefined): Set<string> {
  const seen = new Set<string>();
  const stack: string[] = [];
  if (h !== null && h !== undefined && h !== "") stack.push(h);
  while (stack.length > 0) {
    const x = stack.pop()!;
    if (seen.has(x)) continue;
    seen.add(x);
    stack.push(...readCommit(r, x).parents);
  }
  return seen;
}

export function isAncestor(r: Repo, a: string, b: string): boolean {
  return ancestors(r, b).has(a);
}

export function mergeBase(r: Repo, a: string, b: string): string | null {
  const A = ancestors(r, a);
  const common = [...ancestors(r, b)].filter((x) => A.has(x));
  const best = common.filter((x) => !common.some((y) => y !== x && isAncestor(r, x, y)));
  best.sort((x, y) => Math.sign(readCommit(r, y).committer.time - readCommit(r, x).committer.time));
  return best.length > 0 ? best[0]! : null;
}
