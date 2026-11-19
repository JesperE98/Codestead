// Port of Parser/Ast/ArithNode.cs – syntax tree: the arithmetic command (( ... )).

import type { Redirect } from "./Redirect.js";

export interface ArithNode {
  type: "arith";
  expr: string;
  redirects: Redirect[];
}
