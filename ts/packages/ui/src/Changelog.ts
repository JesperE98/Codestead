import { ChangelogEntry } from "./ChangelogEntry.js";
import { loadJson, saveJson, type Storage } from "./Storage.js";
import { isObject, readString } from "@codestead/learning";

/** A version major.minor.patch (C#'s System.Version with three parts). */
export type Version = readonly [number, number, number];

export function compareVersions(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

const seenFile = "whatsnew";

/**
 * What changed in each version of a product (changelog/&lt;product-id&gt;.json, newest first). Each app
 * embeds its own changelog and shows the news after an update; the hub's catalog carries the tools' news.
 */
export const Changelog = {
  /** Parses a changelog; an unreadable one is empty (the news are a nicety, never an error). */
  parse(json: string | null | undefined): ChangelogEntry[] {
    if (json == null || json.trim() === "") return [];
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return [];
    }
    if (!Array.isArray(raw)) return [];
    const entries = raw.map((e) => ChangelogEntry.fromJson(e)).filter((e): e is ChangelogEntry => e !== null && Changelog.parseVersion(e.version) !== null);
    // Array.prototype.sort is stable, like OrderByDescending.
    return entries.sort((a, b) => compareVersions(Changelog.parseVersion(b.version)!, Changelog.parseVersion(a.version)!));
  },

  /** "0.5.4" → [0, 5, 4]; null if it is not major.minor.patch. */
  parseVersion(v: string | null | undefined): Version | null {
    const parts = (v ?? "").split(/[-+]/)[0]!.split(".");
    if (parts.length !== 3) return null;
    const n: number[] = [];
    for (const p of parts) {
      // int.TryParse with NumberStyles.None: digits only, and it must fit in an int.
      if (!/^\d+$/.test(p)) return null;
      const value = Number(p);
      if (value > 2147483647) return null;
      n.push(value);
    }
    return [n[0]!, n[1]!, n[2]!];
  },

  /** The entries after `fromExclusive` up to and including `toInclusive`, newest first. */
  between(entries: Iterable<ChangelogEntry>, fromExclusive: string | null, toInclusive: string): ChangelogEntry[] {
    const from = Changelog.parseVersion(fromExclusive);
    const to = Changelog.parseVersion(toInclusive);
    if (to === null) return [];
    return [...entries].filter((e) => {
      const v = Changelog.parseVersion(e.version);
      return v !== null && compareVersions(v, to) <= 0 && (from === null || compareVersions(v, from) > 0);
    });
  },

  // ---------- "Seen" version per product ----------

  /** The newest version whose news the user has seen (in that product's own storage). */
  seen(storage: Storage): string | null {
    const s = loadJson(storage, seenFile);
    return isObject(s) ? readString(s.seen) : null;
  },

  markSeen(storage: Storage, version: string): void {
    saveJson(storage, seenFile, { seen: version });
  },

  /**
   * What to show at start: the news since the version the user saw last, when the app has been updated.
   * `existingUser` tells a first installation (nothing to show) from an update from a version older than this
   * feature (show the current version's news). Marks the current version as seen.
   */
  newsAtStart(storage: Storage, entries: readonly ChangelogEntry[], currentVersion: string, existingUser: boolean): ChangelogEntry[] {
    const seen = Changelog.seen(storage);
    let news: ChangelogEntry[] = [];
    const current = Changelog.parseVersion(currentVersion);
    if (current === null || compareVersions(current, [0, 0, 0]) === 0) return news; // a development build
    if (seen === null) {
      if (existingUser) news = Changelog.between(entries, null, currentVersion).slice(0, 1);
    } else {
      const s = Changelog.parseVersion(seen);
      if (s !== null && compareVersions(s, current) < 0) news = Changelog.between(entries, seen, currentVersion);
    }
    if (seen !== currentVersion) Changelog.markSeen(storage, currentVersion);
    return news;
  },
};
