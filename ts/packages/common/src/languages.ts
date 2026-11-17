import languagesFile from "../../../../build/languages.json" with { type: "json" };

/** A language from build/languages.json. */
export interface LanguageInfo {
  readonly code: string;
  /** The language's name in the language itself. */
  readonly name: string;
  /** Writing direction: "ltr" or "rtl". */
  readonly dir: "ltr" | "rtl";
  /** False: parked – not in the menus and its texts are not required. */
  readonly offered: boolean;
}

export const isRightToLeft = (language: LanguageInfo): boolean => language.dir === "rtl";

function load(): readonly LanguageInfo[] {
  const list = (languagesFile as { languages?: LanguageInfo[] }).languages;
  if (!list || list.length === 0) throw new Error("build/languages.json has no languages.");
  return list;
}

/**
 * The languages of every Codestead app, from build/languages.json. The first offered language is the default; parked
 * languages keep their files but are not offered.
 */
export const Languages = {
  /** Every language with texts in the repository, offered or parked, in menu order. */
  all: load(),

  /** The languages the apps offer, in menu order. */
  get offered(): readonly LanguageInfo[] {
    return this.all.filter((l) => l.offered);
  },

  /** The language shown the first time (English). */
  get default(): string {
    const first = this.offered[0];
    if (!first) throw new Error("build/languages.json offers no language.");
    return first.code;
  },

  isOffered(code: string | null | undefined): boolean {
    return code != null && this.offered.some((l) => l.code === code);
  },

  find(code: string | null | undefined): LanguageInfo | undefined {
    return this.all.find((l) => l.code === code);
  },

  /** The order texts are looked for when one is missing in a language: the language, English, Swedish (the original). */
  fallbackChain(lang: string): readonly string[] {
    return [...new Set([lang, "en", "sv"])];
  },
};
