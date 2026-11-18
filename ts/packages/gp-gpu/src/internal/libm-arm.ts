// exp, log, log2 and pow: a translation of Arm optimized-routines (math/exp.c, log.c, log2.c, pow.c, pow_common.h,
// math_err.c), https://github.com/ARM-software/optimized-routines, commit 20859d3fd9e797dde592c489c8ef7d383f778620.
// The tables are in libm-arm-data.ts.
//
// The C code is compiled by GCC with -O2 -mfma (as x86-64 C libraries build their FMA variants): GCC contracts a*b + c
// into one fused multiply-add wherever it can, and the results depend on it. This translation calls fma() exactly where
// GCC 13's optimized GIMPLE for these files has .FMA / fma (checked against -fdump-tree-optimized); where the fma's
// result is exact (a product by a power of two, the error of a product: fma(a, b, -a*b)) it is computed more cheaply
// with the same result, and exp's fma(x, InvLn2N, Shift) - Shift is roundProduct. Built that way, the C code gives
// glibc 2.39's results (x86-64, FMA) bit for bit on millions of arguments, and so does this translation (see
// test/Libm.test.ts). The C code's 64-bit integer operations on the bits of doubles work on their 32-bit words here.
// errno and floating-point exceptions are left out (JavaScript has neither).
//
// Copyright (c) 2018-2026, Arm Limited.
// SPDX-License-Identifier: MIT OR Apache-2.0 WITH LLVM-exception. Used here under the MIT licence:
//
// MIT License
//
// Copyright (c) 1999-2022, Arm Limited.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import * as D from "./libm-arm-data.js";
import { fma, fromWords, hiWord, loWord, mulErr } from "./libm-fma.js";

/**
 * fma(x, y, Shift) - Shift for exp's Shift = 0x1.8p52, i.e. x*y rounded once to the nearest integer (ties to even), for
 * |x*y| < 2^51. The rounded product decides unless it lies within its own rounding error of a half-integer; only then
 * is the fma computed.
 */
function roundProduct(x: number, y: number): number {
  const p = x * y;
  const k = Math.round(p);
  if (Math.abs(p - k) < 0.5 - Math.abs(p) * 2.220446049250313e-16) return k; // p - k is exact; |x*y - p| <= |p|*2^-53
  return fma(x, y, D.EXP_SHIFT) - D.EXP_SHIFT;
}

const EXP_C2 = D.EXP_POLY[0]!, EXP_C3 = D.EXP_POLY[1]!, EXP_C4 = D.EXP_POLY[2]!, EXP_C5 = D.EXP_POLY[3]!;

// math_err.c (without errno): the results of overflow, underflow, division by zero, invalid operations.
const oflow = (sign: number): number => (sign ? -Infinity : Infinity);
const uflow = (sign: number): number => (sign ? -0 : 0);

// ---------- exp ----------

/**
 * exp's special case: the result scale*(1 + tmp) may overflow or underflow. The high word of scale's bits (with an
 * exponent that may have overflowed into the sign bit) is sHi, the low word sLo; ki is the k of the argument
 * reduction (its low 32 bits, signed): k > 0 means the result may overflow, k < 0 that it may underflow.
 */
function expSpecialcase(tmp: number, sHi: number, sLo: number, ki: number): number {
  if (ki >= 0) {
    // k > 0, the exponent of scale might have overflowed by <= 460.
    const scale = fromWords(sHi - (1009 << 20), sLo);
    return fma(tmp, scale, scale) * 5.486124068793689e+303; // 0x1p1009
  }
  // k < 0, need special care in the subnormal range.
  const scale = fromWords(sHi + (1022 << 20), sLo);
  const st = tmp * scale;
  let y = scale + st;
  if (y < 1.0) {
    // Round y to the right precision before scaling it into the subnormal range to avoid double rounding.
    let lo = st + (scale - y);
    const hi = y + 1.0;
    lo = lo + (y + (1.0 - hi));
    y = hi + lo - 1.0;
    if (y === 0) y = 0; // avoid -0.0 with downward rounding
  }
  return y * 2.2250738585072014e-308; // 0x1p-1022
}

