// The parts of .NET's number and text semantics the C# simulator relies on, so the port computes exactly what the C#
// code computes: Math.Round (to even), saturating float-to-integer casts (.NET 9+), 64-bit integer operators, the
// char classes, double.Parse / int.Parse (invariant culture) and the number formats ("0.###", "G6", "F6", "e6").

// ---------- rounding and casts ----------

/** Math.Round(x): to the nearest integer, a tie to the even one (MidpointRounding.ToEven). */
export function roundEven(x: number): number {
  if (!Number.isFinite(x)) return x;
  const r = Math.round(x);
  // Math.round rounds ties up; a tie (x.5) goes to the even neighbour instead.
  if (Math.abs(x - Math.trunc(x)) === 0.5) return 2 * Math.round(x / 2);
  return r;
}

/** (int)x for a double: the fraction cut off, NaN 0, out of range saturated (.NET 9 and later). */
export function toInt(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x >= 2147483647) return 2147483647;
  if (x <= -2147483648) return -2147483648;
  return Math.trunc(x) | 0;
}

/** (uint)x for a double: saturated to 0 … 4294967295, NaN 0. */
export function toUint(x: number): number {
  if (Number.isNaN(x) || x <= 0) return 0;
  if (x >= 4294967295) return 4294967295;
  return Math.trunc(x);
}

const LongMax = 9223372036854775807n;
const LongMin = -9223372036854775808n;

/** (long)x for a double, as a bigint: the fraction cut off, NaN 0, saturated. */
export function toLongBig(x: number): bigint {
  if (Number.isNaN(x)) return 0n;
  if (x >= 9223372036854775807) return LongMax;
  if (x <= -9223372036854775808) return LongMin;
  return BigInt(Math.trunc(x));
}

/** (long)x for a double, as a number (exact while |x| < 2^53, which is every value the simulator meets). */
export function toLong(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x >= 9223372036854775807) return 9223372036854775807;
  if (x <= -9223372036854775808) return -9223372036854775808;
  return Math.trunc(x);
}

/** (byte)x for a double: saturated to 0 … 255, NaN 0. */
export function toByte(x: number): number {
  if (Number.isNaN(x) || x <= 0) return 0;
  if (x >= 255) return 255;
  return Math.trunc(x);
}

/** (char)(int)x: the low 16 bits of the saturated int. */
export function toChar(x: number): string {
  return String.fromCharCode(toInt(x) & 0xffff);
}

