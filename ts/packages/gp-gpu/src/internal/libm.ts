// The C library's transcendental functions, as .NET's Math.Sin, Math.Pow … compute them on Linux (glibc, x86-64 with
// FMA), for the simulator: JavaScript's Math.sin, Math.pow … (V8's own implementations) differ from glibc in the last
// bit for a few percent of arguments, enough to move a pixel. So the port never calls Math.sin, cos, tan, asin, acos,
// atan, atan2, exp, log, log2, pow: it calls these (`import * as libm from "../internal/libm.js"`).
//
// Sources (permissively licensed; the licences and copyright lines are at the top of each file):
// * exp, log, log2, pow: Arm optimized-routines (MIT OR Apache-2.0 WITH LLVM-exception) – libm-arm.ts. glibc's
//   versions of these four are the same Arm code, and the translation fuses multiply-adds exactly where GCC does when
//   it builds glibc's FMA variants, so the results are glibc's bit for bit.
// * sin, cos, tan, asin, acos, atan, atan2: CORE-MATH (MIT), correctly rounded – libm-coremath.ts. glibc's routines
//   (IBM's) are correctly rounded for nearly every argument, so these give glibc's results except for about 1 argument
//   in 400 (tan) to 1800 (atan) in the ranges shaders use, where glibc is off by one in the last bit (see
//   test/Libm.test.ts).
// * fma, the exact fused multiply-add both need: libm-fma.ts (written for Codestead).
//
// Math.sqrt, floor, ceil, trunc, round, abs, min, max and fround are exact in both and stay.

export { acos, asin, atan, atan2, cos, sin, tan } from "./libm-coremath.js";
export { exp, log, log2, pow } from "./libm-arm.js";
export { fma } from "./libm-fma.js";
