import { isObject, readString } from "@codestead/learning";

// One version in a changelog.

/** One version in a changelog: what changed, per language. */
export class ChangelogEntry {
  version = "";
  /** The release date, yyyy-MM-dd. */
  date = "";
  /** The changes per language code ("en" is required), one short markdown line each. */
  changes = new Map<string, string[]>();

  constructor(init?: { version?: string; date?: string; changes?: Record<string, string[]> }) {
    if (!init) return;
    this.version = init.version ?? "";
    this.date = init.date ?? "";
    this.changes = new Map(Object.entries(init.changes ?? {}));
  }

  /** The changes in a language, or in English when the language has none. */
  changesFor(lang: string): string[] {
    const c = this.changes.get(lang);
    if (c && c.length > 0) return c;
    return this.changes.get("en") ?? [];
  }

  /** Reads one entry of changelog/&lt;product&gt;.json; null when it is not an object. */
  static fromJson(v: unknown): ChangelogEntry | null {
    if (!isObject(v)) return null;
    const e = new ChangelogEntry();
    e.version = readString(v.version) ?? "";
    e.date = readString(v.date) ?? "";
    if (isObject(v.changes))
      for (const [lang, lines] of Object.entries(v.changes))
        if (Array.isArray(lines)) e.changes.set(lang, lines.filter((l): l is string => typeof l === "string"));
    return e;
  }

  toJSON(): Record<string, unknown> {
    return { version: this.version, date: this.date, changes: Object.fromEntries(this.changes) };
  }
}