/** e^x (exp.c), as glibc's exp on x86-64 with FMA. */
export function exp(x: number): number {
  let abstop = (hiWord(x) >>> 20) & 0x7ff;
  // top12(0x1p-54) = 0x3c9, top12(512) = 0x408, top12(1024) = 0x409.
  if (((abstop - 0x3c9) >>> 0) >= 0x408 - 0x3c9) {
    if (abstop - 0x3c9 < 0) return 1.0 + x; // tiny x (and 0): avoid spurious underflow
    if (abstop >= 0x409) {
      if (x === -Infinity) return 0.0;
      if (abstop >= 0x7ff) return 1.0 + x;
      return x < 0 ? uflow(0) : oflow(0);
    }
    abstop = 0; // large x is special cased below
  }
  // exp(x) = 2^(k/N) * exp(r), with exp(r) in [2^(-1/2N),2^(1/2N)]; x = ln2/N*k + r.
  const kd = roundProduct(x, D.EXP_INVLN2N); // z = fma(x, InvLn2N, Shift); kd = z - Shift
  // ki = asuint64(z): its low 32 bits are k (z = Shift + k exactly, Shift = 0x1.8p52), which is all the code uses.
  const ki = kd | 0;
  const r = fma(kd, D.EXP_NEGLN2LON, fma(kd, D.EXP_NEGLN2HIN, x));
  // 2^(k/N) ~= scale * (1 + tail); sbits = T[idx + 1] + (ki << 45) changes the high word only.
  const idx = ki & 127;
  const tail = D.EXP_TAIL[idx]!;
  const sHi = (D.EXP_SBITS_HI[idx]! + (ki << 13)) >>> 0, sLo = D.EXP_SBITS_LO[idx]!;
  const r2 = r * r;
  const tmp = fma(r2 * r2, fma(r, EXP_C5, EXP_C4), fma(r2, fma(r, EXP_C3, EXP_C2), r + tail));
  if (abstop === 0) return expSpecialcase(tmp, sHi, sLo, ki);
  const scale = fromWords(sHi, sLo);
  return fma(tmp, scale, scale);
}

// ---------- log ----------

const LOG_B = D.LOG_POLY1, LOG_A = D.LOG_POLY;

/** The natural logarithm (log.c), as glibc's log on x86-64 with FMA. */
export function log(x: number): number {
  // Close to 1.0 (LOG_POLY1_ORDER == 12, N = 128): 1 - 0x1p-4 <= x < 1 + 0x1.09p-4.
  if (x >= 1 - 0.0625 && x < 1 + 0.064697265625) {
    if (x === 1) return 0;
    const r = x - 1.0;
    const r2 = r * r;
    const r3 = r * r2;
    // y = r3 * (B[1] + r*B[2] + r2*B[3] + r3*(B[4] + r*B[5] + r2*B[6] + r3*(B[7] + r*B[8] + r2*B[9] + r3*B[10])))
    const q1 = fma(LOG_B[3]!, r2, fma(LOG_B[2]!, r, LOG_B[1]!));
    const q2 = fma(LOG_B[6]!, r2, fma(LOG_B[5]!, r, LOG_B[4]!));
    const q3 = fma(LOG_B[10]!, r3, fma(LOG_B[9]!, r2, fma(LOG_B[8]!, r, LOG_B[7]!)));
    const poly = fma(fma(q3, r3, q2), r3, q1);
    // Worst-case error is around 0.507 ULP: rhi = r rounded to 26 bits, so rhi*rhi is exact.
    const w = r * 134217728; // exact
    const rhi = r + w - w;
    const rlo = r - rhi;
    const rr = rhi * rhi; // B[0] == -0.5: rr*B[0] is exact
    const hi = r + rr * LOG_B[0]!;
    let lo = r - hi + rr * LOG_B[0]!;
    lo = fma(LOG_B[0]! * rlo, rhi + r, lo);
    return hi + fma(poly, r3, lo);
  }
  let ixHi = hiWord(x), ixLo = loWord(x);
  const top = ixHi >>> 16;
  if (((top - 0x0010) >>> 0) >= 0x7ff0 - 0x0010) {
    // x < 0x1p-1022 or inf or nan.
    if (x === 0) return -Infinity; // __math_divzero(1)
    if (x === Infinity) return x;
    if (top & 0x8000 || (top & 0x7ff0) === 0x7ff0) return (x - x) / (x - x); // __math_invalid
    // x is subnormal, normalize it.
    const xs = x * 4503599627370496;
    ixHi = hiWord(xs) - (52 << 20);
    ixLo = loWord(xs);
  }
  // x = 2^k z; where z is in range [OFF,2*OFF) and exact (OFF = 0x3fe6000000000000).
  const tmpHi = (ixHi - 0x3fe60000) >>> 0;
  const i = (tmpHi >>> 13) & 127;
  const k = (tmpHi | 0) >> 20;
  const z = fromWords(ixHi - (tmpHi & 0xfff00000), ixLo);
  const invc = D.LOG_INVC[i]!, logc = D.LOG_LOGC[i]!;
  // log(x) = log1p(z/c-1) + log(c) + k*Ln2.
  const r = fma(z, invc, -1.0);
  const kd = k;
  // hi + lo = r + log(c) + k*Ln2.
  const w = fma(D.LOG_LN2HI, kd, logc);
  const hi = r + w;
  const lo = fma(D.LOG_LN2LO, kd, w - hi + r);
  // log(x) = lo + (log1p(r) - r) + hi.
  const r2 = r * r;
  // y = lo + r2*A[0] + r*r2*(A[1] + r*A[2] + r2*(A[3] + r*A[4])) + hi
  const p = fma(fma(LOG_A[4]!, r, LOG_A[3]!), r2, fma(LOG_A[2]!, r, LOG_A[1]!));
  return fma(r * r2, p, fma(LOG_A[0]!, r2, lo)) + hi;
}

