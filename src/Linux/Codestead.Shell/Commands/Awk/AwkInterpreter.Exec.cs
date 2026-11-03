namespace Codestead.Shell.Commands;

// The awk interpreter: statements and expressions.

public partial class AwkInterpreter
{
    private void Tick()
    {
        if (++steps > MaxSteps) throw new AwkFatal("__steps__");
    }

    private void ExecBody(List<Stmt> body)
    {
        foreach (var s in body) Exec(s);
    }

    private void Exec(Stmt s)
    {
        Tick();
        switch (s)
        {
            case Stmt.Print { K: "print" } pr:
            {
                var ofs = Str(vars["OFS"]);
                var ors = Str(vars["ORS"]);
                var text = pr.Args.Count > 0
                    ? string.Join(ofs, pr.Args.Select(a =>
                    {
                        var v = Ev(a);
                        return v is double d && !(double.IsFinite(d) && Math.Floor(d) == d && Math.Abs(d) < 1e16)
                            ? AwkCmd.AwkSprintf(Str(vars["OFMT"]), new List<object> { d })
                            : Str(v);
                    }).ToList())
                    : record;
                io.Out(text + ors);
                return;
            }
            case Stmt.Print pf:
            {
                var vals = pf.Args.Select(Ev).ToList();
                io.Out(AwkCmd.AwkSprintf(Str(vals[0]), vals.Skip(1).ToList()));
                return;
            }
            case Stmt.ExprStmt es:
                Ev(es.E);
                return;
            case Stmt.Block b:
                ExecBody(b.Body);
                return;
            case Stmt.If i:
                if (Truthy(Ev(i.C))) Exec(i.Then);
                else if (i.Else is not null) Exec(i.Else);
                return;
            case Stmt.While w:
                while (Truthy(Ev(w.C)))
                    if (!LoopBody(w.Body)) break;
                return;
            case Stmt.Do d:
                do
                {
                    if (!LoopBody(d.Body)) break;
                } while (Truthy(Ev(d.C)));
                return;
            case Stmt.For f:
                if (f.Init is not null) Exec(f.Init);
                while (f.C is null || Truthy(Ev(f.C)))
                {
                    if (!LoopBody(f.Body)) break;
                    if (f.Step is not null) Exec(f.Step);
                }
                return;
            case Stmt.ForIn fi:
            {
                var keys = GetArray(fi.Arr).Keys.ToList();
                foreach (var k in keys)
                {
                    bool isNum = IntKeyRe.IsMatch(k);
                    SetVar(fi.V, new AwkCmd.StrNum(k, isNum));
                    if (!LoopBody(fi.Body)) break;
                }
                return;
            }
            case Stmt.Jump { K: "next" }:
                throw new NextSignal();
            case Stmt.Jump { K: "break" }:
                throw new BreakSignal();
            case Stmt.Jump:
                throw new ContinueSignal();
            case Stmt.Exit ex:
                throw new AwkExitSignal(ex.E is not null ? ToExitCode(Math.Truncate(Num(Ev(ex.E)))) : 0);
            case Stmt.Delete del:
                if (del.Subs is not null) GetArray(del.Arr).Remove(Key(del.Subs));
                else GetArray(del.Arr).Clear();
                return;
        }
    }

    private static int ToExitCode(double d) => double.IsNaN(d) ? 0 : (int)Math.Clamp(d, int.MinValue, int.MaxValue);

    /// <summary>Runs a loop body. Returns false on break.</summary>
    private bool LoopBody(Stmt body)
    {
        Tick();
        try
        {
            Exec(body);
        }
        catch (BreakSignal)
        {
            return false;
        }
        catch (ContinueSignal)
        {
        }
        return true;
    }

