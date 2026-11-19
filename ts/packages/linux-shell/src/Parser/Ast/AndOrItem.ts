// Port of Parser/Ast/AndOrItem.cs – syntax tree: one && or || step of an AndOrNode.

import type { Node } from "./Node.js";

export interface AndOrItem {
  /** "&&" or "||". */
  op: string;
  node: Node;
}
