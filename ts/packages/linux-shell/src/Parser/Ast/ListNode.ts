// Port of Parser/Ast/ListNode.cs – syntax tree: a list of commands separated by ; & or newline.

import type { ListItem } from "./ListItem.js";

export interface ListNode {
  type: "list";
  items: ListItem[];
}
