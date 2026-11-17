// Port of Parser/Ast/CompoundNode.cs – syntax tree: compound commands, which can have their own redirections.

import type { ArithNode } from "./ArithNode.js";
import type { CaseNode } from "./CaseNode.js";
import type { CForNode } from "./CForNode.js";
import type { ForNode } from "./ForNode.js";
import type { GroupNode } from "./GroupNode.js";
import type { IfNode } from "./IfNode.js";
import type { Node } from "./Node.js";
import type { WhileNode } from "./WhileNode.js";

/** Compound commands that can have their own redirections. */
export type CompoundNode = IfNode | ForNode | CForNode | WhileNode | CaseNode | GroupNode | ArithNode;

const compoundTypes = new Set(["if", "for", "cfor", "while", "case", "group", "arith"]);

/** node is CompoundNode */
export function isCompound(node: Node): node is CompoundNode {
  return compoundTypes.has(node.type);
}
