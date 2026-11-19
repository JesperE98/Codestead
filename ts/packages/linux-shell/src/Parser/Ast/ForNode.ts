// Port of Parser/Ast/ForNode.cs – syntax tree: for NAME in WORDS; do ...; done.

import type { Node } from "./Node.js";
import type { Redirect } from "./Redirect.js";
import type { Word } from "./Word.js";

export interface ForNode {
  type: "for";
  name: string;
  /** null: no "in" (loops over the positional parameters). */
  words?: Word[] | null;
  body: Node;
  redirects: Redirect[];
}
