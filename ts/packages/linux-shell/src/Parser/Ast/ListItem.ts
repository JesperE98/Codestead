// Port of Parser/Ast/ListItem.cs – syntax tree: one command of a ListNode, optionally run in the background (&).

import type { Node } from "./Node.js";

export interface ListItem {
  node: Node;
  background: boolean;
}
