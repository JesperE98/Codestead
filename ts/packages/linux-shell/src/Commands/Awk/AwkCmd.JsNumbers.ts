// Port of Commands/Awk/AwkCmd.JsNumbers.cs – JavaScript number formatting used by awk output. The C# reproduced
// V8's formatting exactly; here it is the language's own (String(n), toFixed, toExponential, toPrecision,
// toString(radix)), so these are thin wrappers.

/** String(n) for any JS number. */
export function jsString(v: number): string {
  return String(v);
}

/**
 * n.toFixed(digits). JavaScript allows at most 100 digits; C# formatted any count, so more digits are written as
 * 100 digits followed by zeros (only reachable with %.101g and more).
 */
export function jsToFixed(x: number, f: number): string {
  if (f <= 100) return x.toFixed(f);
  const s = x.toFixed(100);
  return Number.isFinite(x) && Math.abs(x) < 1e21 ? s + "0".repeat(f - 100) : s;
}

/** n.toExponential(digits) */
export function jsToExponential(x: number, f: number): string {
  if (!Number.isFinite(x)) return jsString(x);
  return x.toExponential(f);
}

/** Number(n.toPrecision(p)) */
export function jsToPrecisionValue(x: number, p: number): number {
  return Number(x.toPrecision(p));
}

/** Math.round */
export function jsRound(x: number): number {
  return Math.round(x);
}

/** t.toString(radix) for a non-negative integer number. */
export function toRadix(t: number, radix: number): string {
  if (!Number.isFinite(t)) return jsString(t);
  if (radix === 10) return jsString(t);
  return t.toString(radix);
}

/** String.fromCodePoint for any number: "" outside the Unicode range, a lone surrogate as itself. */
export function fromCodePoint(cp: number): string {
  if (Number.isNaN(cp) || cp < 0 || cp > 0x10ffff) return "";
  const c = Math.trunc(cp);
  return c >= 0xd800 && c <= 0xdfff ? String.fromCharCode(c) : String.fromCodePoint(c);
}

/** s.toUpperCase() (also ß → SS). */
export function jsUpper(s: string): string {
  return s.toUpperCase();
}

/** s.toLowerCase() */
export function jsLower(s: string): string {
  return s.toLowerCase();
}
