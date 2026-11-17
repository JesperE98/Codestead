// Port of Commands/Git/GitCmd.Json.cs – JavaScript object semantics (key order, Set) and JSON.stringify(x, null, 1),
// as in the TypeScript the C# was ported from. Here most of it is the language itself: a JsMap is a plain object
// without a prototype, a Set keeps insertion order and JSON.stringify writes the JSON.

/**
 * A plain JS object used as a map (Record<string, T>): missing keys read as null and keys iterate like
 * Object.keys (array-index keys first in numeric order, then insertion order). Without a prototype, so keys
 * such as "constructor" or "__proto__" are ordinary keys.
 */
export class JsMap<T> {
  private readonly d: Record<string, T> = Object.create(null) as Record<string, T>;

  get(key: string): T | null {
    return Object.hasOwn(this.d, key) ? this.d[key]! : null;
  }

  set(key: string, value: T): void {
    this.d[key] = value;
  }

  has(key: string): boolean {
    return Object.hasOwn(this.d, key);
  }

  delete(key: string): void {
    delete this.d[key];
  }

  get count(): number {
    return Object.keys(this.d).length;
  }

  get keys(): string[] {
    return Object.keys(this.d);
  }

  /** { ...this } */
  copy(): JsMap<T> {
    const c = new JsMap<T>();
    for (const k of this.keys) c.set(k, this.d[k]!);
    return c;
  }

  /** { ...this, ...other } */
  merge(other: JsMap<T>): JsMap<T> {
    const c = this.copy();
    for (const k of other.keys) c.set(k, other.get(k)!);
    return c;
  }

  /** The map as a plain object (for JSON.stringify), in key order. */
  toObject(): Record<string, T> {
    const o = Object.create(null) as Record<string, T>;
    for (const k of this.keys) o[k] = this.d[k]!;
    return o;
  }
}

/**
 * .NET's \s (and \S) as regex class contents: [\f\n\r\t\v\x85\p{Z}]. JavaScript's \s lacks \x85 (NEL) and has
 * \ufeff, which .NET does not count as white space. Use as `[${NetS}]` and `[^${NetS}]` where the C# regex had \s or \S.
 */
export const NetS = "\\t\\n\\v\\f\\r \\x85\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";

/** The order Object.keys gives for keys inserted in this order. */
export function jsKeyOrder(keys: Iterable<string>): string[] {
  const o = Object.create(null) as Record<string, true>;
  for (const k of keys) o[k] = true;
  return Object.keys(o);
}

/** new Set([...a, ...b]) – distinct values in first-seen order. */
export function union(...lists: Iterable<string>[]): string[] {
  const seen = new Set<string>();
  for (const l of lists) for (const x of l) seen.add(x);
  return [...seen];
}

/** The strings sorted ordinally (UTF-16 code units, the JavaScript default sort). */
export function sortedOrdinal(xs: Iterable<string>): string[] {
  return [...xs].sort();
}

/** JSON.stringify(v, null, 1). Null values in objects are left out (pass undefined for them). */
export function jsonStringify(v: unknown): string {
  return JSON.stringify(v, null, 1);
}

/** A tree (path → id) from a parsed JSON value: strings as they are, other non-null values as text. */
export function treeFromJson(e: unknown): JsMap<string> {
  const t = new JsMap<string>();
  if (e === null || typeof e !== "object" || Array.isArray(e)) return t;
  for (const [k, v] of Object.entries(e as Record<string, unknown>)) {
    if (typeof v === "string") t.set(k, v);
    // C# JsonElement.ToString(): the raw JSON text of a number, an object or an array, True/False for booleans.
    else if (typeof v === "boolean") t.set(k, v ? "True" : "False");
    else if (v !== null) t.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  return t;
}
