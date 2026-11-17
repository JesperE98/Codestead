// Port of Parser/Ast/WhileNode.cs – syntax tree: while/until loops.

import type { Node } from "./Node.js";
import type { Redirect } from "./Redirect.js";

export interface WhileNode {
  type: "while";
  until: boolean;
  cond: Node;
  body: Node;
  redirects: Redirect[];
}
