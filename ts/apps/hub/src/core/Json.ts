// Reading the catalog's JSON the way System.Text.Json does with Catalog.Json (camelCase names, case-sensitive,
// unknown properties ignored, missing ones keep their defaults, a value of the wrong type is an error).
// Writing: camelCase, nulls left out, indented (Catalog.Json's WhenWritingNull and WriteIndented).

/** A value of the wrong type (System.Text.Json's JsonException). */
export class JsonShapeError extends Error {
  constructor(path: string, expected: string) {
    super(`The JSON value at ${path} could not be converted to ${expected}.`);
    this.name = "JsonException";
  }
}

export type JsonObject = Readonly<Record<string, unknown>>;

export function isJsonObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** An object (a class in C#); `null` only where the C# property is nullable. */
export function readObject(v: unknown, path: string): JsonObject {
  if (!isJsonObject(v)) throw new JsonShapeError(path, "an object");
  return v;
}

/**
 * A string property. C#'s non-nullable strings are read strictly: null is refused here (System.Text.Json would store
 * the null and the hub would fail later with a NullReferenceException – refusing the catalog is the same outcome
 * without the crash).
 */
export function readString(o: JsonObject, name: string, path: string, fallback = ""): string {
  const v = o[name];
  if (v === undefined) return fallback;
  if (typeof v !== "string") throw new JsonShapeError(`${path}.${name}`, "System.String");
  return v;
}

export function readNullableString(o: JsonObject, name: string, path: string): string | null {
  const v = o[name];
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new JsonShapeError(`${path}.${name}`, "System.String");
  return v;
}

/** An integer property (int or long): a number without a fraction, as System.Text.Json requires. */
export function readInteger(o: JsonObject, name: string, path: string, fallback = 0): number {
  const v = o[name];
  if (v === undefined) return fallback;
  if (typeof v !== "number" || !Number.isInteger(v)) throw new JsonShapeError(`${path}.${name}`, "an integer");
  return v;
}

/** A Dictionary&lt;string, T&gt; property, in the file's order (a Map keeps it; integer-like keys would not in an object). */
export function readMap<T>(o: JsonObject, name: string, path: string, read: (v: unknown, path: string) => T): Map<string, T> {
  const v = o[name];
  const map = new Map<string, T>();
  if (v === undefined) return map;
  const obj = readObject(v, `${path}.${name}`);
  for (const [k, value] of Object.entries(obj)) map.set(k, read(value, `${path}.${name}.${k}`));
  return map;
}

/** A List&lt;T&gt; property (null when the C# property is nullable and the value is null or missing). */
export function readList<T>(v: unknown, path: string, read: (v: unknown, path: string) => T): T[] {
  if (!Array.isArray(v)) throw new JsonShapeError(path, "an array");
  return v.map((item, i) => read(item, `${path}[${i}]`));
}

/** Catalog.Json's way of writing: nulls left out, two-space indentation; Maps become objects. */
export function serializeIndented(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, v: unknown) => {
      if (v === null) return undefined;
      if (v instanceof Map) return Object.fromEntries(v);
      return v;
    },
    2,
  );
}
