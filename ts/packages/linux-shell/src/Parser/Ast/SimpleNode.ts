// Port of Parser/Ast/SimpleNode.cs – syntax tree: a simple command (words and redirections).

import type { Redirect } from "./Redirect.js";
import type { Word } from "./Word.js";

export interface SimpleNode {
  type: "simple";
  words: Word[];
  redirects: Redirect[];
}
