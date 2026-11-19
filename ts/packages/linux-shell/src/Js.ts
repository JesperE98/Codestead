// Port of Js.cs. The C# helpers reproduced JavaScript semantics (slice, sort, Number(), String(n) ...) on .NET.
// In TypeScript most of them are the language itself (s.slice, arr.at, arr.sort, s.split ...) and are not
// repeated here; what is left is what has no direct JavaScript form or where the C# behaviour differs from the
// plain JavaScript one (toFixed, octal literals, the clock override for tests).

/** An ordered dictionary with string keys (C# OrderedDictionary&lt;string, T&gt; / a JavaScript object literal). */
export type Obj<T> = Map<string, T>;

const invariantCollator = new Intl.Collator("und");
const encoder = new TextEncoder();

/** BitDecrement(0.5): what .NET adds before truncating in Math.Round(..., MidpointRounding.AwayFromZero). */
const almostHalf = 0.49999999999999994;
const roundPower10 = [1, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15];

export const Js = {
  /**
   * Optional clock override for tests (milliseconds since the Unix epoch). C# kept it per async flow
   * (AsyncLocal); JavaScript runs one test at a time per worker, so a plain field is enough.
   */
  clockOverride: null as (() => number) | null,

  /** Date.now() (or the clock override). */
  now(): number {
    return Js.clockOverride?.() ?? Date.now();
  },

  /** new Date(ms): read it with the local getters (getHours(), getDate() ...), like C#'s local DateTime. */
  localDate(ms: number): Date {
    return new Date(ms);
  },

  /** new Date() in local time (respects the clock override). */
  localNow(): Date {
    return Js.localDate(Js.now());
  },

  /** "x".repeat(n), but "" for n &lt;= 0 (JavaScript throws for negative counts). */
  repeat(s: string, count: number): string {
    return count <= 0 ? "" : s.repeat(count);
  },

  /** [...s].length – number of Unicode code points. */
  codePointLength(s: string): number {
    return [...s].length;
  },

  /** new TextEncoder().encode(s).length */
  utf8Length(s: string): number {
    return encoder.encode(s).length;
  },

  /** string.Compare(a, b, CultureInfo.InvariantCulture): the root collation (ICU), not the ordinal order. */
  localeCompare(a: string, b: string): number {
    return invariantCollator.compare(a, b);
  },

  /** Ordinal (UTF-16 code unit) comparison: the JavaScript default sort and C# StringComparer.Ordinal. */
  ordinal(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
  },

  /** String(n) for a number (C# Js.Num). */
  num(n: number | bigint): string {
    return String(n);
  },

  /**
   * n.toFixed(digits) as the C# port did it: Math.Round(n, digits, MidpointRounding.AwayFromZero) and then
   * fixed-point formatting. (Plain JavaScript toFixed rounds the exact binary value, e.g. 1.45 → "1.4";
   * .NET scales first and gives "1.5".)
   */
  toFixed(n: number, digits: number): string {
    let v = n;
    if (Number.isFinite(v) && Math.abs(v) < 1e16 && digits < roundPower10.length) {
      const p = roundPower10[digits]!;
      v = Math.trunc(v * p + Math.sign(v) * almostHalf) / p;
    }
    // .NET keeps the sign of a negative number that rounds to zero ("-0.00").
    if (v === 0 && (n < 0 || Object.is(n, -0))) return "-" + (0).toFixed(digits);
    return v.toFixed(digits);
  },

  /** Number(s): the whole (trimmed) string must be numeric, "" is 0, otherwise NaN. Only decimal and 0x numbers. */
  number(s: string | null | undefined): number {
    if (s === null || s === undefined) return NaN;
    const t = s.trim();
    if (/^[+-]?0[bBoO]/.test(t)) return NaN;
    return Number(t);
  },

  /** parseInt(s, radix). */
  parseInt(s: string | null | undefined, radix = 10): number {
    if (s === null || s === undefined) return NaN;
    return Number.parseInt(s, radix);
  },

  /** parseFloat(s). */
  parseFloat(s: string | null | undefined): number {
    if (s === null || s === undefined) return NaN;
    return Number.parseFloat(s);
  },

  /** Octal literal: Js.oct(755) === 0o755 (kept so ported code reads like the C#, which has no octal literals). */
  oct(digits: number): number {
    return Number.parseInt(String(digits), 8);
  },

  /** Math.random() */
  random(): number {
    return Math.random();
  },

  /**
   * JSON.parse(JSON.stringify(x)) – a deep copy (Maps stay Maps). Like a JSON round trip, an object that occurs
   * twice (a hard link) becomes two separate copies.
   */
  clone<T>(value: T): T {
    return deepCopy(value) as T;
  },

  /** { ...obj } – a copy of an ordered dictionary, keeping insertion order. */
  copy<T>(d: Obj<T>): Obj<T> {
    return new Map(d);
  },

  /** An empty ordered dictionary (a JavaScript object literal {}). */
  obj<T>(): Obj<T> {
    return new Map<string, T>();
  },

  /** Two digits with a leading zero (C# format "00"). */
  pad2(n: number): string {
    return String(n).padStart(2, "0");
  },

  /** A local time as "HH:mm" (C# DateTime.ToString("HH:mm")). */
  hhmm(d: Date): string {
    return `${Js.pad2(d.getHours())}:${Js.pad2(d.getMinutes())}`;
  },

  /** A local time as "HH:mm:ss" (C# DateTime.ToString("HH:mm:ss")). */
  hhmmss(d: Date): string {
    return `${Js.hhmm(d)}:${Js.pad2(d.getSeconds())}`;
  },
};

function deepCopy(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  if (v instanceof Map) {
    const m = new Map<unknown, unknown>();
    for (const [k, x] of v) m.set(k, deepCopy(x));
    return m;
  }
  if (Array.isArray(v)) return v.map(deepCopy);
  const o: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    // JSON drops undefined values and functions.
    if (x === undefined || typeof x === "function") continue;
    o[k] = deepCopy(x);
  }
  return o;
}

/**
 * The classes of .NET regular expressions that differ from JavaScript's. .NET's \w and \d are Unicode (letters
 * and digits of every script); JavaScript's are ASCII. Use these (with the "u" flag) where the C# regex used
 * \w or \d and the difference can matter.
 */
export const NetRegex = {
  /** .NET \w: [\p{L}\p{Mn}\p{Nd}\p{Pc}] */
  w: String.raw`[\p{L}\p{Mn}\p{Nd}\p{Pc}]`,
  /** .NET \w inside a character class (without the brackets). */
  wInClass: String.raw`\p{L}\p{Mn}\p{Nd}\p{Pc}`,
  /** .NET \d: \p{Nd} */
  d: String.raw`\p{Nd}`,
};

/** char.IsWhiteSpace in .NET (Unicode White_Space): JavaScript's \s plus U+0085 (NEL), minus U+FEFF (the byte order mark). */
export function isWhiteSpace(c: string): boolean {
  return c === "\u0085" || (c !== "\uFEFF" && /^\s$/.test(c));
}

/** s.Trim() in .NET: like trim(), but the byte order mark is kept and U+0085 (NEL) is trimmed. */
export function netTrim(s: string): string {
  return s.replace(/^(?:[^\S\uFEFF]|\u0085)+|(?:[^\S\uFEFF]|\u0085)+$/g, "");
}