    private object Ev(Expr e)
    {
        switch (e)
        {
            case Expr.Num n:
                return n.V;
            case Expr.Str s:
                return s.V;
            case Expr.Re r:
                return GetRegex(r.Src, "").IsMatch(record) ? 1.0 : 0.0;
            case Expr.Var v:
                return GetVar(v.Name);
            case Expr.Field or Expr.Idx:
                return Get(e);
            case Expr.Group:
                throw new AwkFatal("invalid use of a parenthesized list");
            case Expr.Assign a:
            {
                var rhs = Ev(a.E);
                object val = rhs;
                if (a.Op != "=") val = Arith(a.Op[..^1], Num(Get(a.Target)), Num(rhs));
                Set(a.Target, val);
                return val;
            }
            case Expr.Cond c:
                return Truthy(Ev(c.C)) ? Ev(c.A) : Ev(c.B);
            case Expr.Logic { K: "and" } l:
                return Truthy(Ev(l.A)) && Truthy(Ev(l.B)) ? 1.0 : 0.0;
            case Expr.Logic l:
                return Truthy(Ev(l.A)) || Truthy(Ev(l.B)) ? 1.0 : 0.0;
            case Expr.Unary { K: "not" } u:
                return Truthy(Ev(u.E)) ? 0.0 : 1.0;
            case Expr.Unary { K: "neg" } u:
                return -Num(Ev(u.E));
            case Expr.Unary u:
                return Num(Ev(u.E));
            case Expr.Bin b:
                return Arith(b.Op, Num(Ev(b.A)), Num(Ev(b.B)));
            case Expr.Cmp c:
            {
                var a = Ev(c.A);
                var b = Ev(c.B);
                double d;
                if (AwkCmd.IsNumeric(a) && AwkCmd.IsNumeric(b)) d = Num(a) - Num(b);
                else
                {
                    int cmp = string.CompareOrdinal(Str(a), Str(b));
                    d = cmp < 0 ? -1 : cmp > 0 ? 1 : 0;
                }
                bool res = c.Op switch
                {
                    "<" => d < 0,
                    "<=" => d <= 0,
                    ">" => d > 0,
                    ">=" => d >= 0,
                    "==" => d == 0,
                    _ => d != 0,
                };
                return res ? 1.0 : 0.0;
            }
            case Expr.Match m:
            {
                bool ok = RegexOf(m.Re).IsMatch(Str(Ev(m.A)));
                return ok != m.Neg ? 1.0 : 0.0;
            }
            case Expr.Concat cc:
                return Str(Ev(cc.A)) + Str(Ev(cc.B));
            case Expr.Incr inc:
            {
                double old = Num(Get(inc.Target));
                double v = inc.Op == "++" ? old + 1 : old - 1;
                Set(inc.Target, v);
                return inc.Prefix ? v : old;
            }
            case Expr.In i:
            {
                var a = GetArray(i.Arr);
                return a.ContainsKey(Key(i.Subs)) ? 1.0 : 0.0;
            }
            case Expr.Call call:
                return Call(call.Name, call.Args);
        }
        throw new AwkFatal("invalid expression");
    }

    private static double Arith(string op, double a, double b)
    {
        switch (op)
        {
            case "+":
                return a + b;
            case "-":
                return a - b;
            case "*":
                return a * b;
            case "/":
                if (b == 0) throw new AwkFatal("division by zero attempted");
                return a / b;
            case "%":
                if (b == 0) throw new AwkFatal("division by zero attempted in `%'");
                return a % b;
            default:
                // a ** b (JS differs from Math.Pow for NaN exponents and ±1 ** ±Infinity).
                if (double.IsNaN(b)) return double.NaN;
                if (Math.Abs(a) == 1 && double.IsInfinity(b)) return double.NaN;
                return Math.Pow(a, b);
        }
    }

