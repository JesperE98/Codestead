// Exact floating-point helpers for the libm routines (libm-arm.ts, libm-coremath.ts): the fused multiply-add that C
// compilers emit (one rounding of a*b + c), the bits of a double, and conversions between doubles and 64-bit integers.
// Written for Codestead (no third-party code).

// The bits of a double: little-endian word order (every platform JavaScript runs on; checked below).
const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer);
const U64 = new BigUint64Array(F64.buffer);
F64[0] = 1;
if (U32[1] !== 0x3ff00000) throw new Error("libm: a big-endian platform is not supported");

/** The high 32 bits of the double x (sign, exponent, the top 20 bits of the mantissa), as an unsigned number. */
export function hiWord(x: number): number {
  F64[0] = x;
  return U32[1]!;
}

/** The low 32 bits of the double x, as an unsigned number. */
export function loWord(x: number): number {
  F64[0] = x;
  return U32[0]!;
}

/** The double whose bits are hi (high 32 bits) and lo (low 32 bits); both are taken modulo 2^32. */
export function fromWords(hi: number, lo: number): number {
  U32[1] = hi;
  U32[0] = lo;
  return F64[0]!;
}

/** C's asuint64(x): the bits of x as a 64-bit unsigned bigint. */
export function asU64(x: number): bigint {
  F64[0] = x;
  return U64[0]!;
}

/** C's asdouble(u): the double with the bits u (taken modulo 2^64). */
export function asF64(u: bigint): number {
  U64[0] = BigInt.asUintN(64, u);
  return F64[0]!;
}

/** x * 2^e exactly (as C's ldexp, for results that are representable; rounds once otherwise). */
export function ldexp(x: number, e: number): number {
  while (e > 1000) {
    x *= 1.0715086071862673e+301;
    e -= 1000;
  }
  while (e < -1000) {
    x *= 9.332636185032189e-302;
    e += 1000;
  }
  return x * fromWords((e + 1023) * 0x100000, 0); // 2^e, a normal double for -1000 <= e <= 1000
}

const SPLIT = 134217729; // 2^27 + 1, Veltkamp's splitter

/**
 * C's fma(a, b, c): a*b + c rounded once, to nearest even, exactly as the x86 FMA instruction (and glibc's fma).
 *
 * The usual path: a*b = ph + pl exactly (Dekker's product), c + ph = th + tl exactly (Knuth's two-sum), v = tl + pl
 * rounded to nearest with its error w, r = th + v rounded to nearest. r is the correctly rounded a*b + c unless w != 0
 * and th + v lies exactly halfway between two doubles (v's last bit is far below r's, so th + v is either a midpoint
 * or farther from one than |w|); then the sign of w decides. Where that needs care – a product or a sum near the
 * overflow or underflow threshold, zeros, infinities, NaN – the exact sum is computed with bigints and rounded once.
 */
export function fma(a: number, b: number, c: number): number {
  const ph = a * b;
  const aph = Math.abs(ph), ac = Math.abs(c);
  if (aph > 8.016673440035891e-292 && aph < 1.1235582092889474e+307 && ac < 1.1235582092889474e+307 && c !== 0 && Math.abs(a) < 3.3484643974570854e+299 && Math.abs(b) < 3.3484643974570854e+299) {
    let t = SPLIT * a;
    const ah = t - (t - a), al = a - ah;
    t = SPLIT * b;
    const bh = t - (t - b), bl = b - bh;
    const pl = ah * bh - ph + ah * bl + al * bh + al * bl;
    const th = c + ph;
    const z = th - c;
    const tl = c - (th - z) + (ph - z);
    const v = tl + pl;
    const z2 = v - tl;
    const w = tl - (v - z2) + (pl - z2);
    const r = th + v;
    if (w === 0) return r; // th + v is exact: one rounding
    if (Math.abs(th) >= 1.0261342003245941e-289) {
      const z3 = r - th;
      const e = th - (r - z3) + (v - z3); // th + v = r + e exactly
      if (e === 0) return r;
      const r2 = r + 2 * e;
      if (r2 - r !== 2 * e) return r; // th + v is not a midpoint
      return w > 0 === e > 0 ? r2 : r; // a midpoint: the exact sum lies on the side of w
    }
  }
  return fmaExact(a, b, c);
}

/** The error of the product p = a*b (p rounded to nearest): a*b - p exactly, as C's fma(a, b, -p). */
export function mulErr(a: number, b: number, p: number): number {
  const ap = Math.abs(p);
  if (ap > 8.016673440035891e-292 && ap < 1.1235582092889474e+307 && Math.abs(a) < 3.3484643974570854e+299 && Math.abs(b) < 3.3484643974570854e+299) {
    let t = SPLIT * a;
    const ah = t - (t - a), al = a - ah;
    t = SPLIT * b;
    const bh = t - (t - b), bl = b - bh;
    return ah * bh - p + ah * bl + al * bh + al * bl;
  }
  return fma(a, b, -p);
}

/** x = m * 2^e with an integer m (sign included) for a finite non-zero double. */
function decompose(x: number): [bigint, number] {
  F64[0] = x;
  const hi = U32[1]!, lo = U32[0]!;
  const ex = (hi >>> 20) & 0x7ff;
  let m = (hi & 0xfffff) * 0x100000000 + lo;
  let e = -1074;
  if (ex !== 0) {
    m += 0x10000000000000;
    e = ex - 1075;
  }
  return [BigInt(hi >>> 31 ? -m : m), e];
}

/** fma's slow path: special values directly, everything else as the exact sum (bigints) rounded once. */
function fmaExact(a: number, b: number, c: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a * b + c; // inf/NaN in the product: one operation decides
  if (!Number.isFinite(c)) return c; // a finite product does not change an infinite or NaN c
  if (a === 0 || b === 0) return a * b + c; // a*b is an exact (signed) zero
  if (c === 0) return a * b; // a*b + 0 rounds as a*b, a zero result keeping the product's sign
  const [ma, ea] = decompose(a), [mb, eb] = decompose(b), [mc, ec] = decompose(c);
  const ep = ea + eb, e0 = Math.min(ep, ec);
  const s = ((ma * mb) << BigInt(ep - e0)) + (mc << BigInt(ec - e0));
  if (s === 0n) return 0; // exact cancellation: +0 when rounding to nearest
  const neg = s < 0n;
  const m = neg ? -s : s;
  const len = m.toString(2).length;
  // The result's last bit: 53 bits below the leading one, but not below 2^-1074 (subnormals).
  const q = Math.max(e0 + len - 53, -1074);
  let r: number;
  if (q <= e0) r = ldexp(Number(m), e0); // exact (fewer than 53 significant bits)
  else {
    const sh = BigInt(q - e0);
    let n = m >> sh;
    const rem = m - (n << sh), half = 1n << (sh - 1n);
    if (rem > half || (rem === half && (n & 1n) === 1n)) n += 1n;
    r = ldexp(Number(n), q); // Infinity when the rounded value reaches 2^1024
  }
  return neg ? -r : r;
}