/** Math.Clamp: NaN stays NaN; min &gt; max throws, as in .NET. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) throw new Error(`'${min}' cannot be greater than ${max}.`);
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Math.Sign(double): -1, 0 or 1; NaN throws (ArithmeticException in .NET). */
export function sign(x: number): number {
  if (Number.isNaN(x)) throw new Error("Function does not accept floating point Not-a-Number values.");
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

/** Integer division of two C# ints (or longs): truncated toward zero. */
export function idiv(a: number, b: number): number {
  if (b === 0) throw new Error("Attempted to divide by zero.");
  return Math.trunc(a / b);
}

// ---------- 64-bit integer operators of the shader runner ----------

const Int32Min = -2147483648;
const Int32Max = 2147483647;
const inInt32 = (x: number): boolean => x >= Int32Min && x <= Int32Max;

/** (long)x &amp; (long)y, as a double. */
export function and64(x: number, y: number): number {
  const a = toLong(x), b = toLong(y);
  if (inInt32(a) && inInt32(b)) return a & b;
  return Number(BigInt.asIntN(64, toLongBig(x) & toLongBig(y)));
}

/** (long)x | (long)y, as a double. */
export function or64(x: number, y: number): number {
  const a = toLong(x), b = toLong(y);
  if (inInt32(a) && inInt32(b)) return a | b;
  return Number(BigInt.asIntN(64, toLongBig(x) | toLongBig(y)));
}

/** (long)x ^ (long)y, as a double. */
export function xor64(x: number, y: number): number {
  const a = toLong(x), b = toLong(y);
  if (inInt32(a) && inInt32(b)) return a ^ b;
  return Number(BigInt.asIntN(64, toLongBig(x) ^ toLongBig(y)));
}

/** (uint)((long)x &lt;&lt; (int)y): the shift count masked to 6 bits, the low 32 bits kept, unsigned. */
export function shl32(x: number, y: number): number {
  const s = toInt(y) & 63;
  if (s >= 32) return 0;
  const big = toLongBig(x);
  return Number(BigInt.asUintN(32, big << BigInt(s)));
}

/** (long)x &gt;&gt; (int)y: an arithmetic shift of the 64-bit value (count masked to 6 bits). */
export function sar64(x: number, y: number): number {
  const s = toInt(y) & 63;
  return Number(toLongBig(x) >> BigInt(s));
}

/** (uint)~(long)x. */
export function notU32(x: number): number {
  return Number(BigInt.asUintN(32, ~toLongBig(x)));
}

// ---------- characters (System.Char) ----------

const digitRe = /^\p{Nd}$/u;
const letterRe = /^\p{L}$/u;
const upperRe = /^\p{Lu}$/u;

/** char.IsDigit: a Unicode decimal digit. */
export function isDigit(c: string | undefined): boolean {
  if (c === undefined) return false;
  const code = c.charCodeAt(0);
  if (code < 128) return code >= 48 && code <= 57;
  return digitRe.test(c);
}

/** char.IsLetter. */
export function isLetter(c: string | undefined): boolean {
  if (c === undefined) return false;
  const code = c.charCodeAt(0);
  if (code < 128) return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
  return letterRe.test(c);
}

/** char.IsLetterOrDigit. */
export function isLetterOrDigit(c: string | undefined): boolean {
  return isLetter(c) || isDigit(c);
}

/** char.IsUpper. */
export function isUpper(c: string | undefined): boolean {
  if (c === undefined) return false;
  const code = c.charCodeAt(0);
  if (code < 128) return code >= 65 && code <= 90;
  return upperRe.test(c);
}

/** char.IsWhiteSpace (JavaScript's \s, but U+FEFF is not white space in .NET and U+0085 is). */
export function isWhiteSpace(c: string | undefined): boolean {
  if (c === undefined) return false;
  const code = c.charCodeAt(0);
  if (code === 32 || (code >= 9 && code <= 13)) return true;
  if (code < 128) return false;
  if (code === 0xfeff) return false;
  return code === 0x85 || /\s/.test(c);
}

/** Uri.IsHexDigit. */
export function isHexDigit(c: string | undefined): boolean {
  return c !== undefined && /^[0-9a-fA-F]$/.test(c);
}

/** string.Trim() with the .NET white space. */
export function trimNet(s: string): string {
  let a = 0, b = s.length;
  while (a < b && isWhiteSpace(s[a])) a++;
  while (b > a && isWhiteSpace(s[b - 1])) b--;
  return s.slice(a, b);
}

/** s.Split(separator, StringSplitOptions.RemoveEmptyEntries). */
export function splitNoEmpty(s: string, separator: string): string[] {
  return s.split(separator).filter((p) => p.length > 0);
}

/** s.TrimEnd(chars) / s.TrimStart(chars) / s.Trim(chars). */
export function trimChars(s: string, chars: string, start = true, end = true): string {
  let a = 0, b = s.length;
  if (start) while (a < b && chars.includes(s[a]!)) a++;
  if (end) while (b > a && chars.includes(s[b - 1]!)) b--;
  return s.slice(a, b);
}

// ---------- parsing (invariant culture) ----------

const floatRe = /^[+-]?(?:\d[\d,]*\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/** double.TryParse(s, NumberStyles.Float | AllowThousands, invariant): the number, or null (allowThousands false: NumberStyles.Float). */
export function tryParseDouble(s: string, allowThousands = true): number | null {
  const t = trimNet(s);
  if (floatRe.test(t) && (allowThousands || !t.includes(","))) return Number(t.replace(/,/g, ""));
  const lower = t.toLowerCase();
  if (lower === "nan" || lower === "-nan" || lower === "+nan") return Number.NaN;
  if (lower === "infinity" || lower === "+infinity" || lower === "∞") return Number.POSITIVE_INFINITY;
  if (lower === "-infinity" || lower === "-∞") return Number.NEGATIVE_INFINITY;
  return null;
}

/** double.Parse(s, invariant): throws (FormatException) when s is not a number. */
export function parseDouble(s: string): number {
  const v = tryParseDouble(s);
  if (v === null) throw new FormatError(`The input string '${s}' was not in a correct format.`);
  return v;
}

/** int.TryParse(s) (invariant): the number, or null (also when it does not fit in an int). */
export function tryParseInt(s: string): number | null {
  const t = trimNet(s);
  if (!/^[+-]?\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= Int32Min && n <= Int32Max ? n : null;
}

/** int.Parse(s): throws (FormatException / OverflowException) when it is not an int. */
export function parseInt32(s: string): number {
  const v = tryParseInt(s);
  if (v === null) throw new FormatError(`The input string '${s}' was not in a correct format.`);
  return v;
}

/** .NET's FormatException (and the other exceptions of parsing), so a caller can tell it from its own errors. */
export class FormatError extends Error {}

// ---------- formatting (invariant culture) ----------

/** The custom format "0.###": up to three decimals, trailing zeros dropped. */
export function format3(d: number): string {
  return formatCustom(d, 3, true);
}

/**
 * A custom numeric format "0.###" (trim) or "0.000" (no trim) with `decimals` places, as .NET formats it: the number
 * first rounded to 15 significant digits, those digits then rounded (half away from zero) to the decimals; a negative
 * number keeps its sign even when it rounds to zero ("-0").
 */
export function formatCustom(d: number, decimals: number, trim: boolean): string {
  if (Number.isNaN(d)) return "NaN";
  if (!Number.isFinite(d)) return d > 0 ? "Infinity" : "-Infinity";
  const negative = d < 0 || Object.is(d, -0);
  const a = Math.abs(d);
  let digits: number[];
  let exp: number;
  if (a === 0) {
    digits = [0];
    exp = 0;
  } else {
    const [mantissa, e] = a.toExponential(14).split("e") as [string, string];
    digits = [...mantissa.replace(".", "")].map(Number);
    exp = Number(e);
  }
  // Digit i weighs 10^(exp - i); the digits down to 10^-decimals stay.
  const keep = exp + decimals + 1;
  if (keep < digits.length) {
    if (keep < 0) digits = [];
    else {
      const up = digits[keep]! >= 5;
      digits = digits.slice(0, keep);
      if (up) {
        let i = digits.length - 1;
        while (i >= 0 && digits[i] === 9) digits[i--] = 0;
        if (i >= 0) digits[i]!++;
        else {
          digits.unshift(1);
          exp++;
        }
      }
    }
  }
  let whole = "";
  for (let i = 0; i <= exp; i++) whole += i < digits.length ? digits[i] : 0;
  whole = whole.replace(/^0+/, "") || "0";
  let fraction = "";
  for (let k = 1; k <= decimals; k++) {
    const i = exp + k;
    fraction += i >= 0 && i < digits.length ? digits[i] : 0;
  }
  if (trim) fraction = fraction.replace(/0+$/, "");
  return (negative ? "-" : "") + whole + (fraction.length > 0 ? "." + fraction : "");
}

/** The standard format "F&lt;n&gt;". */
export function formatFixed(d: number, decimals: number): string {
  if (Number.isNaN(d)) return "NaN";
  if (!Number.isFinite(d)) return d > 0 ? "Infinity" : "-Infinity";
  if (Math.abs(d) >= 1e21) {
    const whole = BigInt(Math.trunc(d)).toString();
    return decimals > 0 ? whole + "." + "0".repeat(decimals) : whole;
  }
  const s = d.toFixed(Math.min(100, decimals));
  return Object.is(d, -0) ? "-" + s : s;
}

/** The standard format "e&lt;n&gt;" / "E&lt;n&gt;": d.ddddde+ddd (three exponent digits at least). */
export function formatE(d: number, decimals: number, upper: boolean): string {
  if (Number.isNaN(d)) return "NaN";
  if (!Number.isFinite(d)) return d > 0 ? "Infinity" : "-Infinity";
  const s = Math.abs(d).toExponential(Math.min(100, decimals));
  const [mantissa, exp] = s.split("e") as [string, string];
  const sign = exp.startsWith("-") ? "-" : "+";
  const digits = exp.replace(/^[+-]/, "").padStart(3, "0");
  const negative = d < 0 || Object.is(d, -0);
  return (negative ? "-" : "") + mantissa + (upper ? "E" : "e") + sign + digits;
}

/** The standard format "G&lt;n&gt;": n significant digits, scientific (E+dd) when the exponent is ≥ n or &lt; -5. */
export function formatG(d: number, precision: number): string {
  if (Number.isNaN(d)) return "NaN";
  if (!Number.isFinite(d)) return d > 0 ? "Infinity" : "-Infinity";
  if (precision <= 0) return formatDouble(d);
  if (d === 0) return Object.is(d, -0) ? "-0" : "0";
  const s = Math.abs(d).toExponential(precision - 1);
  const [mantissa, expText] = s.split("e") as [string, string];
  const exp = Number(expText);
  const digits = mantissa.replace(".", "").replace(/0+$/, "") || "0";
  return (d < 0 ? "-" : "") + placeDigits(digits, exp, exp >= precision || exp < -4, 2);
}

/** double.ToString() (.NET Core 3.0+): the shortest text that reads back as the number; E+dd from 1E+17 and from 1E-05 down. */
export function formatDouble(d: number): string {
  if (Number.isNaN(d)) return "NaN";
  if (!Number.isFinite(d)) return d > 0 ? "Infinity" : "-Infinity";
  if (d === 0) return Object.is(d, -0) ? "-0" : "0";
  const s = Math.abs(d).toExponential();
  const [mantissa, expText] = s.split("e") as [string, string];
  const exp = Number(expText);
  const digits = mantissa.replace(".", "");
  return (d < 0 ? "-" : "") + placeDigits(digits, exp, exp >= 17 || exp < -4, 2);
}

function placeDigits(digits: string, exp: number, scientific: boolean, expDigits: number): string {
  if (scientific) {
    const m = digits.length > 1 ? digits[0] + "." + digits.slice(1) : digits;
    return m + "E" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(expDigits, "0");
  }
  if (exp < 0) return "0." + "0".repeat(-exp - 1) + digits;
  if (digits.length <= exp + 1) return digits + "0".repeat(exp + 1 - digits.length);
  return digits.slice(0, exp + 1) + "." + digits.slice(exp + 1);
}

/** A long as hexadecimal, as long.ToString("x") prints it (a negative value as its 64-bit two's complement). */
export function hex64(x: number, upper = false): string {
  const s = BigInt.asUintN(64, toLongBig(x)).toString(16);
  return upper ? s.toUpperCase() : s;
}

// ---------- hashing ----------

/** A stable hash of a text (FNV-1a), for cache keys (the C# code uses string.GetHashCode for the same purpose). */
export function hashText(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}
