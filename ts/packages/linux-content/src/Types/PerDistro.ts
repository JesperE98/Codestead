// Port of Types/PerDistro.cs – a value that may depend on the distribution.

import type { Distro } from "@codestead/linux-shell";

/**
 * TS: `PerDistro<T> = T | ((d: Distro) => T)` – a value, or a function that picks the value for a distro.
 * (The C# class converts implicitly from both; here it is the original union again.)
 */
export type PerDistro<T> = T | ((d: Distro) => T);

export const PerDistro = {
  /** True when this is a function of the distro (rather than a plain value). */
  isFunction<T>(v: PerDistro<T>): v is (d: Distro) => T {
    return typeof v === "function";
  },

  resolve<T>(v: PerDistro<T>, d: Distro): T {
    return typeof v === "function" ? (v as (d: Distro) => T)(d) : v;
  },

  /** JS truthiness of the raw value (a function is always truthy; a string must be non-empty). */
  truthy<T>(v: PerDistro<T> | null | undefined): boolean {
    return typeof v === "function" || (typeof v === "string" ? v.length > 0 : v !== null && v !== undefined);
  },
};
