// Port of Parser/Ast/IfClause.cs – syntax tree: one if/elif condition and its body.

import type { Node } from "./Node.js";

export interface IfClause {
  cond: Node;
  body: Node;
}
