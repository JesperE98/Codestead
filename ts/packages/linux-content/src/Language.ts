// Port of Language.cs – one language from build/languages.json.

/** A language code from build/languages.json, e.g. "en", "sv" (C#: global using Lang = string). */
export type Lang = string;

export interface Language {
  code: Lang;
  /** The language's name in the language itself. */
  name: string;
  /** Writing direction: "ltr" or "rtl". */
  dir: string;
  /** False: parked – not in the menus, its texts are not required (build/languages.json). */
  offered: boolean;
}
