// Port of Parser/Ast/AndOrNode.cs – syntax tree: commands joined with && and ||.

import type { AndOrItem } from "./AndOrItem.js";
import type { Node } from "./Node.js";

export interface AndOrNode {
  type: "andor";
  first: Node;
  rest: AndOrItem[];
}
