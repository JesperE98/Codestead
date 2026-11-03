namespace Codestead.Shell.Commands;

// awk: expressions in the syntax tree.

public abstract partial class Expr
{
    public sealed class Num(double v) : Expr { public double V { get; } = v; }
    public sealed class Str(string v) : Expr { public string V { get; } = v; }
    public sealed class Re(string src) : Expr { public string Src { get; } = src; }
    public sealed class Var(string name) : Expr { public string Name { get; } = name; }
    public sealed class Field(Expr e) : Expr { public Expr E { get; } = e; }
    public sealed class Idx(string name, List<Expr> subs) : Expr { public string Name { get; } = name; public List<Expr> Subs { get; } = subs; }
    public sealed class Assign(string op, Expr target, Expr e) : Expr { public string Op { get; } = op; public Expr Target { get; } = target; public Expr E { get; } = e; }
    public sealed class Cond(Expr c, Expr a, Expr b) : Expr { public Expr C { get; } = c; public Expr A { get; } = a; public Expr B { get; } = b; }
    /// <summary>k: "and" | "or"</summary>
    public sealed class Logic(string k, Expr a, Expr b) : Expr { public string K { get; } = k; public Expr A { get; } = a; public Expr B { get; } = b; }
    /// <summary>k: "not" | "neg" | "pos"</summary>
    public sealed class Unary(string k, Expr e) : Expr { public string K { get; } = k; public Expr E { get; } = e; }
    public sealed class Bin(string op, Expr a, Expr b) : Expr { public string Op { get; } = op; public Expr A { get; } = a; public Expr B { get; } = b; }
    public sealed class Cmp(string op, Expr a, Expr b) : Expr { public string Op { get; } = op; public Expr A { get; } = a; public Expr B { get; } = b; }
    public sealed class Match(bool neg, Expr a, Expr re) : Expr { public bool Neg { get; } = neg; public Expr A { get; } = a; public new Expr Re { get; } = re; }
    public sealed class Concat(Expr a, Expr b) : Expr { public Expr A { get; } = a; public Expr B { get; } = b; }
    public sealed class Incr(string op, bool prefix, Expr target) : Expr { public string Op { get; } = op; public bool Prefix { get; } = prefix; public Expr Target { get; } = target; }
    public sealed class Call(string name, List<Expr> args) : Expr { public string Name { get; } = name; public List<Expr> Args { get; } = args; }
    public sealed class In(List<Expr> subs, string arr) : Expr { public List<Expr> Subs { get; } = subs; public string Arr { get; } = arr; }
    public sealed class Group(List<Expr> list) : Expr { public List<Expr> List { get; } = list; }
}
