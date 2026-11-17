// Port of Commands/Git/GitCmd.Objects.cs – objects: blobs, trees and commits stored under .git/objects.

import { Js } from "../../Js.js";
import { existsAt, gpath, readText, writeText, type Repo } from "./GitCmd.Files.js";
import { JsMap, sortedOrdinal } from "./GitCmd.Json.js";
import { fatal, sha1 } from "./GitCmd.js";

export interface GitObj {
  type: string;
  data: string;
}

export function objPath(r: Repo, h: string): string {
  return gpath(r, `objects/${h.slice(0, 2)}/${h.slice(2)}`);
}

export function writeObj(r: Repo, type: string, data: string): string {
  const raw = `${type} ${Js.utf8Length(data)}\0${data}`;
  const h = sha1(raw);
  const p = objPath(r, h);
  if (!existsAt(r.g, p)) writeText(r.g, p, raw);
  return h;
}

export function readObj(r: Repo, h: string): GitObj | null {
  const blob = r.blobs.get(h);
  if (blob !== undefined) return { type: "blob", data: blob };
  const raw = readText(r.g, objPath(r, h));
  if (raw === null) return null;
  const nul = raw.indexOf("\0");
  return { type: raw.slice(0, nul).split(" ")[0]!, data: raw.slice(nul + 1) };
}

export function readBlob(r: Repo, h: string): string {
  const o = readObj(r, h);
  if (o === null) throw fatal(`unable to read ${h}`);
  return o.data;
}

const twoHexRe = /^[0-9a-f]{2}$/;

/** All object ids in the repository. */
export function allObjects(r: Repo): string[] {
  const dir = r.g.sh.vfs.tryLookup(gpath(r, "objects"), r.g.user);
  const ids: string[] = [];
  // The directory's keys in JavaScript object order (the TypeScript iterated Object.keys).
  for (const pre of jsKeys(dir?.children)) {
    const node = dir!.children!.get(pre)!;
    if (!twoHexRe.test(pre) || node.type !== "dir") continue;
    for (const rest of jsKeys(node.children)) ids.push(pre + rest);
  }
  return ids;
}

function jsKeys(children: Map<string, unknown> | null | undefined): string[] {
  const o = Object.create(null) as Record<string, true>;
  for (const k of children?.keys() ?? []) o[k] = true;
  return Object.keys(o);
}

// A tree (Tree in the TypeScript) is a JsMap<string>: path → blob id. Real git has one tree
// per directory; here a flat list is enough.

export function writeTree(r: Repo, t: JsMap<string>): string {
  const data = sortedOrdinal(t.keys)
    .map((p) => `100644 blob ${t.get(p)}\t${p}\n`)
    .join("");
  return writeObj(r, "tree", data);
}

const treeLineRe = /^[0-9]+ blob ([0-9a-f]{40})\t(.*)$/s;

export function readTree(r: Repo, h: string): JsMap<string> {
  const o = readObj(r, h);
  if (o === null || o.type !== "tree") throw fatal(`not a tree object: ${h}`);
  const t = new JsMap<string>();
  for (const line of o.data.split("\n")) {
    const m = treeLineRe.exec(line);
    if (m) t.set(m[2]!, m[1]!);
  }
  return t;
}

export interface Ident {
  name: string;
  email: string;
  time: number;
  tz: string;
}

export interface Commit {
  hash: string;
  tree: string;
  parents: string[];
  author: Ident;
  committer: Ident;
  message: string;
}

export function fmtIdent(i: Ident): string {
  return `${i.name} <${i.email}> ${i.time} ${i.tz}`;
}

// .NET's . does not match \n only; the s flag gives the same (lines never hold \n here).
const identRe = /^(.*) <(.*)> ([0-9]+) ([+-][0-9]{4})$/s;

export function parseIdent(s: string): Ident {
  const m = identRe.exec(s);
  if (!m) return { name: s, email: "", time: 0, tz: "+0000" };
  return { name: m[1]!, email: m[2]!, time: Math.trunc(Js.number(m[3])), tz: m[4]! };
}

export function writeCommit(r: Repo, c: Commit): string {
  let data = `tree ${c.tree}\n`;
  for (const p of c.parents) data += `parent ${p}\n`;
  data += `author ${fmtIdent(c.author)}\ncommitter ${fmtIdent(c.committer)}\n\n${c.message}`;
  return writeObj(r, "commit", data);
}

/** A commit to write (the hash is filled in when it is read back). */
export function newCommit(tree: string, parents: string[], author: Ident, committer: Ident, message: string): Commit {
  return { hash: "", tree, parents, author, committer, message };
}

export function readCommit(r: Repo, h: string): Commit {
  const hit = r.commitCache.get(h);
  if (hit !== undefined) return hit;
  const o = readObj(r, h);
  if (o === null || o.type !== "commit") throw fatal(`bad object ${h}`);
  const end = o.data.indexOf("\n\n");
  const head = end < 0 ? o.data : o.data.slice(0, end);
  const c: Commit = { hash: h, tree: "", parents: [], author: parseIdent(""), committer: parseIdent(""), message: end < 0 ? "" : o.data.slice(end + 2) };
  for (const line of head.split("\n")) {
    const sp = line.indexOf(" ");
    const key = line.slice(0, sp);
    const val = line.slice(sp + 1);
    if (key === "tree") c.tree = val;
    else if (key === "parent") c.parents.push(val);
    else if (key === "author") c.author = parseIdent(val);
    else if (key === "committer") c.committer = parseIdent(val);
  }
  r.commitCache.set(h, c);
  return c;
}

export function commitTree(r: Repo, h: string | null | undefined): JsMap<string> {
  return h !== null && h !== undefined && h !== "" ? readTree(r, readCommit(r, h).tree) : new JsMap<string>();
}

export function subject(message: string | Commit): string {
  return (typeof message === "string" ? message : message.message).split("\n")[0]!;
}

const tagObjectRe = /^object ([0-9a-f]{40})/;

/** Follows annotated tags to the object they point at. */
export function peel(r: Repo, h: string): string {
  for (let i = 0; i < 10; i++) {
    const o = readObj(r, h);
    if (o === null || o.type !== "tag") return h;
    const m = tagObjectRe.exec(o.data);
    if (m) h = m[1]!;
  }
  return h;
}
