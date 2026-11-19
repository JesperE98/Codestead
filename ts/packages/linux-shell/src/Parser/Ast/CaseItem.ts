// Port of Parser/Ast/CaseItem.cs – syntax tree: one pattern) body ;; branch of a case.

import type { Node } from "./Node.js";
import type { Word } from "./Word.js";

export interface CaseItem {
  patterns: Word[];
  body?: Node | null;
}
