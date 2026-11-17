// Port of Commands/Archive/ArchiveCmd.cs (src/shell/commands/archive.ts) – archives and compression: tar, gzip,
// gunzip, zcat, zip and unzip – plus du, which shows how much space files and directories take.
//
// The archives are ordinary strings in the virtual file system:
//
//     MARKER NUL pretend-size NUL encoded-content
//
// The content is JSON (paths, type, permissions, owner, time and file content) encoded with
// base64 and a substituted alphabet, so that `cat archive.tar` looks like binary garbage. The
// pretend size (shown by ls -l and du) is a simple estimate of how well deflate – the algorithm
// in gzip and zip – would have compressed the content. The markers are recognised by
// VfsLib.nodeSize().

import { Js } from "../../Js.js";
import * as ParserLib from "../../Parser/ParserLib.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import type { User } from "../../Vfs/User.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as AwkCmd from "../Awk/AwkCmd.js";
import { unwrap, wrap } from "./ArchiveCmd.Encoding.js";
import { du } from "./ArchiveCmd.Du.js";
import { gunzip, gzip, zcat } from "./ArchiveCmd.Gzip.js";
import { entriesJson, gzJson, isJsonObject, jNum, jStr, readEntries } from "./ArchiveCmd.Json.js";
import { compressedEntrySize, entrySize, gzSize, tarSize, zipSize } from "./ArchiveCmd.Sizes.js";
import { tar } from "./ArchiveCmd.Tar.js";
import { unzip } from "./ArchiveCmd.Unzip.js";
import { zip } from "./ArchiveCmd.Zip.js";
import type { ArchiveEntry } from "./ArchiveEntry.js";
import type { GzPayload } from "./GzPayload.js";

export type { ArchiveEntry } from "./ArchiveEntry.js";
export type { GzPayload } from "./GzPayload.js";
export * from "./ArchiveCmd.Du.js";
export * from "./ArchiveCmd.Encoding.js";
export * from "./ArchiveCmd.Gzip.js";
export * from "./ArchiveCmd.Json.js";
export * from "./ArchiveCmd.Sizes.js";
export * from "./ArchiveCmd.Tar.js";
export * from "./ArchiveCmd.Unzip.js";
export * from "./ArchiveCmd.Zip.js";

export const TarMagic = "\u0000SIMTAR1";
export const GzMagic = "\u001f\u008b\u0008SIMGZ1";
export const ZipMagic = "PK\u0003\u0004SIMZIP1";

// ---------------------------------------------------------------- format

export function makeTar(entries: ArchiveEntry[]): string {
  return wrap(TarMagic, tarSize(entries), entriesJson(entries));
}

export function readTar(content: string): ArchiveEntry[] | null {
  return readEntries(TarMagic, content);
}

export function gzipString(data: string, name: string | null = null, size: number | null = null): string {
  const p: GzPayload = { d: data };
  if (name !== null && name !== "") p.n = name;
  if (size !== null) p.s = size;
  return wrap(GzMagic, gzSize(p), gzJson(p));
}

export function gunzipString(content: string): GzPayload | null {
  const root = unwrap(GzMagic, content);
  if (!isJsonObject(root)) return null;
  const d = jStr(root, "d");
  if (d === null) return null;
  const payload: GzPayload = { d };
  const n = jStr(root, "n");
  if (n !== null) payload.n = n;
  const s = jNum(root, "s");
  if (s !== null) payload.s = Math.trunc(s);
  return payload;
}

export function makeZip(entries: ArchiveEntry[]): string {
  return wrap(ZipMagic, zipSize(entries), entriesJson(entries));
}

export function readZip(content: string): ArchiveEntry[] | null {
  return readEntries(ZipMagic, content);
}

/** Reads an archive in any format (used among other things by the tasks' checks). Format: "tar", "tar.gz" or "zip". */
export function readArchive(content: string): { format: string; entries: ArchiveEntry[] } | null {
  const tarEntries = readTar(content);
  if (tarEntries !== null) return { format: "tar", entries: tarEntries };
  const zipEntries = readZip(content);
  if (zipEntries !== null) return { format: "zip", entries: zipEntries };
  const gz = gunzipString(content);
  const inner = gz !== null ? readTar(gz.d) : null;
  return inner !== null ? { format: "tar.gz", entries: inner } : null;
}

