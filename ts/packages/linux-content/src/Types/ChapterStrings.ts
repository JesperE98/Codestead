// Port of Types/ChapterStrings.cs – the translation of a chapter's title and tasks.

import type { Obj } from "@codestead/linux-shell";
import type { ChapterTaskStrings } from "./ChapterTaskStrings.js";

/** Translation of a chapter: src/content/i18n/&lt;lang&gt;/&lt;chapter-id&gt;.json */
export interface ChapterStrings {
  title: string | null;
  tasks: Obj<ChapterTaskStrings> | null;
}
