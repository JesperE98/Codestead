// Port of Types/ChapterTaskStrings.cs – the translation of one task's text and hint.

import type { PerDistro } from "./PerDistro.js";

/** One task in {@link ChapterStrings}: text and hint, each a string or a {@link FamilyText}. */
export interface ChapterTaskStrings {
  text: PerDistro<string> | null;
  hint: PerDistro<string> | null;
}
