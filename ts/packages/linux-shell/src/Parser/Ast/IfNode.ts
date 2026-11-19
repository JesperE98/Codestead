// Port of Parser/Ast/IfNode.cs – syntax tree: if/elif/else/fi.

import type { IfClause } from "./IfClause.js";
import type { Node } from "./Node.js";
import type { Redirect } from "./Redirect.js";

export interface IfNode {
  type: "if";
  clauses: IfClause[];
  elseBody?: Node | null;
  redirects: Redirect[];
}