    private object Call(string name, List<Expr> args)
    {
        object Arg(int i) => Ev(args[i]);
        void Need(int min, int? max = null)
        {
            if (args.Count < min || args.Count > (max ?? min)) throw new AwkFatal($"{name}: called with {args.Count} arguments");
        }
        switch (name)
        {
            case "length":
            {
                Need(0, 1);
                if (args.Count == 0) return (double)record.Length;
                if (args[0] is Expr.Var a0 && arrays.TryGetValue(a0.Name, out var arr)) return (double)arr.Count;
                return (double)Str(Arg(0)).Length;
            }
            case "substr":
            {
                Need(2, 3);
                var s = Str(Arg(0));
                double m = AwkCmd.JsRound(Num(Arg(1)));
                double end = args.Count == 3 ? m + AwkCmd.JsRound(Num(Arg(2))) : double.PositiveInfinity;
                double from = double.IsNaN(m) ? double.NaN : Math.Max(m, 1);
                double to = double.IsNaN(end) ? double.NaN : Math.Min(end, s.Length + 1);
                return to > from ? s.Substring((int)from - 1, (int)to - (int)from) : "";
            }
            case "index":
                Need(2);
                return (double)(Str(Arg(0)).IndexOf(Str(Arg(1)), StringComparison.Ordinal) + 1);
            case "split":
            {
                Need(2, 3);
                var target = args[1];
                if (target is not Expr.Var tv) throw new AwkFatal("split: second argument is not an array");
                var s = Str(Arg(0));
                List<string> parts = args.Count == 3
                    ? args[2] is Expr.Re re
                        ? s == "" ? new List<string>() : RegexCmd.JsSplit(s, GetRegex(re.Src, ""))
                        : SplitFs(s, Str(Arg(2)))
                    : SplitFs(s, Str(vars["FS"]));
                var a = GetArray(tv.Name);
                a.Clear();
                for (int i = 0; i < parts.Count; i++) a[Js.Num(i + 1)] = new AwkCmd.StrNum(parts[i]);
                return (double)parts.Count;
            }
            case "sub":
            case "gsub":
            {
                Need(2, 3);
                Expr target = args.Count > 2 ? args[2] : new Expr.Field(new Expr.Num(0));
                if (!AwkCmd.IsLvalue(target)) throw new AwkFatal($"{name}: third argument is not a changeable object");
                var re = RegexOf(args[0], "g");
                var repl = Str(Arg(1));
                var s = Str(Get(target));
                int count = 0;
                var result = re.Replace(s, m =>
                {
                    if (name == "sub" && count > 0) return m.Value;
                    count++;
                    var o = new StringBuilder();
                    for (int i = 0; i < repl.Length; i++)
                    {
                        if (repl[i] == '\\' && i + 1 < repl.Length && (repl[i + 1] == '\\' || repl[i + 1] == '&'))
                        {
                            o.Append(repl[i + 1] == '&' ? '&' : '\\');
                            i++;
                        }
                        else if (repl[i] == '&') o.Append(m.Value);
                        else o.Append(repl[i]);
                    }
                    return o.ToString();
                });
                if (count > 0) Set(target, result);
                return (double)count;
            }
            case "match":
            {
                Need(2);
                var m = RegexOf(args[1]).Match(Str(Arg(0)));
                double start = m.Success ? m.Index + 1 : 0;
                vars["RSTART"] = start;
                vars["RLENGTH"] = m.Success ? (double)m.Length : -1.0;
                return start;
            }
            case "sprintf":
            {
                if (args.Count == 0) throw new AwkFatal("sprintf: no arguments");
                var vals = args.Select(Ev).ToList();
                return AwkCmd.AwkSprintf(Str(vals[0]), vals.Skip(1).ToList());
            }
            case "toupper":
            {
                Need(1);
                var s = Str(Arg(0));
                return io.AsciiCase ? new string(s.Select(c => c is >= 'a' and <= 'z' ? (char)(c - 32) : c).ToArray()) : AwkCmd.JsUpper(s);
            }
            case "tolower":
            {
                Need(1);
                var s = Str(Arg(0));
                return io.AsciiCase ? new string(s.Select(c => c is >= 'A' and <= 'Z' ? (char)(c + 32) : c).ToArray()) : AwkCmd.JsLower(s);
            }
            case "int":
                Need(1);
                return Math.Truncate(Num(Arg(0)));
            case "sqrt":
                Need(1);
                return Math.Sqrt(Num(Arg(0)));
            case "exp":
                Need(1);
                return Math.Exp(Num(Arg(0)));
            case "log":
                Need(1);
                return Math.Log(Num(Arg(0)));
            case "sin":
                Need(1);
                return Math.Sin(Num(Arg(0)));
            case "cos":
                Need(1);
                return Math.Cos(Num(Arg(0)));
            case "atan2":
                Need(2);
                return Math.Atan2(Num(Arg(0)), Num(Arg(1)));
            case "rand":
                return Js.Random();
            case "srand":
                return 0.0;
        }
        throw new AwkFatal($"function `{name}' not defined");
    }
}
