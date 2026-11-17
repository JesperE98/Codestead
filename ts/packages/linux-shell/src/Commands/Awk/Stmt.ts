// Port of Commands/Awk/Stmt.cs – awk: statements in the syntax tree. The C# nested classes (Stmt.Print, Stmt.If ...)
// are the members of a union told apart by `kind`.

import type { Expr } from "./Expr.js";

export type Stmt =
  /** k: "print" | "printf" */
  | { kind: "Print"; k: string; args: Expr[] }
  | { kind: "ExprStmt"; e: Expr }
  | { kind: "Block"; body: Stmt[] }
  | { kind: "If"; c: Expr; then: Stmt; else: Stmt | null }
  | { kind: "While"; c: Expr; body: Stmt }
  | { kind: "Do"; c: Expr; body: Stmt }
  | { kind: "For"; init: Stmt | null; c: Expr | null; step: Stmt | null; body: Stmt }
  | { kind: "ForIn"; v: string; arr: string; body: Stmt }
  /** k: "next" | "break" | "continue" */
  | { kind: "Jump"; k: string }
  | { kind: "Exit"; e: Expr | null }
  | { kind: "Delete"; arr: string; subs: Expr[] | null };
