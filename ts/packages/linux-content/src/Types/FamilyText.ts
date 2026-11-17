// Port of Types/FamilyText.cs – a text with one variant per distribution family.

import type { Family } from "@codestead/linux-shell";

/** Text that differs between the families, e.g. in the translation files. */
export class FamilyText {
  debian: string | null = null;
  arch: string | null = null;
  redhat: string | null = null;

  constructor(init: { debian?: string | null; arch?: string | null; redhat?: string | null } = {}) {
    this.debian = init.debian ?? null;
    this.arch = init.arch ?? null;
    this.redhat = init.redhat ?? null;
  }

  /** familyText[family] */
  get(family: Family | string): string | null {
    switch (family) {
      case "debian":
        return this.debian;
      case "arch":
        return this.arch;
      case "redhat":
        return this.redhat;
      default:
        return null;
    }
  }
}
