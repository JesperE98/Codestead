namespace Codestead.Shell.Commands;

// awk: statements in the syntax tree.

public abstract partial class Stmt
{
    /// <summary>k: "print" | "printf"</summary>
    public sealed class Print(string k, List<Expr> args) : Stmt { public string K { get; } = k; public List<Expr> Args { get; } = args; }
    public sealed class ExprStmt(Expr e) : Stmt { public Expr E { get; } = e; }
    public sealed class Block(List<Stmt> body) : Stmt { public List<Stmt> Body { get; } = body; }
    public sealed class If(Expr c, Stmt then, Stmt? @else) : Stmt { public Expr C { get; } = c; public Stmt Then { get; } = then; public Stmt? Else { get; } = @else; }
    public sealed class While(Expr c, Stmt body) : Stmt { public Expr C { get; } = c; public Stmt Body { get; } = body; }
    public sealed class Do(Expr c, Stmt body) : Stmt { public Expr C { get; } = c; public Stmt Body { get; } = body; }
    public sealed class For(Stmt? init, Expr? c, Stmt? step, Stmt body) : Stmt { public Stmt? Init { get; } = init; public Expr? C { get; } = c; public Stmt? Step { get; } = step; public Stmt Body { get; } = body; }
    public sealed class ForIn(string v, string arr, Stmt body) : Stmt { public string V { get; } = v; public string Arr { get; } = arr; public Stmt Body { get; } = body; }
    /// <summary>k: "next" | "break" | "continue"</summary>
    public sealed class Jump(string k) : Stmt { public string K { get; } = k; }
    public sealed class Exit(Expr? e) : Stmt { public Expr? E { get; } = e; }
    public sealed class Delete(string arr, List<Expr>? subs) : Stmt { public string Arr { get; } = arr; public List<Expr>? Subs { get; } = subs; }
}
