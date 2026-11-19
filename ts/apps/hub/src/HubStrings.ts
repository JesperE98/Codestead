import { Languages, translate, type TextArgs } from "@codestead/common";
import type { HubLanguage } from "./HubLanguage.js";

// The texts, read from the C# hub's i18n/<lang>.json (its embedded resources hub-i18n/<lang>.json).
const files = import.meta.glob<Record<string, string>>("../../../../src/Hub/Codestead.Hub/i18n/*.json", { import: "default", eager: true });

function load(lang: string): Readonly<Record<string, string>> {
  return Object.entries(files).find(([path]) => path.endsWith(`/${lang}.json`))?.[1] ?? {};
}

/** The languages the hub offers, in menu order (build/languages.json; parked languages are left out). */
const languages: readonly HubLanguage[] = Languages.offered.map((l) => ({ code: l.code, name: l.name, rightToLeft: l.dir === "rtl" }));

const texts = new Map(languages.map((l) => [l.code, load(l.code)]));

/** The hub's texts in i18n/&lt;lang&gt;.json. Missing keys fall back to English. */
export const HubStrings = {
  languages,

  for(lang: string): Readonly<Record<string, string>> {
    return texts.get(lang) ?? texts.get("en")!;
  },

  isLanguage(code: string | null | undefined): boolean {
    return code != null && texts.has(code);
  },

  t(lang: string, key: string, args?: TextArgs): string {
    return translate((l) => texts.get(l), [lang, "en"], key, args);
  },
};
