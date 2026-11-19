// Port of Parser/Ast/PipelineNode.cs – syntax tree: a pipeline (a | b | c), optionally negated with !.

import type { Node } from "./Node.js";

export interface PipelineNode {
  type: "pipeline";
  commands: Node[];
  negate: boolean;
}
