import { clamp } from "../internal/dotnet.js";
// libm: sin, cos, pow … as C#'s Math.Sin, Math.Pow … compute them on Linux (glibc), instead of V8's Math.* (see internal/libm.ts).
import * as libm from "../internal/libm.js";

/** The sRGB transfer function (IEC 61966-2-1), as GPUs apply it for sRGB formats. */
export const SrgbCurve = {
  toLinear(c: number): number {
    return c <= 0.04045 ? c / 12.92 : libm.pow((c + 0.055) / 1.055, 2.4);
  },

  fromLinear(c: number): number {
    c = clamp(c, 0, 1);
    return c <= 0.0031308 ? c * 12.92 : 1.055 * libm.pow(c, 1 / 2.4) - 0.055;
  },
};
