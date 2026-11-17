// Port of Parser/Ast/Node.cs – syntax tree: every command node, told apart by its "type" (the JSON discriminator,
// which comes first in the saved JSON so that C# can read it).

import type { AndOrNode } from "./AndOrNode.js";
import type { ArithNode } from "./ArithNode.js";
import type { CaseNode } from "./CaseNode.js";
import type { CForNode } from "./CForNode.js";
import type { ForNode } from "./ForNode.js";
import type { FuncDefNode } from "./FuncDefNode.js";
import type { GroupNode } from "./GroupNode.js";
import type { IfNode } from "./IfNode.js";
import type { ListNode } from "./ListNode.js";
import type { PipelineNode } from "./PipelineNode.js";
import type { SimpleNode } from "./SimpleNode.js";
import type { WhileNode } from "./WhileNode.js";

/** "simple", "pipeline", "andor", "list", "if", "for", "cfor", "while", "case", "group", "arith" or "funcdef". */
export type Node = SimpleNode | PipelineNode | AndOrNode | ListNode | IfNode | ForNode | CForNode | WhileNode | CaseNode | GroupNode | ArithNode | FuncDefNode;
