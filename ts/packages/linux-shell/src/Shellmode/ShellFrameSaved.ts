// Port of Shellmode/ShellFrameSaved.cs – shell stack: the parent shell's state, restored on exit.

import type { Obj } from "../Js.js";
import type { Node } from "../Parser/Ast/Node.js";

/** The parent shell's state, restored on exit. */
export interface ShellFrameSaved {
  cwd: string;
  env: Obj<string>;
  /** The parent's exported variables (missing in terminals saved before they were kept apart: all of env). */
  exported?: string[] | null;
  aliases: Obj<string>;
  functions: Obj<Node>;
}