// ---------- log2 ----------

const LOG2_B = D.LOG2_POLY1, LOG2_A = D.LOG2_POLY;

/** The base-2 logarithm (log2.c), as glibc's log2 on x86-64 with FMA. */
export function log2(x: number): number {
  // Close to 1.0 (LOG2_POLY1_ORDER == 11): 1 - 0x1.5b51p-5 <= x < 1 + 0x1.6ab2p-5.
  if (x >= 1 - 0.04239702224731445 && x < 1 + 0.044274330139160156) {
    if (x === 1) return 0;
    const r = x - 1.0;
    const hi = r * D.LOG2_INVLN2HI;
    let lo = fma(D.LOG2_INVLN2LO, r, mulErr(r, D.LOG2_INVLN2HI, hi));
    const r2 = r * r;
    const r4 = r2 * r2;
    // p = r2*(B[0] + r*B[1]); y = hi + p; lo += hi - y + p (p is not rounded on its own: both sums are fused)
    const q = fma(LOG2_B[1]!, r, LOG2_B[0]!);
    const y = fma(q, r2, hi);
    lo = fma(q, r2, hi - y) + lo;
    // lo += r4*(B[2] + r*B[3] + r2*(B[4] + r*B[5]) + r4*(B[6] + r*B[7] + r2*(B[8] + r*B[9])))
    const p1 = fma(fma(LOG2_B[5]!, r, LOG2_B[4]!), r2, fma(LOG2_B[3]!, r, LOG2_B[2]!));
    const p2 = fma(fma(LOG2_B[9]!, r, LOG2_B[8]!), r2, fma(LOG2_B[7]!, r, LOG2_B[6]!));
    lo = fma(fma(p2, r4, p1), r4, lo);
    return y + lo;
  }
  let ixHi = hiWord(x), ixLo = loWord(x);
  const top = ixHi >>> 16;
  if (((top - 0x0010) >>> 0) >= 0x7ff0 - 0x0010) {
    // x < 0x1p-1022 or inf or nan.
    if (x === 0) return -Infinity; // __math_divzero(1)
    if (x === Infinity) return x;
    if (top & 0x8000 || (top & 0x7ff0) === 0x7ff0) return (x - x) / (x - x); // __math_invalid
    // x is subnormal, normalize it.
    const xs = x * 4503599627370496;
    ixHi = hiWord(xs) - (52 << 20);
    ixLo = loWord(xs);
  }
  // x = 2^k z; where z is in range [OFF,2*OFF) and exact (OFF = 0x3fe6000000000000).
  const tmpHi = (ixHi - 0x3fe60000) >>> 0;
  const i = (tmpHi >>> 14) & 63;
  const k = (tmpHi | 0) >> 20;
  const z = fromWords(ixHi - (tmpHi & 0xfff00000), ixLo);
  const invc = D.LOG2_INVC[i]!, logc = D.LOG2_LOGC[i]!;
  const kd = k;
  // log2(x) = log2(z/c) + log2(c) + k.
  const r = fma(z, invc, -1.0);
  const t1 = r * D.LOG2_INVLN2HI;
  const t2 = fma(D.LOG2_INVLN2LO, r, mulErr(r, D.LOG2_INVLN2HI, t1));
  // hi + lo = r/ln2 + log2(c) + k.
  const t3 = kd + logc;
  const hi = t3 + t1;
  const lo = t3 - hi + t1 + t2;
  // log2(r+1) = r/ln2 + r^2*poly(r).
  const r2 = r * r;
  const r4 = r2 * r2;
  // p = A[0] + r*A[1] + r2*(A[2] + r*A[3]) + r4*(A[4] + r*A[5]); y = lo + r2*p + hi
  const p = fma(fma(LOG2_A[5]!, r, LOG2_A[4]!), r4, fma(fma(LOG2_A[3]!, r, LOG2_A[2]!), r2, fma(LOG2_A[1]!, r, LOG2_A[0]!)));
  return fma(r2, p, lo) + hi;
}

