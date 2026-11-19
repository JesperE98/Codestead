import { JsonShapeError, readList, readMap, readObject, readString } from "./Json.js";

// One version's changes in the catalog.

/** One version of a tool in the catalog's "changes": the changes per language code ("en" is always there). */
export class CatalogChange {
  version = "";
  date = "";
  changes = new Map<string, string[]>();

  constructor(init?: { version?: string; date?: string; changes?: Record<string, string[]> | Map<string, string[]> }) {
    if (!init) return;
    this.version = init.version ?? "";
    this.date = init.date ?? "";
    this.changes = init.changes instanceof Map ? new Map(init.changes) : new Map(Object.entries(init.changes ?? {}));
  }

  static fromJson(v: unknown, path: string): CatalogChange {
    const o = readObject(v, path);
    const c = new CatalogChange();
    c.version = readString(o, "version", path);
    c.date = readString(o, "date", path);
    c.changes = readMap(o, "changes", path, (lines, p) =>
      readList(lines, p, (line, lp) => {
        if (typeof line !== "string") throw new JsonShapeError(lp, "System.String");
        return line;
      }),
    );
    return c;
  }
}
