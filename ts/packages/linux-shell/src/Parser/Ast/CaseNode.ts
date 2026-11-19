// Port of Parser/Ast/CaseNode.cs – syntax tree: case WORD in ... esac.

import type { CaseItem } from "./CaseItem.js";
import type { Redirect } from "./Redirect.js";
import type { Word } from "./Word.js";

export interface CaseNode {
  type: "case";
  word: Word;
  items: CaseItem[];
  redirects: Redirect[];
}
