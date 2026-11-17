// Port of Parser/Ast/CForNode.cs – syntax tree: the C-style loop for ((init; cond; step)); do ...; done.

import type { Node } from "./Node.js";
import type { Redirect } from "./Redirect.js";

export interface CForNode {
  type: "cfor";
  init: string;
  cond: string;
  step: string;
  body: Node;
  redirects: Redirect[];
}
