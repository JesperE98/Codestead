// Port of LanguagesLib.cs – the languages the app is available in, read from build/languages.json (shared with the
// hub and the release flow). Swedish is the original language; English is the default and the fallback for
// everything that lacks a translation.

import { Languages } from "@codestead/common";
import type { Lang, Language } from "./Language.js";

/** Every language with texts in the repository, offered or parked (build/languages.json). */
export const all: readonly Language[] = Languages.all.map((l) => ({ code: l.code, name: l.name, dir: l.dir, offered: l.offered }));

/** The languages the app offers, in menu order. Parked languages are left out. */
export const languages: Language[] = all.filter((l) => l.offered);

export function isLang(code: string | null | undefined): boolean {
  return code !== null && code !== undefined && languages.some((l) => l.code === code);
}

/**
 * The language to show the first time (when nothing is saved): always English.
 * (The TypeScript version picked the browser's language; the owner wants English as the default.)
 */
export function detectLang(): Lang {
  return Languages.default;
}

/** The order we look in when a text is missing in the chosen language. */
export function fallbackChain(lang: Lang): Lang[] {
  return [...new Set([lang, "en", "sv"])];
}
