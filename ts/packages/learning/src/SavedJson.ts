/**
 * Reading the saved files (state.json and the like), which the C# apps write with System.Text.Json (camelCase
 * property names, dictionary keys as they are, nulls left out; see Codestead.Common's JsonDefaults). A value of the
 * wrong type is read as missing, so the default is kept – the C# apps would not read such a file at all.
 *
 * C#'s OrderedDictionary&lt;string, T&gt; becomes a Map (insertion order, any key). JSON.parse puts integer-like keys
 * ("12") first in an object; no saved key (task, chapter, achievement ids) looks like that.
 */

export type JsonObject = Readonly<Record<string, unknown>>;

export function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function readString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** A whole number (C#'s int and long). */
export function readInt(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isInteger(v) ? v : fallback;
}

export function readBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function readStringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** A JSON object as an ordered map, with every value read by `read` (values it cannot read are left out). */
export function readMap<T>(v: unknown, read: (x: unknown) => T | null): Map<string, T> {
  const map = new Map<string, T>();
  if (!isObject(v)) return map;
  for (const [key, raw] of Object.entries(v)) {
    const value = read(raw);
    if (value !== null) map.set(key, value);
  }
  return map;
}

export const readIntOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) ? v : null);
export const readBoolOrNull = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/** An ordered map as a JSON object (for toJSON). */
export function mapToJson<T>(map: ReadonlyMap<string, T>): Record<string, T> {
  const o: Record<string, T> = {};
  for (const [k, v] of map) o[k] = v;
  return o;
}
