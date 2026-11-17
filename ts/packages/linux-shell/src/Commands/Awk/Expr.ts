// Port of Commands/Awk/Expr.cs – awk: expressions in the syntax tree. The C# nested classes (Expr.Num, Expr.Var ...)
// are the members of a union told apart by `kind`.

export type Expr =
  | { kind: "Num"; v: number }
  | { kind: "Str"; v: string }
  | { kind: "Re"; src: string }
  | { kind: "Var"; name: string }
  | { kind: "Field"; e: Expr }
  | { kind: "Idx"; name: string; subs: Expr[] }
  | { kind: "Assign"; op: string; target: Expr; e: Expr }
  | { kind: "Cond"; c: Expr; a: Expr; b: Expr }
  /** k: "and" | "or" */
  | { kind: "Logic"; k: string; a: Expr; b: Expr }
  /** k: "not" | "neg" | "pos" */
  | { kind: "Unary"; k: string; e: Expr }
  | { kind: "Bin"; op: string; a: Expr; b: Expr }
  | { kind: "Cmp"; op: string; a: Expr; b: Expr }
  | { kind: "Match"; neg: boolean; a: Expr; re: Expr }
  | { kind: "Concat"; a: Expr; b: Expr }
  | { kind: "Incr"; op: string; prefix: boolean; target: Expr }
  | { kind: "Call"; name: string; args: Expr[] }
  | { kind: "In"; subs: Expr[]; arr: string }
  | { kind: "Group"; list: Expr[] };
