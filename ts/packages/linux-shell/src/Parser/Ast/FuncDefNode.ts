// Port of Parser/Ast/FuncDefNode.cs – syntax tree: a function definition, name() { ...; }.

import type { Node } from "./Node.js";

export interface FuncDefNode {
  type: "funcdef";
  name: string;
  body: Node;
}
