// Port of Commands/Awk/Rule.cs – awk: a pattern with its action.

import type { Expr } from "./Expr.js";
import type { Stmt } from "./Stmt.js";

export interface Rule {
  /** "BEGIN", "END", an Expr or null (every record). */
  pattern: "BEGIN" | "END" | Expr | null;
  action: Stmt[] | null;
}
