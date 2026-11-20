// sin, cos, tan, asin, acos, atan and atan2, correctly rounded: a translation of the CORE-MATH project's
// src/binary64/{sin,cos,tan,asin,acos,atan,atan2}/*.c and atan2/tint.h (https://core-math.gitlabpages.inria.fr/,
// https://gitlab.inria.fr/core-math/core-math, taken from its GitHub mirror https://github.com/nak5124/core-math,
// commit 018fa97cbdacf59924b899a9dfa422d532cb2bb7;
// the same commit is in the official repository, checked 2026-11-20, so the files are the official ones). The tables are in libm-coremath-data.ts.
//
// The results are correctly rounded (to nearest), so they do not depend on how the arithmetic is arranged; the
// translation follows the C code operation by operation, with C's fma (__builtin_fma) as libm-fma.ts's exact fma and
// fma(a, b, -a*b) as mulErr, and without contracting other products and sums (CORE-MATH's proofs and tests cover builds
// with and without contraction). The C code's 128-bit (and 192-bit) integer arithmetic of the accurate paths uses
// bigints. errno and floating-point exceptions are left out (JavaScript has neither); a NaN result is any NaN.
//
// Copyright (c) 2026 Paul Zimmermann and Alexei Sibidanov (sin.c)
// Copyright (c) 2026 Paul Zimmermann (cos.c)
// Copyright (c) 2022-2025 Paul Zimmermann and Tom Hubrecht (tan.c)
// Copyright (c) 2022-2026 Alexei Sibidanov <sibid@uvic.ca>. (asin.c)
// Copyright (c) 2024-2025 Alexei Sibidanov. (acos.c)
// Copyright (c) 2023-2026 Alexei Sibidanov <sibid@uvic.ca>. (atan.c)
// Copyright (c) 2024-2025 Paul Zimmermann and Alexei Sibidanov (atan2.c)
// Copyright (c) 2023-2024 Paul Zimmermann and Alexei Sibidanov (atan2/tint.h)
//
// These files are part of the CORE-MATH project (https://core-math.gitlabpages.inria.fr/).
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

import * as D from "./libm-coremath-data.js";
import { asF64, asU64, fma, fromWords, hiWord, loWord, mulErr } from "./libm-fma.js";

// ---------- shared helpers ----------

/** The second result of the double-double helpers below (the C code's double *l or *e out-parameter). */
let LO = 0;

/** s = x + y rounded, LO = the error, assuming |x| >= |y| (fasttwosum). */
function fasttwosum(x: number, y: number): number {
  const s = x + y, z = s - x;
  LO = y - z;
  return s;
}

/** (xh + xl) + (yh + yl) as a double-double (fastsum). */
function fastsum(xh: number, xl: number, yh: number, yl: number): number {
  const sh = fasttwosum(xh, yh);
  LO = xl + yl + LO;
  return sh;
}

/** (xh + xl) * (ch + cl) as a double-double, without xl*cl (muldd). */
function muldd(xh: number, xl: number, ch: number, cl: number): number {
  const ahhh = xh * ch;
  LO = xh * cl + xl * ch + mulErr(xh, ch, ahhh);
  return ahhh;
}

/** C's copysign(a, b). */
function copysign(a: number, b: number): number {
  const s = b < 0 || Object.is(b, -0);
  return Math.abs(a) * (s ? -1 : 1);
}

