// JSON for the saved computer (no C# file of its own: C# used System.Text.Json through Js.Stringify/Js.Parse
// with Codestead.Common.JsonDefaults). The in-memory model keeps ordered dictionaries as Maps, which JSON.stringify
// cannot write, and JSON.parse puts keys that look like array indexes ("2024") first in an object – so a directory
// with such a file would change order. These two functions write and read the same JSON as the C# app:
// camelCase names (the model already uses them), null values left out, and the members listed in
// `omitWhenFalse` left out when false (JsonIgnoreCondition.WhenWritingDefault in C#).

/** The order of the keys of an object read by parseJson (a JSON object can be an ordered dictionary). */
export const keyOrder: unique symbol = Symbol("keyOrder");

/** An object read by parseJson. */
export type JsonObject = { [key: string]: unknown; [keyOrder]?: string[] };

const omitWhenFalse = new Set(["swapActive", "system"]);

/** JSON.stringify(x) with C#'s rules: Maps are objects in insertion order, null and undefined are left out. */
export function stringifyJson(value: unknown): string {
  const out: string[] = [];
  write(value, out);
  return out.join("");
}

function write(v: unknown, out: string[]): void {
  if (v === null || v === undefined) {
    out.push("null");
  } else if (typeof v === "string") {
    out.push(JSON.stringify(v));
  } else if (typeof v === "number") {
    out.push(Number.isFinite(v) ? JSON.stringify(v) : "null");
  } else if (typeof v === "boolean") {
    out.push(v ? "true" : "false");
  } else if (typeof v === "bigint") {
    out.push(v.toString());
  } else if (Array.isArray(v)) {
    out.push("[");
    v.forEach((x, i) => {
      if (i > 0) out.push(",");
      write(x, out);
    });
    out.push("]");
  } else if (v instanceof Map) {
    out.push("{");
    let first = true;
    for (const [k, x] of v) {
      if (!first) out.push(",");
      first = false;
      out.push(JSON.stringify(String(k)), ":");
      write(x, out);
    }
    out.push("}");
  } else if (typeof v === "object") {
    out.push("{");
    let first = true;
    for (const [k, x] of Object.entries(v)) {
      if (x === null || x === undefined || typeof x === "function") continue;
      if (x === false && omitWhenFalse.has(k)) continue;
      if (!first) out.push(",");
      first = false;
      out.push(JSON.stringify(k), ":");
      write(x, out);
    }
    out.push("}");
  } else {
    out.push("null");
  }
}

/** JSON.parse(s), but every object remembers the order of its keys (see keyOrder). Throws SyntaxError. */
export function parseJson(text: string): unknown {
  let i = 0;
  const fail = (): never => {
    throw new SyntaxError(`Unexpected token in JSON at position ${i}`);
  };
  const ws = (): void => {
    while (i < text.length) {
      const c = text.charCodeAt(i);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) i++;
      else break;
    }
  };
  const str = (): string => {
    // Find the end of the string, then let JSON.parse decode the escapes.
    const start = i;
    i++;
    for (;;) {
      if (i >= text.length) fail();
      const c = text[i];
      if (c === "\\") i += 2;
      else if (c === '"') break;
      else i++;
    }
    i++;
    return JSON.parse(text.slice(start, i)) as string;
  };
  const val = (): unknown => {
    ws();
    const c = text[i];
    if (c === "{") {
      i++;
      const o: JsonObject = {};
      const order: string[] = [];
      ws();
      if (text[i] === "}") {
        i++;
      } else {
        for (;;) {
          ws();
          if (text[i] !== '"') fail();
          const k = str();
          ws();
          if (text[i] !== ":") fail();
          i++;
          const x = val();
          if (!Object.hasOwn(o, k)) order.push(k);
          // defineProperty: a key named "__proto__" must be an ordinary key.
          Object.defineProperty(o, k, { value: x, enumerable: true, writable: true, configurable: true });
          ws();
          if (text[i] === ",") {
            i++;
            continue;
          }
          if (text[i] === "}") {
            i++;
            break;
          }
          fail();
        }
      }
      Object.defineProperty(o, keyOrder, { value: order, enumerable: false });
      return o;
    }
    if (c === "[") {
      i++;
      const a: unknown[] = [];
      ws();
      if (text[i] === "]") {
        i++;
        return a;
      }
      for (;;) {
        a.push(val());
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") {
          i++;
          return a;
        }
        fail();
      }
    }
    if (c === '"') return str();
    const m = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i, i + 64));
    if (!m) return fail();
    i += m[0].length;
    return m[0] === "true" ? true : m[0] === "false" ? false : m[0] === "null" ? null : Number(m[0]);
  };
  const result = val();
  ws();
  if (i !== text.length) fail();
  return result;
}

/** A JSON object read by parseJson as an ordered dictionary (in the order it was written). */
export function toMap<T>(o: unknown, revive: (v: unknown) => T = (v) => v as T): Map<string, T> {
  const map = new Map<string, T>();
  if (o === null || typeof o !== "object") return map;
  const obj = o as JsonObject;
  for (const k of obj[keyOrder] ?? Object.keys(obj)) map.set(k, revive(obj[k]));
  return map;
}