// ---------------------------------------------------------------- helpers

export function joinPath(dir: string, name: string): string {
  return dir === "/" ? `/${name}` : `${dir}/${name}`;
}

/** How tar and zip show an entry: directories get a trailing /. */
export function entryLabel(e: ArchiveEntry): string {
  return e.type === "dir" ? `${e.path}/` : e.path;
}

export function isoDate(ms: number): string {
  const d = Js.localDate(ms);
  return `${d.getFullYear()}-${Js.pad2(d.getMonth() + 1)}-${Js.pad2(d.getDate())} ${Js.pad2(d.getHours())}:${Js.pad2(d.getMinutes())}`;
}

export function sortedChildren(node: FsNode): string[] {
  return [...(node.children?.keys() ?? [])].sort();
}

export interface WalkHandlers {
  add: (e: ArchiveEntry) => void;
  error: (name: string, message: string) => void;
  /** True = skip (e.g. the archive file itself). */
  skip?: ((abs: string, name: string) => boolean) | null;
}

/** Walks a file or directory and turns it into archive entries. */
export function walkTree(user: User, node: FsNode, abs: string, name: string, recursive: boolean, h: WalkHandlers): void {
  if (h.skip?.(abs, name) === true) return;
  const mode = node.mode & Js.oct(7777);
  if (node.type === "link") {
    // Archives keep symbolic links as links (they are not followed).
    h.add({ path: name, type: "link", mode, owner: node.owner, group: node.group, mtime: node.mtime, content: node.content ?? "" });
    return;
  }
  if (node.type === "file") {
    if (!VfsLib.hasPerm(node, user, "r")) {
      h.error(name, "Permission denied");
      return;
    }
    const e: ArchiveEntry = { path: name, type: "file", mode, owner: node.owner, group: node.group, mtime: node.mtime, content: node.content ?? "" };
    if (node.size !== null && node.size !== undefined) e.size = node.size;
    h.add(e);
    return;
  }
  // The name '' means the root directory (tar -cf x.tar /): it is not added itself.
  if (name !== "") h.add({ path: name, type: "dir", mode, owner: node.owner, group: node.group, mtime: node.mtime });
  if (!recursive) return;
  if (!VfsLib.hasPerm(node, user, "r") || !VfsLib.hasPerm(node, user, "x")) {
    h.error(name !== "" ? name : "/", "Permission denied");
    return;
  }
  for (const child of sortedChildren(node))
    walkTree(user, node.children!.get(child)!, joinPath(abs, child), name === "" ? child : `${name}/${child}`, recursive, h);
}

/** Turns a path in an archive into safe segments (no .. or absolute paths). */
function safeSegments(path: string): string[] | null {
  const segs = path.split("/").filter((s) => s !== "" && s !== ".");
  return segs.includes("..") ? null : segs;
}

export interface ExtractOptions {
  /** Keep the owner from the archive (only root can). */
  keepOwner: boolean;
  /** Bits removed from the permissions (umask). */
  umask: number;
  /** Called before an entry is extracted (with what is already there). Returns false to skip it. */
  before?: ((e: ArchiveEntry, existing: FsNode | null) => boolean) | null;
  /** (entry, "file" | "dir", message) */
  error: (e: ArchiveEntry, what: string, message: string) => void;
}