// ---------- pow ----------

const POW_A = D.POW_POLY;
const SIGN_BIAS = 0x800 << 7; // 0x800 << EXP_TABLE_BITS

/** 0 if the double y (non-zero, finite) is not an integer, 1 if it is an odd integer, 2 if an even one (checkint). */
function checkint(y: number): number {
  if (!Number.isInteger(y)) return 0;
  return Math.abs(y) < 9007199254740992 && y % 2 !== 0 ? 1 : 2;
}

/** Whether x is 0, infinite or NaN (zeroinfnan). */
const zeroinfnan = (x: number): boolean => x === 0 || !Number.isFinite(x);

let logTail = 0;

/** log(x) = y + logTail, with about 15 bits more precision in the tail (log_inline); ix is x's bits, normalized. */
function logInline(ixHi: number, ixLo: number): number {
  // x = 2^k z; where z is in range [OFF,2*OFF) and exact (OFF = 0x3fe6955500000000).
  const tmpHi = (ixHi - 0x3fe69555) >>> 0;
  const i = (tmpHi >>> 13) & 127;
  const k = (tmpHi | 0) >> 20;
  const z = fromWords(ixHi - (tmpHi & 0xfff00000), ixLo);
  const kd = k;
  // log(x) = k*Ln2 + log(c) + log1p(z/c-1).
  const invc = D.POW_INVC[i]!, logc = D.POW_LOGC[i]!, logctail = D.POW_LOGCTAIL[i]!;
  // 1/c is j/N or j/N/2 and |z/c - 1| < 1/N, so r = z/c - 1 is exactly representible.
  // r = fma(z, invc, -1.0), exact: z*invc rounded is in [1/2, 2], so subtracting 1 is exact too
  const zc = z * invc;
  const r = zc - 1.0 + mulErr(z, invc, zc);
  // k*Ln2 + log(c) + r.
  const t1 = fma(kd, D.POW_LN2HI, logc);
  const t2 = r + t1;
  const lo1 = fma(kd, D.POW_LN2LO, logctail);
  const lo2 = r + (t1 - t2);
  const ar = r * POW_A[0]!; // A[0] = -0.5
  const ar2 = r * ar;
  const ar3 = r * ar2;
  // k*Ln2 + log(c) + r + A[0]*r*r.
  const hi = t2 + ar2;
  const lo3 = mulErr(ar, r, ar2); // fma(ar, r, -ar2)
  const lo4 = ar2 + (t2 - hi);
  // p = ar3*(A[1] + r*A[2] + ar2*(A[3] + r*A[4] + ar2*(A[5] + r*A[6]))); lo = lo1 + lo2 + lo3 + lo4 + p
  const q = fma(ar2, fma(ar2, fma(r, POW_A[6]!, POW_A[5]!), fma(r, POW_A[4]!, POW_A[3]!)), fma(r, POW_A[2]!, POW_A[1]!));
  const lo = fma(ar3, q, lo4 + (lo3 + (lo1 + lo2)));
  const y = hi + lo;
  logTail = lo + (hi - y);
  return y;
}

/** pow's special case of exp: scale*(1 + tmp) may overflow or underflow (see expSpecialcase; scale carries the sign). */
function powSpecialcase(tmp: number, sHi: number, sLo: number, ki: number): number {
  if (ki >= 0) {
    // k > 0, the exponent of scale might have overflowed by <= 460.
    const scale = fromWords(sHi - (1009 << 20), sLo);
    return fma(tmp, scale, scale) * 5.486124068793689e+303; // 0x1p1009
  }
  // k < 0, need special care in the subnormal range.
  const sbitsHi = (sHi + (1022 << 20)) >>> 0;
  const scale = fromWords(sbitsHi, sLo); // signed scale
  const st = tmp * scale;
  let y = scale + st;
  if (Math.abs(y) < 1.0) {
    // Round y to the right precision before scaling it into the subnormal range to avoid double rounding.
    const one = y < 0.0 ? -1.0 : 1.0;
    let lo = st + (scale - y);
    const hi = y + one;
    lo = lo + (y + (one - hi));
    y = hi + lo - one;
    if (y === 0) y = sbitsHi & 0x80000000 ? -0 : 0; // fix the sign of 0
  }
  return y * 2.2250738585072014e-308; // 0x1p-1022
}

