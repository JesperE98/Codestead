// Port of Commands/Git/GitCmd.Index.cs – the index (staging area).

import { gpath, readText, writeText, type Repo } from "./GitCmd.Files.js";
import { JsMap, jsonStringify, sortedOrdinal, treeFromJson } from "./GitCmd.Json.js";
import { fatal } from "./GitCmd.js";

export interface Unmerged {
  base: string | null;
  ours: string | null;
  theirs: string | null;
}

export interface Index {
  entries: JsMap<string>;
  /** Files with a conflict after a merge, with the three versions. */
  unmerged: JsMap<Unmerged>;
}

export function newIndex(entries: JsMap<string> = new JsMap<string>()): Index {
  return { entries, unmerged: new JsMap<Unmerged>() };
}

export function readIndex(r: Repo): Index {
  const text = readText(r.g, gpath(r, "index"));
  if (text === null || text === "") return newIndex();
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    throw fatal("index file corrupt");
  }
  if (root === null || typeof root !== "object" || Array.isArray(root)) throw fatal("index file corrupt");
  const o = root as Record<string, unknown>;
  const idx = newIndex();
  if (Object.hasOwn(o, "entries")) idx.entries = treeFromJson(o["entries"]);
  const unmerged = Object.hasOwn(o, "unmerged") ? o["unmerged"] : undefined;
  if (unmerged !== null && typeof unmerged === "object" && !Array.isArray(unmerged)) {
    for (const [name, value] of Object.entries(unmerged as Record<string, unknown>)) {
      const str = (k: string): string | null => {
        if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
        const v = Object.hasOwn(value, k) ? (value as Record<string, unknown>)[k] : undefined;
        return typeof v === "string" ? v : null;
      };
      idx.unmerged.set(name, { base: str("base"), ours: str("ours"), theirs: str("theirs") });
    }
  }
  return idx;
}

export function writeIndex(r: Repo, idx: Index): void {
  // Keys sorted, then in JavaScript object order (array-index keys first); null values are left out.
  const sorted = <T>(o: JsMap<T>, conv: (v: T) => unknown): Record<string, unknown> => {
    const res = Object.create(null) as Record<string, unknown>;
    for (const k of sortedOrdinal(o.keys)) res[k] = conv(o.get(k)!);
    return res;
  };
  const json = {
    version: 1,
    entries: sorted(idx.entries, (h) => h),
    unmerged: sorted(idx.unmerged, (u) => ({ base: u.base ?? undefined, ours: u.ours ?? undefined, theirs: u.theirs ?? undefined })),
  };
  writeText(r.g, gpath(r, "index"), jsonStringify(json) + "\n");
}
