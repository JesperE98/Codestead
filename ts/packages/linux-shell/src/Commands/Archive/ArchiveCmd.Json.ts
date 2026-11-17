// Port of Commands/Archive/ArchiveCmd.Json.cs – the archive contents as JSON, exactly like JSON.stringify.

import { Js } from "../../Js.js";
import type { ArchiveEntry } from "./ArchiveEntry.js";
import { unwrap } from "./ArchiveCmd.Encoding.js";
import type { GzPayload } from "./GzPayload.js";

function entryJson(e: ArchiveEntry): string {
  let sb = `{"path":${JSON.stringify(e.path)},"type":${JSON.stringify(e.type)},"mode":${Js.num(e.mode)}`;
  sb += `,"owner":${JSON.stringify(e.owner)},"group":${JSON.stringify(e.group)},"mtime":${Js.num(e.mtime)}`;
  if (e.content !== null && e.content !== undefined) sb += `,"content":${JSON.stringify(e.content)}`;
  if (e.size !== null && e.size !== undefined) sb += `,"size":${Js.num(e.size)}`;
  return sb + "}";
}

export function entriesJson(entries: ArchiveEntry[]): string {
  return `{"entries":[${entries.map(entryJson).join(",")}]}`;
}

export function gzJson(p: GzPayload): string {
  let sb = `{"d":${JSON.stringify(p.d)}`;
  if (p.n !== null && p.n !== undefined) sb += `,"n":${JSON.stringify(p.n)}`;
  if (p.s !== null && p.s !== undefined) sb += `,"s":${Js.num(p.s)}`;
  return sb + "}";
}

/** A JSON object (not an array or null). */
export function isJsonObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function jStr(o: Record<string, unknown>, name: string): string | null {
  const v = Object.hasOwn(o, name) ? o[name] : undefined;
  return typeof v === "string" ? v : null;
}

export function jNum(o: Record<string, unknown>, name: string): number | null {
  const v = Object.hasOwn(o, name) ? o[name] : undefined;
  return typeof v === "number" ? v : null;
}

export function readEntries(magic: string, content: string): ArchiveEntry[] | null {
  const root = unwrap(magic, content);
  if (!isJsonObject(root)) return null;
  const arr = Object.hasOwn(root, "entries") ? root["entries"] : undefined;
  if (!Array.isArray(arr)) return null;
  const list: ArchiveEntry[] = [];
  for (const el of arr as unknown[]) {
    if (!isJsonObject(el)) continue;
    const e: ArchiveEntry = {
      path: jStr(el, "path") ?? "",
      type: jStr(el, "type") ?? "file",
      mode: Math.trunc(jNum(el, "mode") ?? 0),
      owner: jStr(el, "owner") ?? "",
      group: jStr(el, "group") ?? "",
      mtime: Math.trunc(jNum(el, "mtime") ?? 0),
      content: jStr(el, "content"),
    };
    const size = jNum(el, "size");
    if (size !== null) e.size = Math.trunc(size);
    list.push(e);
  }
  return list;
}