/** Extracts entries under the directory base. Returns false if something went wrong. */
export function extractEntries(ctx: CmdCtx, entries: ArchiveEntry[], base: string, opts: ExtractOptions): boolean {
  const sh = ctx.sh;
  const user = sh.currentUser();
  let ok = true;
  // The directories' permissions are set last, so that a read-only directory can still be filled.
  const dirFixes: { node: FsNode; e: ArchiveEntry }[] = [];
  const ownerOf = (e: ArchiveEntry): { owner: string; group: string | null } =>
    opts.keepOwner ? { owner: e.owner, group: e.group } : { owner: user.name, group: user.groups[0] ?? null };
  const modeOf = (e: ArchiveEntry): number => e.mode & (user.uid === 0 ? Js.oct(7777) : Js.oct(777)) & ~opts.umask;

  for (const e of entries) {
    const segs = safeSegments(e.path);
    if (segs === null) {
      opts.error(e, e.type, "Member name contains ..");
      ok = false;
      continue;
    }
    if (segs.length === 0) continue; // the entry "./" – the directory we extract into
    const abs = segs.reduce(joinPath, base);
    const existing = e.type === "link" ? sh.vfs.tryLookupLink(abs, user) : sh.vfs.tryLookup(abs, user);
    if (opts.before && !opts.before(e, existing)) continue;
    try {
      // Missing parent directories are created silently, just like tar and unzip do.
      let cur = base;
      for (const seg of segs.slice(0, -1)) {
        cur = joinPath(cur, seg);
        const n = sh.vfs.tryLookup(cur, user);
        if (n === null) sh.vfs.mkdir(cur, user);
        else if (n.type !== "dir") throw new FsError("ENOTDIR");
      }
      if (e.type === "dir") {
        if (existing !== null && existing.type !== "dir") throw new FsError("EEXIST");
        if (existing === null) sh.vfs.mkdir(abs, user);
        const node = sh.vfs.lookup(abs, user);
        if (existing === null || user.uid === 0 || node.owner === user.name) dirFixes.push({ node, e });
      } else if (e.type === "link") {
        if (existing?.type === "dir") throw new FsError("EISDIR");
        const { owner, group } = ownerOf(e);
        const link = VfsLib.makeLink(e.content ?? "", owner, group);
        link.mtime = e.mtime;
        sh.vfs.insert(abs, link, user);
      } else {
        if (existing?.type === "dir") throw new FsError("EISDIR");
        const { owner, group } = ownerOf(e);
        const node = VfsLib.makeFile(e.content ?? "", owner, modeOf(e), group);
        node.mtime = e.mtime;
        if (e.size !== null && e.size !== undefined) node.size = e.size;
        sh.vfs.insert(abs, node, user);
      }
    } catch (err) {
      if (!(err instanceof FsError)) throw err;
      opts.error(e, e.type, err.message);
      ok = false;
    }
  }
  dirFixes.reverse();
  for (const { node, e } of dirFixes) {
    node.mode = modeOf(e);
    node.mtime = e.mtime;
    if (opts.keepOwner) {
      const { owner, group } = ownerOf(e);
      node.owner = owner;
      node.group = group ?? owner;
    }
  }
  return ok;
}

export const leadingDotSlashRe = /^(\.\/)+/;
export const trailingSlashesRe = /\/+$/;
export const leadingSlashesRe = /^\/+/;

/** Filters entries by the names the student gave (exact names, directories or wildcards). */
export function selectEntries(entries: ArchiveEntry[], patterns: string[]): { selected: ArchiveEntry[]; missing: string[] } {
  if (patterns.length === 0) return { selected: entries, missing: [] };
  const missing: string[] = [];
  const matchers = patterns.map((p) => {
    const clean = p.replace(leadingDotSlashRe, "").replace(trailingSlashesRe, "");
    const re = ParserLib.globToRegex(clean);
    return (path: string): boolean => path === clean || path.startsWith(clean + "/") || re.test(path);
  });
  for (let i = 0; i < matchers.length; i++) if (!entries.some((e) => matchers[i]!(e.path))) missing.push(patterns[i]!);
  return { selected: entries.filter((e) => matchers.some((m) => m(e.path))), missing };
}

// ---------------------------------------------------------------- zip and unzip

export function zipMethod(e: ArchiveEntry): string {
  const size = entrySize(e);
  if (e.type === "dir" || size === 0) return "stored 0%";
  const pct = AwkCmd.jsRound((1 - compressedEntrySize(e) / size) * 100);
  return pct > 0 ? `deflated ${Js.num(pct)}%` : "stored 0%";
}

/** The group's commands, in the C# order. */
export function all(): CommandDef[] {
  return [tar, gzip, gunzip, zcat, zip, unzip, du];
}
