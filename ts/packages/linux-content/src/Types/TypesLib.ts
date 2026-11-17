// Port of Types/TypesLib.cs (src/content/types.ts).

import type { Distro } from "@codestead/linux-shell";
import type { FamilyText } from "./FamilyText.js";
import { PerDistro } from "./PerDistro.js";

export function resolve<T>(v: PerDistro<T>, d: Distro): T {
  return PerDistro.resolve(v, d);
}

export function resolveFamilyText(v: FamilyText, d: Distro): string | null {
  return v.get(d.family);
}

/** A PerDistro text from a FamilyText. */
export function fromFamilyText(ft: FamilyText): PerDistro<string> {
  return (d) => ft.get(d.family)!;
}