/** roundeven_finite (__builtin_roundeven): to the nearest integer, ties to even. */
function roundeven(x: number): number {
  const r = Math.round(x); // ties toward +infinity
  return r - x === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** 2^e for a normal result (-1022 <= e <= 1023), exactly. */
const pow2 = (e: number): number => fromWords((e + 1023) * 0x100000, 0);

const M64 = (1n << 64n) - 1n;
const M128 = (1n << 128n) - 1n;

/** The number of leading zero bits of a 64-bit unsigned bigint (64 for 0), as __builtin_clzll. */
function clz64(x: bigint): number {
  const h = Number(x >> 32n);
  return h !== 0 ? Math.clz32(h) : 32 + Math.clz32(Number(x & 0xffffffffn));
}

/** mhUU: floor(a*b / 2^128) for two u128, without the low*low partial product (sin.c, cos.c). */
function mhUU(a: bigint, b: bigint): bigint {
  const ah = a >> 64n, al = a & M64, bh = b >> 64n, bl = b & M64;
  return (ah * bh + ((ah * bl) >> 64n) + ((al * bh) >> 64n)) & M128;
}

// ---------- atan (atan.c) ----------

const A = D.ATAN_A;

/** muldd_acc (atan.c): (xh + xl) * (ch + cl) as a normalized double-double. */
function mulddAcc(xh: number, xl: number, ch: number, cl: number): number {
  const ahlh = ch * xl, alhh = cl * xh, ahhh = ch * xh;
  let ahhl = mulErr(ch, xh, ahhh);
  ahhl += alhh + ahlh;
  return fasttwosum(ahhh, ahhl);
}

/** adddd (atan.c): (xh + xl) + (ch + cl) as a double-double. */
function adddd(xh: number, xl: number, ch: number, cl: number): number {
  const s = xh + ch, d = s - xh;
  LO = ch - d + (xh + (d - s)) + (xl + cl);
  return s;
}

/** polydd (atan.c): the polynomial with double-double coefficients c (n pairs) at xh + xl, plus l. */
function polyddAtan(xh: number, xl: number, n: number, c: Float64Array, l: number): number {
  let i = n - 1;
  let ch = c[2 * i]! + l, cl = c[2 * i]! - ch + l + c[2 * i + 1]!;
  while (--i >= 0) {
    ch = mulddAcc(xh, xl, ch, cl);
    cl = LO;
    const th = ch + c[2 * i]!, tl = c[2 * i]! - th + ch;
    ch = th;
    cl += tl + c[2 * i + 1]!;
  }
  LO = cl;
  return ch;
}

const ATAN_R2_CH = new Float64Array([
  -0.3333333333333333, -1.850371707708594e-17, 0.2, -1.1102230246265417e-17,
  -0.14285714285714285, -7.930161522310759e-18,
]);
const ATAN_R2_CL0 = 0.1111111111111111, ATAN_R2_CL1 = -0.09090909090907358;
const ATAN_R2_CL2 = 0.07692307637971313, ATAN_R2_CL3 = -0.06665779689246536;

/** as_atan_refine2: the accurate path, for 0x1p-27 <= |x|; a is the fast path's approximation of atan(x). */
function atanRefine2(x: number, a: number): number {
  const phi = Math.abs(a) * 81.48733086305042 + 256.5;
  // 256.5 < phi < 384.5
  const i = (hiWord(phi) >>> 12) & 0xff; // 0 <= i <= 128
  let h: number, hl: number;
  if (i === 128) {
    h = -1.0 / x;
    hl = fma(h, x, 1) * h;
  } else {
    const ta = copysign(A[2 * i]!, x);
    const zta = x * ta, ztal = mulErr(x, ta, zta), zmta = x - ta;
    const v = 1 + zta, d = 1 - v, ev = d + zta - (d + v - 1) + ztal;
    const r = 1.0 / v, rl = (fma(r, -v, 1.0) - ev * r) * r;
    h = r * zmta;
    hl = mulErr(r, zmta, h) + rl * zmta;
  }
  const h2 = mulddAcc(h, hl, h, hl), h2l = LO, h4 = h2 * h2;
  const h3 = mulddAcc(h, hl, h2, h2l), h3l = LO;
  let fl = h2 * (ATAN_R2_CL0 + h2 * ATAN_R2_CL1 + h4 * (ATAN_R2_CL2 + h2 * ATAN_R2_CL3));
  let f = polyddAtan(h2, h2l, 3, ATAN_R2_CH, fl);
  fl = LO;
  f = mulddAcc(h3, h3l, f, fl);
  fl = LO;
  let ah: number, al: number, at: number;
  if (i === 0) {
    ah = h;
    al = f;
    at = fl;
  } else {
    let df = 0;
    if (i < 128) df = copysign(1.0, x) * A[2 * i + 1]!;
    const id = copysign(i, x);
    ah = 0.012271846303085088 * id;
    al = 4.21117410793604e-17 * id;
    at = -9.794523599166037e-32 * id;
    al = adddd(al, at, df, 0);
    at = LO;
    al = adddd(al, at, h, hl);
    at = LO;
    al = adddd(al, at, f, fl);
    at = LO;
  }
  const v0 = fasttwosum(ah, al);
  let v2 = LO;
  let v1 = fasttwosum(v2, at);
  v2 = LO;
  const ax = Math.abs(x);
  const h1 = hiWord(v1), m1 = (h1 & 0xfffff) * 0x100000000 + loWord(v1);
  const e0 = (hiWord(v0) >>> 20) & 0x7ff, e1 = (h1 >>> 20) & 0x7ff;
  // ((t1.u+1)&(~0>>12)) <= 2 || e0 - e1 > 103 (unsigned: also when e1 > e0)
  if (m1 === 0xfffffffffffff || m1 <= 1 || e0 - e1 > 103 || e0 - e1 < 0) {
    const db = D.ATAN_DB;
    for (let j = 0; j < db.length; j += 3) if (ax === db[j]) return copysign(db[j + 1]!, x) + copysign(1.0, x) * db[j + 2]!;
    if (m1 === 0) {
      const t1 = asU64(v1);
      v1 = asF64((asU64(v2) ^ t1) >> 63n ? t1 - 1n : t1 + 1n);
    }
  }
  return v1 + v0;
}

const ATAN_CH0 = 1, ATAN_CH1 = -0.333333333333331, ATAN_CH2 = 0.1999999997326265, ATAN_CH3 = -0.1428473928322857;
const ATAN_CH2_0 = -0.3333333333333333, ATAN_CH2_1 = 0.199999999999994;
const ATAN_CH2_2 = -0.1428571424743179, ATAN_CH2_3 = 0.11110113960028833;

/** The arctangent, correctly rounded (CORE-MATH's cr_atan). */
export function atan(x: number): number {
  const hx = hiWord(x);
  const ax = Math.abs(x);
  let i = ((hx & 0x7fffffff) >>> 19) - 2030; // (at>>51) - 2030
  if (ax < 0.006624) {
    // |x| < 0x1.b21c475e6362ap-8
    if (x === 0) return x; // atan(+/-0) = +/-0
    if (ax < 7.450580596923828e-9) return fma(-5.551115123125783e-17, x, x);
    const x2 = x * x, x3 = x * x2, x4 = x2 * x2;
    const f = x3 * (ATAN_CH2_0 + x2 * ATAN_CH2_1 + x4 * (ATAN_CH2_2 + x2 * ATAN_CH2_3));
    const epsp = f * 1.2212453270876722e-15, epsm = f * 6.106226635438361e-16;
    const ub = f + epsp + x, lb = f - epsm + x;
    if (ub === lb) return ub;
    return atanRefine2(x, ub);
  }
  let h: number, ah: number, al: number;
  if (!(ax <= 150.9639755684199)) {
    // |x| > 0x1.2ded8e34a9035p+7 (or NaN)
    ah = copysign(1.5707963267948966, x);
    al = copysign(6.123233995736766e-17, x);
    if (!(ax < 16331239353195370)) {
      // |x| >= 0x1.d02967c31cdb5p+53
      if (x !== x) return x + x; // NaN
      return ah + al;
    }
    h = -1.0 / x;
  } else {
    // now 0x1.b21c475e6362ap-8 <= |x| <= 0x1.2ded8e34a9035p+7 thus 1<=i<=30
    const ut = (hx >>> 3) & 0xffff, ut2 = (ut * ut) >>> 16; // u = low 51 bits, ut = u >> (51-16)
    const c = D.ATAN_C;
    i = Math.floor((c[3 * i]! * 65536 + ut * c[3 * i + 1]! - ut2 * c[3 * i + 2]!) / 0x2000000);
    const sg = copysign(1.0, x);
    const ta = sg * A[2 * i]!, id = sg * i;
    al = sg * A[2 * i + 1]! + 4.2111741079360304e-17 * id;
    h = (x - ta) / (1 + x * ta);
    ah = 0.012271846303085088 * id;
  }
  const h2 = h * h, h4 = h2 * h2;
  const f = ATAN_CH0 + h2 * ATAN_CH1 + h4 * (ATAN_CH2 + h2 * ATAN_CH3);
  al = fma(h, f, al);
  const e = h * 8.743006318923108e-16;
  const ub = al + e + ah, lb = al - e + ah;
  if (ub === lb) return ub;
  return atanRefine2(x, ub);
}

// ---------- asin (asin.c) and acos (acos.c) ----------

/** polydd (asin.c, acos.c): the polynomial with double-double coefficients c (n pairs) at xh + xl, plus l. */
function polyddAsin(xh: number, xl: number, n: number, c: Float64Array, l: number): number {
  let i = n - 1;
  let ch = fasttwosum(c[2 * i]!, l);
  l = LO;
  let cl = c[2 * i + 1]! + l;
  while (--i >= 0) {
    ch = muldd(xh, xl, ch, cl);
    cl = LO;
    ch = fastsum(c[2 * i]!, c[2 * i + 1]!, ch, cl);
    cl = LO;
  }
  LO = cl;
  return ch;
}

/** The fast path shared by asin and acos: (z + zl)*(cc[j][0] + cc[j][1] + t*P(t)) + f0h + f0l, LO = its low part. */
function asinPoly(cc: Float64Array, j: number, t: number, z: number, zl: number, f0h: number, f0l: number): number {
  const o = 8 * j;
  const t2 = t * t;
  const d = t * (cc[o + 2]! + t * cc[o + 3]! + t2 * (cc[o + 4]! + t * cc[o + 5]! + t2 * (cc[o + 6]! + t * cc[o + 7]!)));
  const c0 = cc[o]!, c1 = cc[o + 1]! + d;
  // fh + fl = muldd(z, zl, c0, c1), then fastsum(f0h, f0l, fh, fl), the helpers written out
  const ph = z * c0, pl = z * c1 + zl * c0 + mulErr(z, c0, ph);
  const sh = f0h + ph;
  LO = f0l + pl + (ph - (sh - f0h));
  return sh;
}

/** The arcsine, correctly rounded (CORE-MATH's cr_asin). */
export function asin(x: number): number {
  const ax = Math.abs(x);
  let t: number, z: number, zl: number, jd: number, f0h: number, f0l: number, eps: number;
  // exhaustive search done for 2^-4 <= x < 1 with and without FMA contraction
  if (!(ax <= 0.5)) {
    // |x|>0.5 (or NaN)
    f0h = x < 0 ? -1.5707963267948966 : 1.5707963267948966;
    f0l = x < 0 ? -6.123233995736766e-17 : 6.123233995736766e-17;
    if (!(ax < 1)) {
      if (ax === 1) return f0h + f0l; // |x| = 1
      if (x !== x) return x + x; // nan
      return NaN; // |x|>1
    }
    // asin(x) = pi/2 - 2*asin(sqrt((1-x)/2)), and for x<-0.5 acos(x) = -pi/2 + 2*asin(sqrt((1-|x|)/2))
    t = 2 - 2 * ax;
    jd = roundeven(t * 32);
    z = copysign(Math.sqrt(t), -x);
    zl = fma(z, z, -t) * ((-0.5 / t) * z);
    t = 0.25 * t - jd * 0.0078125;
    eps = Math.abs(z * t) * 3.5475095083725705e-16;
  } else {
    // |x|<=0.5; for |x| < 0x1.7137449123ef6p-26 |asin(x) - x| is less than half of ulp of asin(x)
    if (ax < 2.149119332890821e-8) return fma(2.7755575615628914e-17, x, x);
    f0h = 0;
    f0l = 0;
    t = x * x;
    jd = roundeven(t * 128);
    t = fma(x, x, -0.0078125 * jd);
    z = x;
    zl = 0;
    eps = Math.abs(z * t) * 3.2526065174565133e-16;
  }
  // asin(xh+xl) = (xh + xl)*(cc[j][0] + (cc[j][1] + t*Poly(t, cc[j]+2))), t = xh^2 - j/128, j = round(128*xh^2)
  const fh = asinPoly(D.ASIN_CC, jd, t, z, zl, f0h, f0l), fl = LO;
  const lb = fh + (fl - eps), ub = fh + (fl + eps);
  if (lb !== ub) return asinRefine(x, lb);
  return lb;
}

const S = D.ASIN_S;

/**
 * sin(delta) for the rotation of asin_refine/acos_refine: v + LO approximates (Ch+Cl)*(dsh+dsl) - (Sh+Sl)*(dch+dcl),
 * where |x| = Sh+Sl + dsh+dsl and ch+cl = sqrt(1-x^2) = Ch+Cl + dch+dcl, with Sh+Sl = sin(pi/64*j), Ch+Cl its cosine.
 */
function rotate(x: number, j: number): number {
  // Consider x as sin(phi) (asin) or cos(phi) (acos); ch + cl = sqrt(1-x^2).
  const s2 = x * x, dx2 = mulErr(x, x, s2);
  // s2+dx2 = x^2
  let c2h = fasttwosum(1.0, -s2);
  let c2l = LO;
  c2l -= dx2;
  c2h = fasttwosum(c2h, c2l);
  c2l = LO;
  // c2h+c2l approximates 1-x^2
  const ch = Math.sqrt(c2h);
  const cl = (c2l - fma(ch, ch, -c2h)) * (0.5 / ch);
  // now ch+cl approximates sqrt(1-x^2)
  const Ch = S[2 * (32 - j) + 1]!, Cl = S[2 * (32 - j)]!, Sh = S[2 * j + 1]!, Sl = S[2 * j]!;
  const ax = Math.abs(x);
  const dsh = ax - Sh, dsl = -Sl;
  const dch = ch - Ch, dcl = cl - Cl;
  const MAGIC = 0.09375;
  const Sc = fma(Sh, dch, MAGIC) - MAGIC;
  const dSc = fma(Sh, dch, -Sc);
  const Cs = fma(Ch, dsh, MAGIC) - MAGIC;
  const dCs = fma(Ch, dsh, -Cs);
  const v = Cs - Sc;
  const dv = Ch * dsl + Cl * dsh - (Sh * dcl + Sl * dch) - (dSc - dCs);
  return fasttwosum(v, dv);
}

/** The series of asin_refine/acos_refine: sg*(v + dv) times the asin polynomial in (v + dv)^2; LO = the low part. */
function asinSeries(v: number, dv: number, sg: number): number {
  const v2 = muldd(v, dv, v, dv), dv2 = LO;
  v *= sg;
  dv *= sg;
  const ct = D.ASIN_CT;
  let fl = v2 * (ct[0]! + v2 * (ct[1]! + v2 * ct[2]!));
  let fh = polyddAsin(v2, dv2, 5, D.ASIN_C, fl);
  fl = LO;
  fh = muldd(v, dv, fh, fl);
  return fh;
}

/** as_asin_refine: the accurate path; phi is the fast path's approximation of asin(x). */
function asinRefine(x: number, phi: number): number {
  const jf = roundeven(Math.abs(phi) * 20.371832715762604);
  // jf = round(|phi|*64/pi), 0 <= j <= 32
  const v = rotate(x, jf), dv = LO;
  const sgn = copysign(1.0, x), jt = jf * sgn;
  // jt is the signed table index: -32 <= jt <= 32
  const fh = asinSeries(v, dv, sgn), fl = LO;
  const pih = 0.04908738521234035, pil = 1.684469643174416e-16, pis = -3.917809439666406e-31;
  // pih+pil+pis approximates pi/2^6
  let ph = jt * pih, pl = jt * pil, ps = jt * pis;
  pl = fastsum(fh, fl, pl, ps);
  ps = LO;
  ph = fasttwosum(ph, pl);
  pl = LO;
  pl = fasttwosum(pl, ps);
  ps = LO;
  ph = fasttwosum(ph, pl);
  pl = LO;
  pl = fasttwosum(pl, ps);
  ps = LO;
  const th = asU64(ph), tl = asU64(pl) & (M64 >> 1n);
  const tn = BigInt.asUintN(64, (th & (0x7ffn << 52n)) - (53n << 52n));
  const gap = BigInt.asUintN(64, tn - tl);
  const hard = gap <= 2n || gap >> 52n > 47n;
  const res = ph + pl;
  if (hard) return asinDatabase(x, res);
  return res;
}

/** as_asin_database: the exceptional cases. */
function asinDatabase(x: number, f: number): number {
  const db = D.ASIN_DB;
  const ax = Math.abs(x);
  let a = 0, b = db.length / 3;
  while (a + 1 < b) {
    // binary search with invariant db[a][0] <= x < db[b][0]
    const m = (a + b) >> 1;
    if (db[3 * m]! <= ax) a = m;
    else b = m;
  }
  return db[3 * a] === ax ? (x > 0 ? db[3 * a + 1]! + db[3 * a + 2]! : -db[3 * a + 1]! - db[3 * a + 2]!) : f;
}

/** The arccosine, correctly rounded (CORE-MATH's cr_acos). */
export function acos(x: number): number {
  const ax = Math.abs(x);
  let t: number, z: number, zl: number, jd: number, f0h: number, f0l: number, eps: number;
  if (!(ax <= 0.5)) {
    // |x|>0.5 (or NaN)
    f0h = x < 0 ? 3.141592653589793 : 0;
    f0l = x < 0 ? 1.2246467991473532e-16 : 0;
    if (!(ax < 1)) {
      if (ax === 1) return f0h + f0l; // |x| = 1
      if (x !== x) return x + x; // nan
      return NaN; // |x|>1
    }
    // acos(x) = 2*asin(sqrt((1-x)/2)) for x > 0.5, pi - 2*asin(sqrt((1+x)/2)) for x < -0.5
    t = 2 - 2 * ax;
    jd = roundeven(t * 32);
    z = copysign(Math.sqrt(t), x);
    zl = fma(z, z, -t) * ((-0.5 / t) * z);
    t = 0.25 * t - jd * 0.0078125;
    eps = Math.abs(z * t) * 3.434752482434078e-16 + 2.465190328815662e-32;
  } else {
    // |x|<=0.5
    f0h = 1.5707963267948966;
    f0l = 6.123233995736766e-17;
    if (ax <= 0.000030517578125) {
      // |x| < 2^-15
      const c = -0.16666666666666666;
      // Avoid a spurious underflow for |x| <= 0x1.cb3b3869747f4p-55 (there lb=ub always).
      const v = ax <= 4.978996051474466e-17 ? 0 : x * x * (c * x);
      const h = fasttwosum(f0h, -x), w = LO;
      const l = v + (w + f0l);
      const eps1 = 1.990403348955723e-24;
      const lb = h + (l - eps1), ub = h + (l + eps1);
      if (lb !== ub) return acosRefine(x, lb);
      return lb;
    }
    // for 2^-15 <= |x| <= 0.5 we use acos(x) = pi/2 - asin(x)
    t = x * x;
    jd = roundeven(t * 128);
    t = fma(x, x, -0.0078125 * jd);
    z = -x;
    zl = 0;
    eps = z * t * 3.3393426912553537e-16; // eps < 0 for x > 0, but the rounding test is still correct
  }
  // an exhaustive search was performed in [-1,-2^-4] and [2^-4,1] with and without FMA contraction
  const fh = asinPoly(D.ACOS_CC, jd, t, z, zl, f0h, f0l), fl = LO;
  const lb = fh + (fl - eps), ub = fh + (fl + eps);
  if (lb !== ub) return acosRefine(x, lb);
  return lb;
}

/** as_acos_refine: the accurate path; phi is the fast path's approximation of acos(x). */
function acosRefine(x: number, phi: number): number {
  const jf = roundeven(Math.abs(phi - 1.5707963267948966) * 20.371832715762604);
  // jf = round(|phi-pi/2|*64/pi), 0 <= jf <= 32
  const v = rotate(x, jf), dv = LO;
  const sgn = copysign(1.0, x), jt = 32 - jf * sgn;
  // pi/2 -/+ jf*pi/64 = jt*pi/64 thus y = jt*pi/64 - delta, with 0 <= jt <= 64
  const fh = asinSeries(v, dv, -sgn), fl = LO;
  // now fh+fl approximates -delta
  let ph = jt * 0.04908738521234035, pl = 1.684469643174416e-16 * jt, ps = -3.917809439666406e-31 * jt;
  // since 0 <= jt <= 64, ph and pl are exact
  pl = sum(fh, fl, pl, ps);
  ps = LO;
  ph = fasttwosum(ph, pl);
  pl = LO;
  pl = fasttwosum(pl, ps);
  ps = LO;
  ph = fasttwosum(ph, pl);
  pl = LO;
  pl = fasttwosum(pl, ps);
  ps = LO;
  let tu = asU64(pl);
  let e = Number((tu >> 52n) & 0x7ffn) - 1023;
  e = 52 - (107 + e);
  e = e < 0 ? 0 : e;
  e = e > 52 ? 52 : e;
  const m = (1n << 52n) - (1n << BigInt(e));
  e = e === 0 ? 64 : e;
  if (!(BigInt.asUintN(64, tu + (1n << BigInt(e - 1))) & m)) {
    if (x === 0.999999999999936) return 3.5762786865234566e-7 + 1.3234889800848443e-23;
    if (x === 0.08298723566019295) return 1.4877135408445967 + 5.551115123125783e-17;
    if (x === 0.0009717008771394217) return 1.5698246257648432 + 1.6653345369377348e-16;
    if (x === 0.999999999999984) return 1.788139343261721e-7 + 6.617444900424222e-24;
    if (x === 0.038214879531014476) return 1.5325721397906955 - 1.5407439555097887e-33;
    tu = (asU64(ps) ^ tu) >> 63n ? tu - 1n : tu + 1n;
    pl = asF64(tu);
  }
  return ph + pl;
}

/** twosum (acos.c): s = a + b rounded, LO = the error (any magnitudes). */
function twosum(a: number, b: number): number {
  const s = a + b;
  const ap = s - b;
  const bp = s - ap;
  LO = a - ap + (b - bp);
  return s;
}

/** sum (acos.c): (xh + xl) + (ch + cl) as a double-double. */
function sum(xh: number, xl: number, ch: number, cl: number): number {
  const sh = twosum(xh, ch);
  LO = xl + cl + LO;
  return sh;
}

// ---------- sin (sin.c) and cos (cos.c) ----------

const U1 = D.SIN_U1, U2 = D.SIN_U2, T64 = D.SIN_T;
const [PS0, PS1, PS2, PS3] = D.SIN_PS as [bigint, bigint, bigint, bigint];
const [PC0, PC1, PC2, PC3, PC4] = D.SIN_PC as [bigint, bigint, bigint, bigint, bigint];
const S1U = D.SIN_S1U, S2U = D.SIN_S2U, C2U = D.SIN_C2U;
const SIN_PIH = -0.00019174759848570515, SIN_PIL = -7.474650873702107e-21;

/** u128_tod: (-1)^s * r/2^128 rounded to a double, for r non-zero and not subnormal. */
function u128Tod(r: bigint, s: number): number {
  const sh = clz64(r >> 64n);
  const h = Number(r >> BigInt(75 - sh)); // upper 53 non-zero bits
  const rbit = Number((r >> BigInt(74 - sh)) & 1n); // round bit
  const v = (s ? -1 : 1) * pow2(-53 - sh);
  const a = h * v, b = (rbit ? 0.75 : 0.375) * v;
  return a + b;
}

/** evalPS: Sr/2^128 ~ sin2pi(r) for 0 <= r < 2^-14; u/2^128 ~ 8r, u2 ~ (8r)^2, u4 ~ (8r)^4, u2h = floor(u2/2^64). */
function evalPSu(u: bigint, u2: bigint, u2h: bigint, u4: bigint): bigint {
  let sh = (PS2 - PS3 * u2h) & M128;
  sh = mhUU(sh, u4);
  let s = mhUU(PS1, u2);
  s = (PS0 - s) & M128;
  s = (s + sh) & M128;
  return mhUU(s, u);
}

/** evalPC: Cr/2^128 ~ cos2pi(r) for 0 <= r < 2^-14 (as evalPSu). */
function evalPCu(u2: bigint, u2h: bigint, u4: bigint): bigint {
  let sh = (PC3 - u2h * PC4) & M128;
  sh = (PC2 - mhUU(sh, u2)) & M128;
  let s = mhUU(PC1, u2);
  s = (PC0 - s) & M128;
  return (s + mhUU(sh, u4)) & M128;
}

/** reduceLargeAcc's second and third results (the C code's out-parameters r and neg). */
let reduceR = 0n, reduceNeg = 0;

/**
 * reduce_large_acc: the argument reduction of the accurate paths, for |x| >= 2^-27. Returns k (13 bits) and the
 * 128-bit r (reduceR) such that |x|/(2pi) mod 1 = k/2^13 + r/2^128 (r negated if reduceNeg) + eps, |r/2^128| <= 2^-14.
 */
function reduceLargeAcc(x: number): number {
  const e = (hiWord(x) >>> 20) & 0x7ff;
  const m = (1n << 52n) | (asU64(x) & 0xfffffffffffffn);
  // x = m * 2^(e-1075); i = ceil((e-1074)/64)
  const i = -1 + Math.trunc((e - 947) / 64);
  const f = BigInt((e - 1011) & 0x3f);
  let V0 = i >= 0 ? T64[i]! : 0n, V1 = T64[i + 1]!, V2 = T64[i + 2]!;
  if (f !== 0n) {
    V0 = ((V0 << f) | (V1 >> (64n - f))) & M64;
    V1 = ((V1 << f) | (V2 >> (64n - f))) & M64;
    V2 = ((V2 << f) | (T64[i + 3]! >> (64n - f))) & M64;
  }
  let u = V1 | (V0 << 64n);
  u = (m * u) & M128;
  const v = m * V2;
  u = (u + (v >> 64n)) & M128; // add contribution of m*V2 from 2^-76 to 2^-128
  let k = Number(u >> 115n);
  const mask = (1n << 115n) - 1n;
  u &= mask; // ignore leading 13 bits
  // round k to nearest to have |r/2^128| < 2^-14
  reduceNeg = Number(u >> 114n);
  if (reduceNeg) {
    // add 1 to k and subtract 1/2^13 to r
    k = (k + 1) & 0x1fff;
    u = mask + 1n - u;
  }
  reduceR = u;
  return k;
}

/** trigTables' second result: the approximation of cos(z). */
let trigC = 0n;

/** The tables' approximations (u128) of |sin(z)| (returned) and cos(z) (trigC), z = pi*i1/2^6 + pi*i2/2^12. */
function trigTables(i1: number, i2: number): bigint {
  const s1 = i1 <= 32 ? S1U[i1]! : S1U[64 - i1]!; // use sin(pi-x) = sin(x)
  const c1 = i1 <= 32 ? S1U[32 - i1]! : S1U[i1 - 32]!; // |C1u[i1]| = |S1u[(i1+32) mod 64]|
  let s1u = mhUU(s1, C2U[i2]!);
  let t = mhUU(c1, S2U[i2]!);
  s1u = (i1 < 32 ? s1u + t : s1u - t) & M128;
  let c1u = mhUU(c1, C2U[i2]!);
  t = mhUU(s1, S2U[i2]!);
  c1u = (i1 < 32 ? c1u - t : c1u + t) & M128;
  trigC = c1u;
  return s1u;
}

/** sin_large_accurate: the accurate path for |x| >= 2^-16. */
function sinLargeAccurate(x: number): number {
  const k = reduceLargeAcc(x);
  const neg = reduceNeg;
  const r = (reduceR << 3n) & M128; // replace r by 8*r
  const u2 = mhUU(r, r), u4 = mhUU(u2, u2), u2h = u2 >> 64n;
  let sbit = x > 0 ? 0 : 1;
  sbit ^= k >> 12;
  const i1 = (k >> 6) & 0x3f, i2 = k & 0x3f;
  let s1u = trigTables(i1, i2), c1u = trigC;
  const Sr = evalPSu(r, u2, u2h, u4); // Sr/2^128 approximates |sin(2*pi*r)|
  const Cr = evalPCu(u2, u2h, u4); // Cr/2^128 approximates cos(2*pi*r)
  // now combine: sin(x) ~ s1*C + c1*S
  s1u = mhUU(s1u, Cr);
  c1u = mhUU(c1u, Sr);
  if ((i1 < 32 ? 1 : 0) ^ neg) s1u = (s1u + c1u) & M128; // cos(z) * r > 0
  else if (s1u < c1u) {
    s1u = c1u - s1u;
    sbit ^= 1;
  } else s1u -= c1u;
  return u128Tod(s1u, sbit);
}

const SIN_SMALL_C0 = -0.16666666666666666, SIN_SMALL_C1 = -9.251854266180608e-18, SIN_SMALL_C2 = 0.00833333333327091;

/** sin_small_accurate: the accurate path for |x| < 2^-16. */
function sinSmallAccurate(x: number): number {
  const x2h = x * x, x2l = mulErr(x, x, x2h);
  let h = SIN_SMALL_C2 * x2h;
  h += SIN_SMALL_C1;
  h = fasttwosum(SIN_SMALL_C0, h);
  let l = LO;
  h = muldd(h, l, x2h, x2l);
  l = LO;
  h = muldd(h, l, x, 0);
  l = LO;
  h = fasttwosum(x, h);
  const t = LO;
  l += t;
  return h + l;
}

/** The table lookups of the fast paths: U1/U2 entries i1, i2 (offsets of 4 doubles). */
function sinFastS(i1: number, i2: number): number {
  const a = 4 * i1, b = 4 * i2;
  const s1h = muldd(U1[a]!, U1[a + 1]!, U2[b + 2]!, U2[b + 3]!), s1l = LO;
  const s2h = muldd(U2[b]!, U2[b + 1]!, U1[a + 2]!, U1[a + 3]!), s2l = LO;
  return fastsum(s1h, s1l, s2h, s2l);
}

/** cr_sin_moderate: the fast path for 2^-26 < |x| < 2^31; sbit is the sign bit of x. */
function sinModerate(x: number, sbit: number): number {
  const ax = Math.abs(x);
  const invpi = 5215.189175235227;
  const k = roundeven(invpi * ax);
  // rh = fma(k, pih, ax) is exact (C comment), so it equals ax + k*pih computed exactly: k*pih rounded is within a
  // factor 2 of -ax (or 0), thus ax + kp is exact (Sterbenz), and adding the product's error gives the exact rh.
  const kp = k * SIN_PIH;
  const rh = ax + kp + mulErr(k, SIN_PIH, kp), rl = k * SIN_PIL;
  const r = rh + rl; // |r| < 2^-13.339
  const r2 = r * r;
  // j = k (int64, < 2^45): its bits through doubles
  sbit ^= Math.floor(k / 16384) & 1; // reduction by an odd multiple of pi?
  const i1 = Math.floor(k / 128) & 0x7f, i2 = k & 0x7f;
  // Sh + Sl = fastsum(muldd(U1[i1][0..1], U2[i2][2..3]), muldd(U2[i2][0..1], U1[i1][2..3])), the helpers written out
  const a = 4 * i1, b = 4 * i2;
  const u0 = U1[a]!, u1 = U1[a + 1]!, u2 = U1[a + 2]!, u3 = U1[a + 3]!;
  const v0 = U2[b]!, v1 = U2[b + 1]!, v2 = U2[b + 2]!, v3 = U2[b + 3]!;
  const s1h = u0 * v2, s1l = u0 * v3 + u1 * v2 + mulErr(u0, v2, s1h);
  const s2h = v0 * u2, s2l = v0 * u3 + v1 * u2 + mulErr(v0, u2, s2h);
  const Sh = s1h + s2h, Sl = s1l + s2l + (s2h - (Sh - s1h));
  const Ch = u2 * v2 - u0 * v0;
  const sh = r * (1.0 - 0.16666666659950335 * r2);
  const ch = r2 * (-0.5 + 0.041666666655141404 * r2);
  let fh = Sh, fl = Sl + Sh * ch + Ch * sh;
  const sg = sbit ? -1.0 : 1.0;
  fh = sg * fh;
  fl = sg * fl;
  const eps = 1.0122043719688889e-19;
  const lb = fh + (fl - eps), ub = fh + (fl + eps);
  if (ub === lb) return lb;
  if (Math.abs(x) < 0.0000152587890625) return sinSmallAccurate(x);
  return sinLargeAccurate(x);
}

/** reduceLarge's second result (the C code's out-parameter r). */
let reduceLargeR = 0;

/** reduce_large: |x|/(2pi) mod 1 = j/2^15 + r + s (r in reduceLargeR) with 0 <= r < 2^-15, for |x| >= 2^31. */
function reduceLarge(x: number): number {
  const e = (hiWord(x) >>> 20) & 0x7ff; // 1054 <= e <= 2046
  const m = (1n << 52n) | (asU64(x) & 0xfffffffffffffn);
  const i = Math.trunc((e - 1011) / 64);
  const f = BigInt((e - 1011) & 0x3f);
  let V0: bigint, V1: bigint;
  if (f === 0n) {
    V0 = T64[i]!;
    V1 = T64[i + 1]!;
  } else {
    V0 = ((T64[i]! << f) | (T64[i + 1]! >> (64n - f))) & M64;
    V1 = ((T64[i + 1]! << f) | (T64[i + 2]! >> (64n - f))) & M64;
  }
  let u = V1 | (V0 << 64n);
  u = (m * u) & M128;
  // round r to nearest, where 0x810000000000000 = 2^59 + 2^52
  u = (u + (1n << 112n) + 0x810000000000000n) & M128;
  const tf = Number(((u << 15n) & M128) >> 75n); // next 53 bits of u after the first 15
  reduceLargeR = tf * 3.3881317890172014e-21 - 0.0000152587890625;
  return Number(u >> 113n);
}

/** cr_sin_large: the fast path for |x| >= 2^31. */
function sinLarge(x: number): number {
  const j = reduceLarge(Math.abs(x));
  const r = reduceLargeR;
  // now x/(2pi) ~ k + j/2^15 + r with 0 <= r < 2^-15
  let sbit = x > 0 ? 0 : 1;
  const r2 = r * r;
  sbit ^= j >> 14; // reduction by an odd multiple of pi?
  const i1 = (j >> 7) & 0x7f, i2 = j & 0x7f;
  const Sh = sinFastS(i1, i2), Sl = LO;
  const Ch = U1[4 * i1 + 2]! * U2[4 * i2 + 2]! - U1[4 * i1]! * U2[4 * i2]!;
  const sh = r * (6.283185307179586 - 41.341700961418276 * r2);
  const ch = r2 * (-19.739208802178716 + 64.93938786554104 * r2);
  let fh = Sh, fl = Sl + Sh * ch + Ch * sh;
  const sg = sbit ? -1.0 : 1.0;
  fh = sg * fh;
  fl = sg * fl;
  const eps = 1.088437337221776e-19;
  const lb = fh + (fl - eps), ub = fh + (fl + eps);
  if (lb === ub) return lb;
  return sinLargeAccurate(x);
}

/** The sine, correctly rounded (CORE-MATH's cr_sin). */
export function sin(x: number): number {
  const hx = hiWord(x);
  const e = (hx >>> 20) & 0x7ff;
  if (e < 0x3ff - 26) {
    // |x| < 2^-26: |sin(x) - x| < 1/2 ulp; Taylor expansion x - x^3/6
    if (x === 0) return x;
    return fma(x, -5.551115123125783e-17, x);
  }
  if (e < 0x3ff + 31) return sinModerate(x, hx >>> 31); // |x| < 2^31
  if (e === 0x7ff) return NaN; // NaN, +Inf and -Inf
  return sinLarge(x); // |x| >= 2^31
}

/** cos's exceptions of the accurate path. */
function cosExceptions(x: number, ret: number): number {
  const ax = Math.abs(x);
  if (ax === 1.788139343261721e-7) return 0.999999999999984 + 1.5323198707391886e-43;
  if (ax === 3.5762786865234566e-7) return 0.999999999999936 + 9.80684717273083e-42;
  if (ax === 7.152557373047027e-7) return 0.9999999999997442 + 6.276382190547788e-40;
  if (ax === 0.0000010728836059570827) return 0.9999999999994245 + 7.14919158892095e-39;
  return ret;
}

/** cos_large_accurate: the accurate path for 2^-27 <= x (x >= 0). */
function cosLargeAccurate(x: number): number {
  const k = reduceLargeAcc(x);
  const neg = reduceNeg;
  const r = (reduceR << 3n) & M128; // replace r by 8*r
  const u2 = mhUU(r, r), u4 = mhUU(u2, u2), u2h = u2 >> 64n;
  let sbit = (k >> 12) & 1;
  const i1 = (k >> 6) & 0x3f, i2 = k & 0x3f;
  let s1u = trigTables(i1, i2), c1u = trigC;
  const Sr = evalPSu(r, u2, u2h, u4);
  const Cr = evalPCu(u2, u2h, u4);
  // now combine: cos(x) ~ c1*C - s1*S
  c1u = mhUU(c1u, Cr);
  s1u = mhUU(s1u, Sr);
  if ((i1 >= 32 ? 1 : 0) ^ neg) c1u = (c1u + s1u) & M128; // cos(z) * r < 0
  else if (c1u <= s1u) {
    c1u = s1u - c1u;
    sbit ^= 1;
  } else c1u -= s1u;
  // if i1 >= 32, cos(z) <= 0 thus we should exchange signs
  const ret = u128Tod(c1u, sbit ^ (i1 >= 32 ? 1 : 0));
  const d = BigInt.asUintN(64, (c1u & M64) + 5n);
  if (d <= 3n) return cosExceptions(x, ret);
  return ret;
}

/** The table lookups of cos's fast paths: Ch + LO ~ cos(t1+t2), t1 = i1*pi/2^7, t2 = i2*pi/2^14. */
function cosFastC(i1: number, i2: number): number {
  const a = 4 * i1, b = 4 * i2;
  const c1h = muldd(U1[a + 2]!, U1[a + 3]!, U2[b + 2]!, U2[b + 3]!), c1l = LO;
  const c2h = muldd(U2[b]!, U2[b + 1]!, U1[a]!, U1[a + 1]!), c2l = LO;
  return fastsum(c1h, c1l, -c2h, -c2l);
}

/** cr_cos_moderate: the fast path for 2^-27 <= x < 2^31 (x >= 0). */
function cosModerate(x: number): number {
  const invpi = 5215.189175235227;
  const k = roundeven(invpi * x);
  // rh = fma(k, pih, x), exact (see sinModerate)
  const kp = k * SIN_PIH;
  const rh = x + kp + mulErr(k, SIN_PIH, kp), rl = k * SIN_PIL;
  const r = rh + rl;
  const r2 = r * r;
  const sbit = Math.floor(k / 16384) & 1; // reduction by an odd multiple of pi?
  const i1 = Math.floor(k / 128) & 0x7f, i2 = k & 0x7f;
  // Ch + Cl = fastsum(muldd(U1[i1][2..3], U2[i2][2..3]), -muldd(U2[i2][0..1], U1[i1][0..1])), the helpers written out
  const a = 4 * i1, b = 4 * i2;
  const u0 = U1[a]!, u1 = U1[a + 1]!, u2 = U1[a + 2]!, u3 = U1[a + 3]!;
  const v0 = U2[b]!, v1 = U2[b + 1]!, v2 = U2[b + 2]!, v3 = U2[b + 3]!;
  const c1h = u2 * v2, c1l = u2 * v3 + u3 * v2 + mulErr(u2, v2, c1h);
  const c2h = v0 * u0, c2l = v0 * u1 + v1 * u0 + mulErr(v0, u0, c2h);
  const Ch = c1h + -c2h, Cl = c1l + -c2l + (-c2h - (Ch - c1h));
  const Sh = u0 * v2 + u2 * v0;
  const sh = r * (1.0 - 0.16666666659950335 * r2);
  const ch = r2 * (-0.5 + 0.041666666655141404 * r2);
  let fh = Ch, fl = Cl + Ch * ch - Sh * sh;
  const sg = sbit ? -1.0 : 1.0;
  fh = sg * fh;
  fl = sg * fl;
  const eps = 1.0122043719688889e-19;
  const lb = fh + (fl - eps), ub = fh + (fl + eps);
  if (ub === lb) return lb;
  return cosLargeAccurate(x);
}

/** cr_cos_large: the fast path for x >= 2^31. */
function cosLarge(x: number): number {
  const j = reduceLarge(x);
  const r = reduceLargeR;
  const r2 = r * r;
  const sbit = j >> 14;
  const i1 = (j >> 7) & 0x7f, i2 = j & 0x7f;
  const Ch = cosFastC(i1, i2), Cl = LO;
  const Sh = U1[4 * i1]! * U2[4 * i2 + 2]! + U1[4 * i1 + 2]! * U2[4 * i2]!;
  const sh = r * (6.283185307179586 - 41.341700961418276 * r2);
  const ch = r2 * (-19.739208802178716 + 64.93938786554104 * r2);
  let fh = Ch, fl = Cl + Ch * ch - Sh * sh;
  const sg = sbit ? -1.0 : 1.0;
  fh = sg * fh;
  fl = sg * fl;
  const eps = 1.088437337221776e-19;
  const lb = fh + (fl - eps), ub = fh + (fl + eps);
  if (lb === ub) return lb;
  return cosLargeAccurate(x);
}

/** The cosine, correctly rounded (CORE-MATH's cr_cos). */
export function cos(x: number): number {
  const z = Math.abs(x);
  const e = hiWord(z) >>> 20;
  if (e < 0x3ff - 27) return fma(x, -x, 1.0); // |x| < 2^-27: cos(x) rounds to 1 to nearest
  if (e < 0x3ff + 31) return cosModerate(z); // |x| < 2^31
  if (e === 0x7ff) return NaN; // NaN, +Inf and -Inf
  return cosLarge(z); // z >= 2^31
}

// ---------- tan (tan.c) ----------

/** dint64_t: (-1)^sgn * (r/2^128) * 2^ex, r = hi*2^64 + lo (128 bits). */
interface Dint {
  r: bigint;
  ex: number;
  sgn: number;
}

const DZERO: Dint = { r: 0n, ex: -1076, sgn: 0 };
const DONE: Dint = { r: 1n << 127n, ex: 1, sgn: 0 };
const DMAGIC: Dint = { r: 1n << 127n, ex: -10, sgn: 0 }; // 1/2^11

const tanS = (i: number): Dint => ({ r: D.TAN_S_R[i]!, ex: D.TAN_S_EX[i]!, sgn: D.TAN_S_SGN[i]! });
const tanC = (i: number): Dint => ({ r: D.TAN_C_R[i]!, ex: D.TAN_C_EX[i]!, sgn: D.TAN_C_SGN[i]! });
const tanPS = (i: number): Dint => ({ r: D.TAN_PS_R[i]!, ex: D.TAN_PS_EX[i]!, sgn: D.TAN_PS_SGN[i]! });
const tanPC = (i: number): Dint => ({ r: D.TAN_PC_R[i]!, ex: D.TAN_PC_EX[i]!, sgn: D.TAN_PC_SGN[i]! });

/** cmp_dint_abs: -1, 0 or 1 as |a| <, =, > |b|. */
function cmpDintAbs(a: Dint, b: Dint): number {
  const az = a.r >> 64n === 0n, bz = b.r >> 64n === 0n; // dint_zero_p: hi == 0
  if (az) return bz ? 0 : -1;
  if (bz) return 1;
  if (a.ex !== b.ex) return a.ex > b.ex ? 1 : -1;
  return a.r > b.r ? 1 : a.r < b.r ? -1 : 0;
}

/** add_dint: a + b, error bounded by 2 ulps (exact in the Sterbenz case). */
function addDint(a: Dint, b: Dint): Dint {
  if (a.r === 0n) return { r: b.r, ex: b.ex, sgn: b.sgn };
  switch (cmpDintAbs(a, b)) {
    case 0:
      if (a.sgn ^ b.sgn) return { r: DZERO.r, ex: DZERO.ex, sgn: DZERO.sgn };
      return { r: a.r, ex: a.ex + 1, sgn: a.sgn };
    case -1: {
      const tmp = a;
      a = b;
      b = tmp;
      break;
    }
  }
  // From now on, |A| > |B| thus a->ex >= b->ex
  const A0 = a.r;
  let B = b.r;
  const k = a.ex - b.ex;
  if (k > 0) B = k < 128 ? B >> BigInt(k) : 0n;
  let C: bigint;
  let ex = a.ex;
  if (a.sgn ^ b.sgn) {
    C = (A0 - B) & M128;
    const ch = C >> 64n;
    let e = ch !== 0n ? clz64(ch) : 64 + clz64(C & M64);
    if (e > 0) {
      const be = BigInt(e);
      if (k === 1) C = (((A0 << be) & M128) - ((b.r << (be - 1n)) & M128)) & M128; // Sterbenz case
      else C = (((A0 << be) & M128) - ((B << be) & M128)) & M128;
      ex -= e;
      e = clz64(C >> 64n);
    }
    C = (C << BigInt(e)) & M128;
    ex -= e;
  } else {
    C = A0 + B;
    if (C > M128) {
      C = (1n << 127n) | ((C & M128) >> 1n);
      ex++;
    }
  }
  return { r: C, ex, sgn: a.sgn };
}

/** mul_dint: a * b, error bounded by 6 ulps. */
function mulDint(a: Dint, b: Dint): Dint {
  const ah = a.r >> 64n, al = a.r & M64, bh = b.r >> 64n, bl = b.r & M64;
  const m1 = ah * bl, m2 = al * bh;
  let r = ah * bh;
  r += (m1 >> 64n) + (m2 >> 64n);
  const ex = Number(r >> 127n); // ensure that hi starts with a 1
  r = (r << BigInt(1 - ex)) & M128;
  return { r, ex: a.ex + b.ex + ex - 1, sgn: a.sgn ^ b.sgn };
}

/** mul_dint_21: a * b assuming the low part of b is zero, error bounded by 2 ulps. */
function mulDint21(a: Dint, b: Dint): Dint {
  const bh = b.r >> 64n;
  const hi = (a.r >> 64n) * bh, lo = (a.r & M64) * bh;
  let r = hi + (lo >> 64n);
  const ex = Number(r >> 127n);
  r = (r << BigInt(1 - ex)) & M128;
  return { r, ex: a.ex + b.ex + ex - 1, sgn: a.sgn ^ b.sgn };
}

/** inv_dint: 1/a, relative error < 2^-124.999. */
function invDint(a: Dint): Dint {
  const h = a.r >> 64n; // 2^63 <= h < 2^64
  const i = Number((h >> 55n) & 0xffn);
  let t = D.TAN_TINV[i]!;
  const P127 = 1n << 127n;
  // three Newton iterations on the 64-bit inverse t of h (t*h ~ 2^127)
  let e = (P127 - h * t) & M128;
  e = (t * (e >> 55n)) & M128;
  t = (t + (e >> 72n)) & M64;
  e = (P127 - h * t) & M128;
  e = (t * (e >> 47n)) & M128;
  t = (t + (e >> 80n)) & M64;
  e = (P127 - h * t) & M128;
  e = (t * (e >> 31n)) & M128;
  t = (t + (e >> 96n)) & M64;
  const r: Dint = { r: t << 64n, ex: 1 - a.ex, sgn: 1 };
  // Newton's iteration: r -> r + r*(1-a*r)
  let q = mulDint21(a, r); // -a*r
  r.sgn = 0;
  q = addDint(DONE, q); // 1-a*r
  q = mulDint(r, q); // r*(1-a*r)
  return addDint(r, q);
}

/** div_dint: b/a, relative error < 2^-123.67. */
function divDint(b: Dint, a: Dint): Dint {
  return mulDint(invDint(a), b);
}

/** dint_fromd: a non-zero double as a dint64_t. */
function dintFromd(b: number): Dint {
  const u = asU64(b);
  let e = Number((u >> 52n) & 0x7ffn);
  const m = (u & 0xfffffffffffffn) + (e ? 1n << 52n : 0n);
  e = e - 0x3fe;
  const t = clz64(m);
  return { r: ((m << BigInt(t)) & M64) << 64n, ex: e - (t > 11 ? t - 12 : 0), sgn: b < 0.0 ? 1 : 0 };
}

/** subnormalize_dint (rounding to nearest). */
function subnormalizeDint(a: Dint): void {
  if (a.ex > -1023) return;
  const ex = BigInt(-(1011 + a.ex));
  const ahi = a.r >> 64n;
  let hi = ahi >> ex;
  const md = (ahi >> (ex - 1n)) & 1n;
  const lo = (ahi & (M64 >> ex)) !== 0n || (a.r & M64) !== 0n;
  hi += lo ? md : hi & md;
  let nhi = (hi << ex) & M64;
  if (nhi === 0n) {
    a.ex++;
    nhi = 1n << 63n;
  }
  a.r = nhi << 64n;
}

/** dint_tod: a dint64_t rounded to a double. */
function dintTod(a: Dint): number {
  subnormalizeDint(a);
  const hi = a.r >> 64n;
  let r = 1 + Number((hi >> 11n) & 0xfffffffffffffn) * 2.220446049250313e-16;
  let rd = 0.0;
  if ((hi >> 10n) & 1n) rd += 1.1102230246251565e-16;
  if (hi & 0x3ffn || a.r & M64) rd += 5.551115123125783e-17;
  if (a.sgn) {
    rd = -rd;
    r = -r;
  }
  r += rd;
  let e: number;
  if (a.ex > -1022) {
    // The result is a normal double
    if (a.ex > 1024)
      if (a.ex === 1025) {
        r = r * 2;
        e = 8.98846567431158e+307;
      } else {
        r = 1.7976931348623157e+308;
        e = 1.7976931348623157e+308;
      }
    else e = pow2(a.ex - 1);
  } else if (a.ex < -1073) {
    if (a.ex === -1074) {
      r = r * 0.5;
      e = 5e-324;
    } else {
      r = 5e-324;
      e = 5e-324;
    }
  } else e = pow2(a.ex - 1 + 64) * 5.421010862427522e-20; // 2^(ex-1), subnormal
  return r * e;
}

/** normalize: shift X so that its hi has its most significant bit set (if X <> 0). */
function normalizeDint(X: Dint): void {
  let hi = X.r >> 64n, lo = X.r & M64;
  if (hi !== 0n) {
    const cnt = clz64(hi);
    if (cnt) {
      const c = BigInt(cnt);
      hi = ((hi << c) | (lo >> (64n - c))) & M64;
      lo = (lo << c) & M64;
    }
    X.ex -= cnt;
  } else if (lo !== 0n) {
    const cnt = clz64(lo);
    hi = (lo << BigInt(cnt)) & M64;
    lo = 0n;
    X.ex -= 64 + cnt;
  }
  X.r = (hi << 64n) | lo;
}

/** reduce: X <- X/(2pi) mod 1, relative error < 2^-126.67; X normalized at input and output. */
function reduceDint(X: Dint): void {
  const T = D.TAN_T;
  let e = X.ex;
  const xhi = X.r >> 64n;
  let u: bigint;
  if (e <= 1) {
    // |X| < 2: multiply by T[0]/2^64 + T[1]/2^128
    u = xhi * T[1]!;
    const tiny = u & M64;
    let lo = u >> 64n;
    u = xhi * T[0]!;
    lo = (lo + (u & M64)) & M64;
    const hi = (u >> 64n) + (lo < (u & M64) ? 1n : 0n);
    X.r = (hi << 64n) | lo;
    e = X.ex;
    normalizeDint(X);
    e = e - X.ex;
    // put the upper e bits of tiny into X->lo
    if (e) X.r |= tiny >> BigInt(64 - e);
    return;
  }
  // now 2 <= e <= 1024
  const i = e < 127 ? 0 : Math.trunc((e - 127 + 64 - 1) / 64); // ceil((e-127)/64)
  const c = [0n, 0n, 0n, 0n, 0n];
  u = xhi * T[i + 3]!;
  c[0] = u & M64;
  c[1] = u >> 64n;
  u = xhi * T[i + 2]!;
  c[1] = (c[1] + (u & M64)) & M64;
  c[2] = (u >> 64n) + (c[1] < (u & M64) ? 1n : 0n);
  u = xhi * T[i + 1]!;
  c[2] = (c[2] + (u & M64)) & M64;
  c[3] = (u >> 64n) + (c[2] < (u & M64) ? 1n : 0n);
  u = xhi * T[i]!;
  c[3] = (c[3] + (u & M64)) & M64;
  c[4] = ((u >> 64n) + (c[3] < (u & M64) ? 1n : 0n)) & M64;
  const f = e - 64 * i; // hi*T[i]/2^128 is multiplied by 2^f
  let hi: bigint, lo: bigint, tiny: bigint;
  if (f < 64) {
    const F = BigInt(f), G = BigInt(64 - f);
    hi = ((c[4] << F) & M64) | (c[3] >> G);
    lo = ((c[3] << F) & M64) | (c[2] >> G);
    tiny = ((c[2] << F) & M64) | (c[1] >> G);
  } else if (f === 64) {
    hi = c[3];
    lo = c[2];
    tiny = c[1];
  } else {
    // 65 <= f <= 127: this case can only occur when e >= 65
    const g = BigInt(f - 64), G = BigInt(128 - f); // 1 <= g <= 63
    u = (xhi * T[i + 4]!) >> 64n;
    c[0] = (c[0] + u) & M64;
    const cy = c[0] < u;
    c[1] = (c[1] + (cy ? 1n : 0n)) & M64;
    c[2] = (c[2] + (cy && c[1] === 0n ? 1n : 0n)) & M64;
    c[3] = (c[3] + (cy && c[1] === 0n && c[2] === 0n ? 1n : 0n)) & M64;
    c[4] = (c[4] + (cy && c[1] === 0n && c[2] === 0n && c[3] === 0n ? 1n : 0n)) & M64;
    hi = ((c[3] << g) & M64) | (c[2] >> G);
    lo = ((c[2] << g) & M64) | (c[1] >> G);
    tiny = ((c[1] << g) & M64) | (c[0] >> G);
  }
  X.r = (hi << 64n) | lo;
  X.ex = 0;
  normalizeDint(X);
  if (X.ex < 0) X.r |= tiny >> BigInt(64 + X.ex); // put the upper -ex bits of tiny into low bits of lo
}

/** reduce2: Xin = i/2^11 + Xout with 0 <= Xout < 2^-11 (exact), for 0 <= Xin < 1. */
function reduce2Dint(X: Dint): number {
  if (X.ex <= -11) return 0;
  const sh = BigInt(64 - 11 - X.ex);
  const hi = X.r >> 64n;
  const i = Number(hi >> sh);
  X.r = ((hi & ((1n << sh) - 1n)) << 64n) | (X.r & M64);
  normalizeDint(X);
  return i;
}

/** evalPS: sin2pi(X) for 0 <= X < 2^-11, X2 ~ X^2. */
function evalPSDint(X: Dint, X2: Dint): Dint {
  let Y = mulDint21(X2, tanPS(5)); // degree 11
  Y = addDint(Y, tanPS(4)); // degree 9
  Y = mulDint(Y, X2);
  Y = addDint(Y, tanPS(3)); // degree 7
  Y = mulDint(Y, X2);
  Y = addDint(Y, tanPS(2)); // degree 5
  Y = mulDint(Y, X2);
  Y = addDint(Y, tanPS(1)); // degree 3
  Y = mulDint(Y, X2);
  Y = addDint(Y, tanPS(0)); // degree 1
  return mulDint(Y, X); // multiply by X
}

/** evalPC: cos2pi(X) for 0 <= X < 2^-11, X2 ~ X^2. */
function evalPCDint(X2: Dint): Dint {
  let Y = mulDint21(X2, tanPC(5)); // degree 10
  Y = addDint(Y, tanPC(4)); // degree 8
  Y = mulDint(Y, X2);
  Y = addDint(Y, tanPC(3)); // degree 6
  Y = mulDint(Y, X2);
  Y = addDint(Y, tanPC(2)); // degree 4
  Y = mulDint(Y, X2);
  Y = addDint(Y, tanPC(1)); // degree 2
  Y = mulDint(Y, X2);
  return addDint(Y, tanPC(0)); // degree 0
}

/** tan_accurate: tan(x) for a regular x with |x| > 0x1.d12ed0af1a27ep-27. */
function tanAccurate(x: number): number {
  const absx = x > 0 ? x : -x;
  const X = dintFromd(absx);
  reduceDint(X);
  // now |X - x/(2pi) mod 1| < 2^-126.67*X, with 0 <= X < 1.
  let isTan = 1, neg = x < 0 ? 1 : 0;
  let i = reduce2Dint(X); // exact
  i = i & 0x3ff; // if pi <= x < 2*pi, tan(x) = tan(x-pi)
  if (i & 0x200) {
    // pi/2 <= x < pi: tan(x) = -1/tan(x-pi/2)
    isTan = 0;
    neg = neg ? 0 : 1;
    i = i & 0x1ff;
  }
  let Xr = X;
  if (i & 0x100) {
    // pi/4 <= x < pi/2: tan(x) = 1/tan(pi/2-x)
    isTan = isTan ? 0 : 1;
    X.sgn = 1; // negate X
    Xr = addDint(DMAGIC, X); // X -> 2^-11 - X
    i = 0x1ff - i;
  }
  const X2 = mulDint(Xr, Xr); // X2 approximates X^2
  let U = evalPCDint(X2); // cos2pi(X)
  let V = evalPSDint(Xr, X2); // sin2pi(X)
  // sin2pi(R) ~ sin2pi(i/2^11)*cos2pi(X)+cos2pi(i/2^11)*sin2pi(X)
  const UU = mulDint(tanS(i), U);
  const VV = mulDint(tanC(i), V);
  const Sin = addDint(UU, VV);
  // cos2pi(R) ~ cos2pi(i/2^11)*cos2pi(X)-sin2pi(i/2^11)*sin2pi(X)
  U = mulDint(tanC(i), U);
  V = mulDint(tanS(i), V);
  V.sgn = 1 - V.sgn; // negate V
  const Cos = addDint(U, V);
  // Now if is_tan=1 we compute S/C, otherwise we compute C/S.
  U = isTan ? divDint(Sin, Cos) : divDint(Cos, Sin);
  const err = 86n;
  const ulo = U.r & M64, uhi = U.r >> 64n;
  const lo0 = BigInt.asUintN(64, ulo - err);
  const hi0 = BigInt.asUintN(64, uhi - (lo0 > ulo ? 1n : 0n));
  const lo1 = BigInt.asUintN(64, ulo + err);
  const hi1 = BigInt.asUintN(64, uhi + (lo1 < ulo ? 1n : 0n));
  // check the upper 54 bits are equal
  if (hi0 >> 10n !== hi1 >> 10n) {
    const ax = Math.abs(x);
    // the following has 78 identical bits after the round bit
    if (ax === 4.470348358154178e-7) return x > 0 ? 4.4703483581544753e-7 + 2.6469779601696883e-23 : -4.4703483581544753e-7 - 2.6469779601696883e-23;
    // the following has 72 identical bits after the round bit
    if (ax === 8.940696716307641e-7) return x > 0 ? 8.940696716310023e-7 + -7.828575563803332e-45 : -8.940696716310023e-7 - -7.828575563803332e-45;
    // otherwise a hard-to-round case, but all of them are known and pass all tests
  }
  if (neg) U.sgn = 1 - U.sgn;
  return dintTod(U);
}

/** The low part of the double-double results of tan's helpers (the C code's out-parameters l, lo). */
let tanL = 0;

/** a_mul + fma: s_mul, a * (bh + bl) as a double-double (low part in tanL). */
function sMul(a: number, bh: number, bl: number): number {
  const hi = a * bh;
  tanL = fma(a, bl, mulErr(a, bh, hi));
  return hi;
}

/** d_mul: (ah + al) * (bh + bl) - al*bl as a double-double (low part in tanL). */
function dMul(ah: number, al: number, bh: number, bl: number): number {
  const hi = ah * bh;
  const s = mulErr(ah, bh, hi);
  const t = fma(al, bh, s);
  tanL = fma(ah, bl, t);
  return hi;
}

/** set_dd: c1/2^64 + c0/2^128 as a double-double rounded towards zero (low part in tanL). */
function setDd(c1: bigint, c0: bigint): number {
  let h: number;
  if (c1) {
    const e = clz64(c1);
    if (e) {
      const E = BigInt(e);
      c1 = ((c1 << E) | (c0 >> (64n - E))) & M64;
      c0 = (c0 << E) & M64;
    }
    const f = BigInt(0x3fe - e);
    h = asF64((f << 52n) | (((c1 << 1n) & M64) >> 12n));
    c0 = ((c1 << 53n) & M64) | (c0 >> 11n);
    if (c0) {
      const g = clz64(c0);
      if (g) c0 = (c0 << BigInt(g)) & M64;
      tanL = asF64(((f - 53n - BigInt(g)) << 52n) | (((c0 << 1n) & M64) >> 12n));
    } else tanL = 0;
  } else if (c0) {
    const e = clz64(c0);
    const f = BigInt(0x3fe - 64 - e);
    c0 = (c0 << BigInt(e + 1)) & M64; // most significant bit shifted out
    h = asF64((f << 52n) | (c0 >> 12n)); // the upper 52 bits of c0
    c0 = (c0 << 52n) & M64; // the lower 12 bits of c0
    if (c0) {
      const g = clz64(c0);
      c0 = (c0 << BigInt(g + 1)) & M64;
      tanL = asF64(((f - 64n - BigInt(g)) << 52n) | (c0 >> 12n));
    } else tanL = 0;
  } else h = tanL = 0;
  return h;
}

/** reduceFast's second result (the C code's out-parameter h; l is in tanL). */
let reduceFastH = 0;

/** reduce_fast: i/2^11 + h + l approximates frac(x/(2pi)) for 0x1.7137449123ef6p-26 < x < +Inf; returns i. */
function reduceFast(x: number): number {
  let h: number;
  if (x <= 6.283185307179585) {
    // x < 2*pi; | CH+CL - 1/(2pi) | < 2^-110.523
    const CH = 0.15915494309189535, CL = -9.839338337591243e-18;
    h = CH * x;
    tanL = fma(CL, x, mulErr(CH, x, h));
  } else {
    const T = D.TAN_T;
    const ux = asU64(x);
    let e = Number((ux >> 52n) & 0x7ffn); // 1025 <= e <= 2046
    const m = (1n << 52n) | (ux & 0xfffffffffffffn);
    let c0: bigint, c1: bigint, c2: bigint, u: bigint;
    if (e <= 1074) {
      // 1025 <= e <= 1074: 2^2 <= x < 2^52
      const v = m * T[2]!;
      u = m * T[1]!;
      c0 = (u + (v >> 64n)) & M64;
      c1 = (u >> 64n) + (c0 < (u & M64) ? 1n : 0n);
      u = m * T[0]!;
      c1 = (c1 + (u & M64)) & M64;
      c2 = ((u >> 64n) + (c1 < (u & M64) ? 1n : 0n)) & M64;
      e = 1075 - e; // 1 <= e <= 50
    } else {
      // 1075 <= e <= 2046, 2^52 <= x < 2^1024
      const i = Math.trunc((e - 1138 + 63) / 64); // i = ceil((e-1138)/64), 0 <= i <= 15
      const v = m * T[i + 3]!;
      u = m * T[i + 2]!;
      c0 = (u + (v >> 64n)) & M64;
      c1 = (u >> 64n) + (c0 < (u & M64) ? 1n : 0n);
      u = m * T[i + 1]!;
      c1 = (c1 + (u & M64)) & M64;
      c2 = (u >> 64n) + (c1 < (u & M64) ? 1n : 0n);
      u = m * T[i]!;
      c2 = (c2 + (u & M64)) & M64;
      e = 1139 + (i << 6) - e; // 1 <= e <= 64
    }
    // e is the number of bits of c[2] to ignore
    if (e === 64) {
      c0 = c1;
      c1 = c2;
    } else {
      const E = BigInt(e), F = BigInt(64 - e);
      c0 = ((c1 << F) & M64) | (c0 >> E);
      c1 = ((c2 << F) & M64) | (c1 >> E);
    }
    h = setDd(c1, c0);
  }
  const i = Math.floor(h * 2048);
  reduceFastH = fma(i, -0.00048828125, h);
  return i;
}

/** fast_div: (bh + bl) / (ah + al) as a double-double (low part in tanL), relative error < 2^-96.99. */
function fastDiv(bh: number, bl: number, ah: number, al: number): number {
  const y = 1.0 / ah;
  const h = bh * y;
  const eh = fma(ah, -h, bh);
  const el = fma(al, -h, bl);
  tanL = y * (eh + el);
  return h;
}

/** tanFast's high part (the C code's out-parameter h). */
let tanH = 0;

/** tan_fast: tanH + tanL ~ tan(x) for a finite |x| > 0x1.d12ed0af1a27ep-27; returns the error bound. */
function tanFast(x: number): number {
  let neg = x < 0 ? 1 : 0, isTan = 1;
  const absx = neg ? -x : x;
  let i = reduceFast(absx);
  let h = reduceFastH, l = tanL;
  // | i/2^11 + h + l - frac(x/(2pi)) | < 2^-104.815
  i = i & 0x3ff; // tan(pi+x) = tan(x)
  isTan = isTan ^ (i >> 9); // tan(pi/2+x) = -cot(x)
  neg = neg ^ (i >> 9);
  i = i & 0x1ff;
  if (i & 0x100) {
    // case pi/4 <= x_red <= pi/2: tan(pi/2-x) = cot(x)
    isTan = isTan ? 0 : 1;
    i = 0x1ff - i;
    h = 0.00048828125 - h; // exact
    l = -l;
  }
  if (i === 0 && h < 7.275957614183426e-12) {
    // the slow path (C returns the reduced h, l with the error bound 1)
    tanH = h;
    tanL = l;
    return 1;
  }
  const SC = D.TAN_SC, PSf = D.TAN_PSFAST, PCf = D.TAN_PCFAST;
  h -= SC[3 * i]!;
  // fast_two_sum (h, l, *h, *l)
  {
    const s = h + l, e = s - h;
    l = l - e;
    h = s;
  }
  // uh+ul approximates (h+l)^2
  const uh = h * h;
  const ul = fma(h + h, l, mulErr(h, h, uh));
  // evalPSfast: sh + sl ~ sin2pi(h+l)
  let sh = PSf[4]!;
  sh = fma(sh, uh, PSf[3]!);
  sh = fma(sh, uh, PSf[2]!);
  sh = sMul(sh, uh, ul);
  let sl = tanL;
  {
    const s = PSf[0]! + sh, e = s - PSf[0]!;
    const t = sh - e;
    sh = s;
    sl += PSf[1]! + t;
  }
  sh = dMul(sh, sl, h, l);
  sl = tanL;
  // evalPCfast: ch + cl ~ cos2pi(h+l)
  let ch = PCf[4]!;
  ch = fma(ch, uh, PCf[3]!);
  ch = fma(ch, uh, PCf[2]!);
  ch = sMul(ch, uh, ul);
  let cl = tanL;
  {
    const s = PCf[0]! + ch, e = s - PCf[0]!;
    const t = ch - e;
    ch = s;
    cl += PCf[1]! + t;
  }
  const sh0 = sMul(SC[3 * i + 2]!, sh, sl), sl0 = tanL;
  const ch0 = sMul(SC[3 * i + 1]!, ch, cl), cl0 = tanL;
  const h1 = ch0 + sh0;
  let l1 = sh0 - (h1 - ch0);
  l1 += sl0 + cl0;
  // | h1 + l1 - sin2pi (R) | < 2^-67.777 * |sin2pi(R)|
  ch = sMul(SC[3 * i + 2]!, ch, cl);
  cl = tanL;
  sh = sMul(SC[3 * i + 1]!, sh, sl);
  sl = tanL;
  const h2 = ch + -sh;
  let l2 = -sh - (h2 - ch);
  l2 += cl - sl;
  // | h2 + l2 - cos2pi (R) | < 2^-68.073 * |cos2pi(R)|
  if (isTan) h = fastDiv(h1, l1, h2, l2);
  else h = fastDiv(h2, l2, h1, l1);
  l = tanL;
  const sg = neg ? -1.0 : 1.0;
  h *= sg;
  l *= sg;
  tanH = h;
  tanL = l;
  return h * 1.4928955695357043e-20; // 2^-65.864 < 0x1.1ap-66
}

/** The tangent, correctly rounded (CORE-MATH's cr_tan). */
export function tan(x: number): number {
  const e = (hiWord(x) >>> 20) & 0x7ff;
  if (e === 0x7ff) return NaN; // NaN, +Inf and -Inf
  // now x is a regular number; for |x| <= 0x1.d12ed0af1a27ep-27, tan(x) rounds to x (to nearest)
  if (Math.abs(x) <= 1.3538603431225862e-8) {
    if (x === 0) return x;
    return fma(x, 5.551115123125783e-17, x); // Taylor expansion x + x^3/3
  }
  const err = tanFast(x);
  const h = tanH, l = tanL;
  const left = h + (l - err), right = h + (l + err);
  if (left === right) return left;
  return tanAccurate(x);
}

// ---------- atan2 (atan2.c, tint.h) ----------

/** tint_t: (-1)^sgn * (h/2^64 + m/2^128 + l/2^192) * 2^ex; hm = h*2^64 + m (128 bits), l (64 bits). */
interface Tint {
  hm: bigint;
  l: bigint;
  ex: number;
  sgn: number;
}

const TZERO: Tint = { hm: 0n, l: 0n, ex: -1076, sgn: 0 };
const TONE: Tint = { hm: 1n << 127n, l: 0n, ex: 1, sgn: 0 };
const TPI_HM = 0xc90fdaa22168c234c4c6628b80dc1cd1n, TPI_L = 0x29024e088a67cc74n;
const TPI: Tint = { hm: TPI_HM, l: TPI_L, ex: 2, sgn: 0 }; // pi, error < 2^-196.96
const TPI2: Tint = { hm: TPI_HM, l: TPI_L, ex: 1, sgn: 0 }; // pi/2, error < 2^-197.96

const atan2P = (i: number): Tint => ({ hm: D.ATAN2_P_HM[i]!, l: D.ATAN2_P_L[i]!, ex: D.ATAN2_P_EX[i]!, sgn: D.ATAN2_P_SGN[i]! });
const atan2Q = (i: number): Tint => ({ hm: D.ATAN2_Q_HM[i]!, l: D.ATAN2_Q_L[i]!, ex: D.ATAN2_Q_EX[i]!, sgn: D.ATAN2_Q_SGN[i]! });

/** mul_tint: a * b, error < 10 ulps. */
function mulTint(a: Tint, b: Tint): Tint {
  const ex = a.ex + b.ex, sgn = a.sgn ^ b.sgn;
  const ah = a.hm >> 64n, am = a.hm & M64, al = a.l;
  const bh = b.hm >> 64n, bm = b.hm & M64, bl = b.l;
  const rh = ah * bh, rm1 = ah * bm, rm2 = am * bh;
  let rl1 = ah * bl;
  const rl2 = am * bm, rl3 = al * bh;
  let h = rh >> 64n, m = rh & M64;
  // accumulate rm1
  let l = rm1 & M64;
  let hh = rm1 >> 64n;
  m = (m + hh) & M64;
  h += m < hh ? 1n : 0n;
  // accumulate rm2
  let ll = rm2 & M64;
  hh = rm2 >> 64n;
  l = (l + ll) & M64;
  let cm = l < ll ? 1n : 0n; // carry at m
  m = (m + hh) & M64;
  h += m < hh ? 1n : 0n;
  // accumulate rl1+rl2+rl3
  rl1 = (rl1 >> 64n) + (rl2 >> 64n) + (rl3 >> 64n);
  ll = rl1 & M64;
  cm += rl1 >> 64n;
  l = (l + ll) & M64;
  cm += l < ll ? 1n : 0n;
  // accumulate cm
  m = (m + cm) & M64;
  h += m < cm ? 1n : 0n;
  h &= M64;
  let e = ex;
  if (!(h >> 63n)) {
    // normalize
    h = ((h << 1n) | (m >> 63n)) & M64;
    m = ((m << 1n) | (l >> 63n)) & M64;
    l = (l << 1n) & M64;
    e--;
  }
  return { hm: (h << 64n) | m, l, ex: e, sgn };
}

/** cmp_tint_abs: -1, 0 or 1 as |a| <, =, > |b|. */
function cmpTintAbs(a: Tint, b: Tint): number {
  const az = a.hm >> 64n === 0n, bz = b.hm >> 64n === 0n; // tint_zero_p: h == 0
  if (az) return bz ? 0 : -1;
  if (bz) return 1;
  if (a.ex !== b.ex) return a.ex > b.ex ? 1 : -1;
  if (a.hm !== b.hm) return a.hm > b.hm ? 1 : -1;
  return a.l > b.l ? 1 : a.l < b.l ? -1 : 0;
}

/** rshift: the significand of b shifted right by k bits (k >= 0). */
function rshiftT(hm: bigint, l: bigint, k: number): [bigint, bigint] {
  if (k === 0) return [hm, l];
  const K = BigInt(k);
  if (k < 64) return [hm >> K, ((hm << (64n - K)) | (l >> K)) & M64];
  if (k === 64) return [hm >> K, hm & M64];
  if (k < 128) return [hm >> K, (hm >> (K - 64n)) & M64];
  if (k < 192) return [0n, (hm >> (K - 64n)) & M64];
  return [0n, 0n];
}

/** lshift: the significand of b shifted left by k bits (k >= 0). */
function lshiftT(hm: bigint, l: bigint, k: number): [bigint, bigint] {
  if (k === 0) return [hm, l];
  const K = BigInt(k);
  if (k < 64) return [((hm << K) | (l >> (64n - K))) & M128, (l << K) & M64];
  if (k === 64) return [((hm << K) | l) & M128, 0n];
  if (k < 128) return [((hm << K) | (l << (K - 64n))) & M128, 0n];
  if (k < 192) return [(l << (K - 64n)) & M128, 0n];
  return [0n, 0n];
}

/** The number of leading zero bits of a 192-bit significand (hm, l): as tint.h's ex computation. */
function clzT(hm: bigint, l: bigint): number {
  const th = hm >> 64n;
  return th ? clz64(th) : hm ? 64 + clz64(hm & M64) : 128 + clz64(l);
}

/** add_tint: a + b, error bounded by 2 ulps. */
function addTint(a: Tint, b: Tint): Tint {
  switch (cmpTintAbs(a, b)) {
    case 0: // |a| = |b|, return 0 or 2*a (exact)
      if (a.sgn ^ b.sgn) return { ...TZERO };
      return { hm: a.hm, l: a.l, ex: a.ex + 1, sgn: a.sgn };
    case -1: {
      const tmp = a;
      a = b;
      b = tmp;
      break;
    }
  }
  // From now on, |a| > |b| thus a->ex >= b->ex
  const sh = a.ex - b.ex;
  let [thm, tl] = rshiftT(b.hm, b.l, sh);
  let rhm: bigint, rl: bigint, rex: number;
  if (a.sgn ^ b.sgn) {
    // opposite signs, it's a subtraction
    tl = (a.l - tl) & M64;
    thm = (a.hm - thm - (tl > a.l ? 1n : 0n)) & M128;
    const ex = clzT(thm, tl);
    if (ex <= 1 || sh === 0) {
      [rhm, rl] = lshiftT(thm, tl, ex);
      rex = a.ex - ex;
    } else {
      // ex >= 2 and sh >= 1: shift a and b/2^sh left by ex bits, and subtract (exact)
      [thm, tl] = lshiftT(b.hm, b.l, ex - sh);
      [rhm, rl] = lshiftT(a.hm, a.l, ex);
      tl = (rl - tl) & M64;
      thm = (rhm - thm - (tl > rl ? 1n : 0n)) & M128;
      const ex1 = clzT(thm, tl);
      [rhm, rl] = lshiftT(thm, tl, ex1);
      rex = a.ex - (ex + ex1);
    }
  } else {
    // same signs, it's an addition
    rl = (a.l + tl) & M64;
    const cl = rl < a.l ? 1n : 0n;
    rhm = (a.hm + thm) & M128;
    let ch = rhm < a.hm ? 1n : 0n;
    rhm = (rhm + cl) & M128;
    ch += rhm < cl ? 1n : 0n;
    if (ch) {
      rex = a.ex + 1;
      rl = ((rhm & 1n) << 63n) | (rl >> 1n);
      rhm = ((ch << 127n) | (rhm >> 1n)) & M128;
    } else rex = a.ex;
  }
  return { hm: rhm, l: rl, ex: rex, sgn: a.sgn };
}

/** tint_fromd: a <- x exactly, assuming x is not NaN, Inf or 0. */
function tintFromd(x: number): Tint {
  const u = asU64(x);
  const sgn = Number(u >> 63n);
  const ax = u & 0x7fffffffffffffffn;
  const e = Number(ax >> 52n);
  if (e) return { hm: ((1n << 63n) | ((ax << 11n) & M64)) << 64n, l: 0n, ex: e - 0x3fe, sgn };
  const z = clz64(ax); // subnormal
  return { hm: ((ax << BigInt(z)) & M64) << 64n, l: 0n, ex: -0x3f2 - z, sgn };
}

/** tint_tod: a rounded to a double; err bounds the error on a's l in ulps (0: a holds a double). */
function tintTod(a: Tint, err: bigint, y: number, x: number): number {
  if (a.ex >= 1025) return a.sgn ? -Infinity : Infinity; // overflow: |a| >= 2^1024
  if (a.ex <= -1074) {
    // underflow: |a| < 2^-1074
    if (a.ex < -1074) return (a.sgn ? -5e-324 : 5e-324) * 0.5; // |a| < 2^-1075
    const mid = a.hm === 1n << 127n && a.l === 0n; // |a| = 2^-1075
    return (a.sgn ? -5e-324 : 5e-324) * (mid ? 0.5 : 0.75);
  }
  let hh = a.hm >> 64n, mm = a.hm & M64, ll = a.l;
  let ex = a.ex;
  let low = hh & 0x7ffn; // low 11 bits from a->h
  if (mm === 0n || mm === M64)
    if ((mm === 0n && (low === 0n || low === 0x400n) && ll < err) || (mm === M64 && (low === 0x3ffn || low === 0x7ffn) && (M64 ^ ll) < err))
      throw new Error(`libm: unexpected worst case of atan2 (${y}, ${x})`);
  if (ex <= -1022) {
    // subnormal case
    const sh = BigInt(-1021 - ex); // 1 <= sh <= 52
    ll = ((mm << (64n - sh)) & M64) | (ll >> sh) | (ll > 0n ? 1n : 0n);
    mm = ((hh << (64n - sh)) & M64) | (mm >> sh);
    hh = hh >> sh;
    low = hh & 0x7ffn;
    ex += Number(sh);
  }
  let h = Number(hh >> 11n), l: number; // significant bits from a->h
  if (err === 0n) l = 0;
  else if (low < 0x400n) l = 0.25; // round to zero
  else if (low > 0x400n) l = 0.75; // round away
  else l = mm === 0n && ll === 0n ? 0.5 : 0.75; // middle case or round away
  const s = a.sgn ? -1.0 : 1.0;
  h = fma(l, s, s * h);
  h *= 2.220446049250313e-16;
  return h * pow2(ex - 1); // -1021 <= ex <= 1024
}

/** inv_tint: an approximation of 1/A (A not zero), absolute error < 2^-103.9 for 1 <= r <= 2. */
function invTint(A: Tint): Tint {
  let a = tintTod(A, 0n, 0, 0); // exact
  const subnormal = Math.abs(a) < 2.2250738585072014e-308;
  if (subnormal) a *= 9007199254740992;
  let r = tintFromd(1.0 / a); // accurate to about 53 bits
  if (subnormal) r.ex += 53;
  // Newton's iteration: r1 = r0 + r0*(1-a*r0)
  let q = mulTint(A, r); // approximates a*r
  q.sgn = 1 - q.sgn; // -a*r
  q = addTint(TONE, q); // approximates 1-a*r
  q = mulTint(r, q); // approximates r*(1-a*r)
  r = addTint(r, q);
  return r;
}

/** div_tint: an approximation of b/a (a not zero), relative error < 2^-185.53. */
function divTint(b: Tint, a: Tint): Tint {
  const Y = invTint(a);
  let r = mulTint(Y, b); // r approximates b/a
  // Karp-Markstein's trick: r1 = r0 + y*(b-a*r0)
  let Z = mulTint(a, r); // approximates a*r
  Z.sgn = 1 - Z.sgn; // -a*r
  Z = addTint(b, Z); // approximates b-a*r
  Z = mulTint(Y, Z); // approximates y*(b-a*r)
  r = addTint(r, Z);
  return r;
}

const PI_H = 3.141592653589793, PI_L = 1.2246467991473532e-16;
const PI_OVER2_H = 1.5707963267948966, PI_OVER2_L = 6.123233995736766e-17;

/** atan2_accurate: a type [29,29] rational approximation of atan(z) for 0 <= z <= 1, in 192-bit arithmetic. */
function atan2Accurate(y: number, x: number): number {
  // First check when t=y/x is small and exact and x > 0, since for |t| <= 0x1.d12ed0af1a27fp-27 atan(t) rounds to t.
  const t = y / x;
  if (t === 0) {
    if (x > 0) return t;
    return y > 0 ? PI_H + PI_L : -PI_H - PI_L;
  }
  let corr = fma(t, x, -y);
  if (corr === 0 && x > 0)
    if (Math.abs(t) <= 1.3538603431225864e-8) {
      if (Math.abs(y) >= 3.610388751729659e-276) return fma(t, -5.551115123125783e-17, t);
      // Now |y| < 2^-969: scale y and t by 2^105, which will ensure t*x-y does not underflow.
      corr = fma(t * 4.056481920730334e+31, x, -y * 4.056481920730334e+31);
      if (corr === 0) return fma(t, -5.551115123125783e-17, t);
    }
  const inv = Math.abs(y) > Math.abs(x);
  let z = inv ? divTint(tintFromd(x), tintFromd(y)) : divTint(tintFromd(y), tintFromd(x));
  // When |y/x| < 2^-96, x > 0, atan(y/x) rounds to the same value as y/x perturbed by a small amount towards zero.
  if (!inv && x > 0 && z.ex <= -96) {
    const l = (z.l - 2n) & M64;
    const m = ((z.hm & M64) - (l < 2n ? 1n : 0n)) & M64;
    const h = ((z.hm >> 64n) - (m < 1n ? 1n : 0n)) & M64;
    z = { hm: (h << 64n) | m, l, ex: z.ex, sgn: z.sgn };
    return tintTod(z, 1n, y, x);
  }
  // the rational approximation is only for z > 0, it is not antisymmetric
  const sz = z.sgn;
  z.sgn = 0;
  let p = atan2P(29), q = atan2Q(29);
  for (let i = 28; i >= 0; i--) {
    p = mulTint(p, z);
    q = mulTint(q, z);
    p = addTint(p, atan2P(i));
    q = addTint(q, atan2Q(i));
  }
  p = mulTint(p, z); // multiply p by z
  z = divTint(p, q); // divide p by q
  let err = 662n; // error bound in case inv=0 and x > 0
  z.sgn = sz; // restore sign
  // Now z approximates atan(y/x) for inv=0, and atan(x/y) for inv=1, with -pi/4 < z < pi/4.
  if (inv) {
    if (z.sgn === 0) {
      // 0 < atan(x/y) < pi/4: pi/2 - atan(x/y)
      z.sgn = 1;
      z = addTint(TPI2, z);
    } else {
      // -pi/4 < atan(x/y) < 0: -pi/2 - atan(x/y)
      z = addTint(TPI2, z);
      z.sgn = 1;
    }
    err = 524n;
  }
  // now -pi/2 < z < pi/2; if x is negative we go to the opposite quadrant
  if (x < 0) {
    if (z.sgn === 0) {
      // 1st quadrant -> 3rd quadrant (subtract pi)
      z.sgn = 1;
      z = addTint(TPI, z);
      z.sgn = 1;
    } else {
      // 4th quadrant -> 2nd quadrant (add pi)
      z = addTint(TPI, z);
    }
    err = 266n;
  }
  return tintTod(z, err, y, x);
}

/** as_atan2_special: atan2 when y or x is 0, infinite or NaN. */
function atan2Special(y0: number, x0: number): number {
  if (!Number.isFinite(y0) || !Number.isFinite(x0)) {
    // NaN or Inf
    if (y0 !== y0 || x0 !== x0) return y0 + x0;
    // Now neither y nor x is NaN, but at least one is +Inf or -Inf
    const xneg = x0 < 0;
    if (!Number.isFinite(y0) && !Number.isFinite(x0)) {
      // atan2 (+/-Inf,-Inf) = +/-3pi/4, atan2 (+/-Inf,+Inf) = +/-pi/4
      const f1 = xneg ? 2.356194490192345 : 0.7853981633974483, f0 = xneg ? 5.551115123125783e-17 : 2.7755575615628914e-17;
      return copysign(f1, y0) + copysign(f0, y0);
    }
    // now only one of y and x is +/-Inf
    if (!Number.isFinite(x0)) {
      if (x0 < 0) return copysign(PI_H, y0) + copysign(PI_L, y0);
      return copysign(0, y0); // atan2(+/-y,+Inf) = +/-0 for finite y
    }
    // now y = +/-Inf: atan2(+/-Inf,x) = +/-pi/2 for finite x
    return copysign(PI_OVER2_H, y0) + copysign(PI_OVER2_L, y0);
  }
  if (y0 === 0 || x0 === 0) {
    if (y0 === 0 && x0 === 0) {
      if (Object.is(x0, 0)) return y0; // atan2(+/-0, +0) = +/-0
      return Object.is(y0, 0) ? PI_H + PI_L : -PI_H - PI_L; // atan2(+/-0, -0) = +/-pi
    }
    // only one of y and x is zero
    if (y0 === 0) {
      if (x0 > 0) return y0 / x0; // atan2(+/-0,x) = +/-0 for x>0
      return Object.is(y0, 0) ? PI_H + PI_L : -PI_H - PI_L; // atan2(+/-0,x) = +/-pi for x<0
    }
    // now only x is zero: atan2(y,+/-0) = +/-pi/2
    return y0 > 0 ? PI_OVER2_H + PI_OVER2_L : -PI_OVER2_H - PI_OVER2_L;
  }
  return 0;
}

const ATAN2_B0 = -0.33333333333332604, ATAN2_B1 = 0.19999999943116925, ATAN2_B2 = -0.14284292170535642;
const ATAN2_B2_0 = -0.3333333333333333, ATAN2_B2_1 = 0.19999999999974255;
const ATAN2_B2_2 = -0.14285713816496304, ATAN2_B2_3 = 0.11107620301764512;

/** The arctangent of y0/x0 in the right quadrant, correctly rounded (CORE-MATH's cr_atan2). */
export function atan2(y0: number, x0: number): number {
  if (y0 === 0 || !Number.isFinite(y0)) return atan2Special(y0, x0);
  if (x0 === 0 || !Number.isFinite(x0)) return atan2Special(y0, x0);
  const ax = Math.abs(x0), ay = Math.abs(y0);
  let x = Math.max(ax, ay), y = Math.min(ax, ay);
  const hy = hiWord(y0), hx = hiWord(x0);
  const sy = hy >>> 31, sx = hx >>> 31;
  const GT = ax < ay ? 1 : 0; // aix < aiy
  // dxy = (aix-aiy)^-GT: |aix - aiy| (minus 1 if GT) on the bits; >= 53<<52 means the quotient is below 2^-53 or so
  {
    const K = 53 << 20;
    const dh = GT ? (hy & 0x7fffffff) - (hx & 0x7fffffff) : (hx & 0x7fffffff) - (hy & 0x7fffffff);
    const dl = GT ? loWord(y0) - loWord(x0) - 1 : loWord(x0) - loWord(y0);
    if (dh > K || (dh === K && dl >= 0)) return atan2Accurate(y0, x0);
  }
  const sg = GT ^ sx ^ sy ? -1 : 1; // copysign(1, asgn[GT^sx^sy])
  const kw = (sx << 2) | (sy << 1) | GT;
  const jj = y / x + (2 + 1 / 128);
  const jt = (hiWord(jj) >>> 13) & 127;
  const F2 = D.ATAN2_F2, O = D.ATAN2_O;
  let fh = F2[2 * jt + 1]! * sg;
  let fl = F2[2 * jt]! * sg;
  fh += O[2 * kw]!;
  fl += O[2 * kw + 1]!;
  if (x < 1.1282464849155185e-277) {
    x *= 8.863311460481781e+276;
    y *= 8.863311460481781e+276;
  }
  if (x > 4.49423283715579e+307) {
    if (jt !== 0) {
      x *= 0.5;
      y *= 0.5;
    }
  }
  const t0 = D.ATAN2_T2[jt]!;
  const zn = fma(-t0, x, y), zd = fma(t0, y, x);
  let z = zn / zd;
  let z2 = z * z;
  z *= sg;
  const dz = z * z2 * (ATAN2_B0 + z2 * (ATAN2_B1 + z2 * ATAN2_B2));
  // this bound is obtained with 1.1e10 random argument pairs in the roundup mode, increased by 2.5% for safety
  let eps = Math.abs(z) * 4.528712474471952e-16 + 8.077935669463161e-28;
  const rh = fasttwosum(fh, z);
  z = LO;
  const rl = fl + dz + z;
  let lb = rh + (rl - eps), ub = rh + (rl + eps);
  if (lb !== ub) {
    let dh = y * t0, dl = mulErr(y, t0, dh);
    dh = fasttwosum(x, dh);
    const e = LO;
    const rdh = 1 / dh;
    dl += e;
    let nh = x * t0, nl = mulErr(x, t0, nh);
    const dt = y - nh, y1 = dt + nh;
    if (y1 === y) {
      nh = fasttwosum(dt, -nl);
      nl = LO;
    } else {
      nh = fasttwosum(dt, y - y1 - nl);
      nl = LO;
    }
    let zh = nh * rdh;
    z2 = zh * zh;
    let zl = rdh * (fma(dh, -zh, nh) + (nl - nh * rdh * dl));
    zl += zh * z2 * (ATAN2_B2_0 + z2 * ATAN2_B2_1 + z2 * z2 * (ATAN2_B2_2 + z2 * ATAN2_B2_3));
    zh *= sg;
    zl *= sg;
    eps = 1.1102230246251565e-15 * (Math.abs(zh) * z2 + 4.440892098500626e-16);
    fh = fastsum(fh, fl, zh, zl);
    fl = LO;
    lb = fh + (fl - eps);
    ub = fh + (fl + eps);
    if (lb !== ub) return atan2Accurate(y0, x0);
  }
  return ub;
}
