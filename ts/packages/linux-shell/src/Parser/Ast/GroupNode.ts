// Port of Parser/Ast/GroupNode.cs – syntax tree: { ...; } and the subshell ( ... ).

import type { Node } from "./Node.js";
import type { Redirect } from "./Redirect.js";

export interface GroupNode {
  type: "group";
  body: Node;
  subshell: boolean;
  redirects: Redirect[];
}