/** sign*exp(x + xtail), |xtail| < 2^-8/N and |xtail| <= |x|; signBias is SIGN_BIAS or 0 (pow's exp_inline). */
function expInline(x: number, xtail: number, signBias: number): number {
  let abstop = (hiWord(x) >>> 20) & 0x7ff;
  if (((abstop - 0x3c9) >>> 0) >= 0x408 - 0x3c9) {
    if (abstop - 0x3c9 < 0) {
      // Avoid spurious underflow for tiny x.
      const one = 1.0 + x;
      return signBias ? -one : one;
    }
    if (abstop >= 0x409) return x < 0 ? uflow(signBias) : oflow(signBias); // inf and nan are already handled
    abstop = 0; // large x is special cased below
  }
  const kd = roundProduct(x, D.EXP_INVLN2N); // z = fma(x, InvLn2N, Shift); kd = z - Shift
  const ki = kd | 0; // the low 32 bits of asuint64(z)
  let r = fma(kd, D.EXP_NEGLN2LON, fma(kd, D.EXP_NEGLN2HIN, x));
  r = xtail + r;
  const idx = ki & 127;
  const tail = D.EXP_TAIL[idx]!;
  // sbits = T[idx + 1] + ((ki + sign_bias) << 45)
  const sHi = (D.EXP_SBITS_HI[idx]! + ((ki + signBias) << 13)) >>> 0, sLo = D.EXP_SBITS_LO[idx]!;
  const r2 = r * r;
  const tmp = fma(r2 * r2, fma(r, EXP_C5, EXP_C4), fma(r2, fma(r, EXP_C3, EXP_C2), r + tail));
  if (abstop === 0) return powSpecialcase(tmp, sHi, sLo, ki);
  const scale = fromWords(sHi, sLo);
  return fma(tmp, scale, scale);
}

/** x^y (pow.c), as glibc's pow on x86-64 with FMA. */
export function pow(x: number, y: number): number {
  let signBias = 0;
  let ixHi = hiWord(x), ixLo = loWord(x);
  const iyHi = hiWord(y);
  let topx = ixHi >>> 20;
  const topy = iyHi >>> 20;
  if (((topx - 0x001) >>> 0) >= 0x7ff - 0x001 || (((topy & 0x7ff) - 0x3be) >>> 0) >= 0x43e - 0x3be) {
    // Special cases: (x < 0x1p-126 or inf or nan) or (|y| < 0x1p-65 or |y| >= 0x1p63 or nan).
    if (zeroinfnan(y)) {
      if (y === 0) return 1.0;
      if (x === 1.0) return 1.0;
      if (Number.isNaN(x) || Number.isNaN(y)) return x + y;
      if (Math.abs(x) === 1.0) return 1.0;
      if (Math.abs(x) < 1.0 === !(iyHi >>> 31)) return 0.0; // |x|<1 && y==inf or |x|>1 && y==-inf
      return y * y;
    }
    if (zeroinfnan(x)) {
      let x2 = x * x;
      if (ixHi >>> 31 && checkint(y) === 1) x2 = -x2;
      return iyHi >>> 31 ? 1 / x2 : x2;
    }
    // Here x and y are non-zero finite.
    if (ixHi >>> 31) {
      // Finite x < 0.
      const yint = checkint(y);
      if (yint === 0) return (x - x) / (x - x); // __math_invalid
      if (yint === 1) signBias = SIGN_BIAS;
      ixHi &= 0x7fffffff;
      topx &= 0x7ff;
    }
    if ((((topy & 0x7ff) - 0x3be) >>> 0) >= 0x43e - 0x3be) {
      // Note: sign_bias == 0 here because y is not odd.
      if (ixHi === 0x3ff00000 && ixLo === 0) return 1.0;
      const ixGt1 = ixHi > 0x3ff00000 || (ixHi === 0x3ff00000 && ixLo !== 0);
      // |y| < 2^-65, x^y ~= 1 + y*log(x).
      if ((topy & 0x7ff) < 0x3be) return ixGt1 ? 1.0 + y : 1.0 - y;
      return ixGt1 === topy < 0x800 ? oflow(0) : uflow(0);
    }
    if (topx === 0) {
      // Normalize subnormal x so exponent becomes negative.
      const xs = x * 4503599627370496;
      ixHi = (hiWord(xs) & 0x7fffffff) - (52 << 20);
      ixLo = loWord(xs);
    }
  }
  const hi = logInline(ixHi, ixLo);
  const lo = logTail;
  const ehi = y * hi;
  const elo = fma(y, lo, mulErr(y, hi, ehi)); // fma(y, hi, -ehi) is the exact error of ehi
  return expInline(ehi, elo, signBias);
}
