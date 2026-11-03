namespace Codestead.Shell.Commands;

// The awk interpreter: runs the parsed program over the input records.

public partial class AwkInterpreter
{
    private sealed class NextSignal : Exception { }
    private sealed class BreakSignal : Exception { }
    private sealed class ContinueSignal : Exception { }
    private sealed class AwkExitSignal(int code) : Exception { public int Code { get; } = code; }

    private const int MaxSteps = 200_000;

    private readonly Dictionary<string, object> vars = new(StringComparer.Ordinal);
    private readonly Dictionary<string, OrderedDictionary<string, object>> arrays = new(StringComparer.Ordinal);
    private string record = "";
    private List<string> fields = new();
    private int nf;
    private readonly Dictionary<string, Regex> regexCache = new(StringComparer.Ordinal);
    private int steps;
    private readonly List<Rule> rules;
    private readonly AwkIO io;

    private static readonly Regex AssignOperandRe = new(@"^[A-Za-z_][A-Za-z0-9_]*=", RegexOptions.CultureInvariant);
    private static readonly Regex AssignFullRe = new(@"^([A-Za-z_][A-Za-z0-9_]*)=(.*)\z", RegexOptions.Singleline | RegexOptions.CultureInvariant);
    private static readonly Regex IntKeyRe = new(@"^-?[0-9]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex SpaceSplitRe = new(@"[ \t\n]+", RegexOptions.CultureInvariant);

    public AwkInterpreter(List<Rule> rules, AwkIO io)
    {
        this.rules = rules;
        this.io = io;
        vars["FS"] = " ";
        vars["OFS"] = " ";
        vars["ORS"] = "\n";
        vars["RS"] = "\n";
        vars["NR"] = 0.0;
        vars["FNR"] = 0.0;
        vars["FILENAME"] = "";
        vars["SUBSEP"] = "\x1c";
        vars["RSTART"] = 0.0;
        vars["RLENGTH"] = -1.0;
        vars["CONVFMT"] = "%.6g";
        vars["OFMT"] = "%.6g";
    }

    private static double Num(object v) => AwkCmd.Num(v);
    private static string Str(object v) => AwkCmd.Str(v);
    private static bool Truthy(object v) => AwkCmd.Truthy(v);

    /// <summary>-v name=value and name=value among the file arguments.</summary>
    public void Assign(string name, string value) => vars[name] = new AwkCmd.StrNum(AwkCmd.UnescapeAwk(value));

    public int Run(List<string> operands, string stdin)
    {
        int code = 0;
        var begin = rules.Where(r => r.Pattern is "BEGIN").ToList();
        var end = rules.Where(r => r.Pattern is "END").ToList();
        var main = rules.Where(r => r.Pattern is not "BEGIN" and not "END").ToList();
        bool exited = false;
        try
        {
            foreach (var r in begin) ExecBody(r.Action!);
        }
        catch (AwkExitSignal e)
        {
            code = e.Code;
            exited = true;
        }
        if (!exited && (main.Count > 0 || end.Count > 0))
        {
            try
            {
                var files = operands.Where(o => !AssignOperandRe.IsMatch(o)).ToList();
                var sources = files.Count > 0 ? operands : operands.Append("-").ToList();
                foreach (var op in sources)
                {
                    var m = AssignFullRe.Match(op);
                    if (m.Success)
                    {
                        Assign(m.Groups[1].Value, m.Groups[2].Value);
                        continue;
                    }
                    var input = op == "-" ? new AwkInput { Name = "", Content = stdin } : io.ReadInput(op);
                    if (input is null)
                    {
                        code = 2;
                        continue;
                    }
                    vars["FILENAME"] = input.Name;
                    vars["FNR"] = 0.0;
                    foreach (var rec in Records(input.Content))
                    {
                        vars["NR"] = Num(vars["NR"]) + 1;
                        vars["FNR"] = Num(vars["FNR"]) + 1;
                        SetRecord(rec);
                        try
                        {
                            foreach (var r in main)
                            {
                                if (r.Pattern is not null && !Truthy(Ev((Expr)r.Pattern))) continue;
                                if (r.Action is not null) ExecBody(r.Action);
                                else io.Out(record + Str(vars["ORS"]));
                            }
                        }
                        catch (NextSignal)
                        {
                        }
                    }
                }
            }
            catch (AwkExitSignal e)
            {
                code = e.Code;
            }
        }
        try
        {
            foreach (var r in end) ExecBody(r.Action!);
        }
        catch (AwkExitSignal e)
        {
            code = e.Code;
        }
        return code;
    }

    private List<string> Records(string content)
    {
        var rs = Str(vars["RS"]);
        if (content == "") return new List<string>();
        if (rs == "\n" || rs == "")
        {
            var lines = content.Split('\n').ToList();
            if (lines[^1] == "") lines.RemoveAt(lines.Count - 1);
            return lines;
        }
        var recs = content.Split(rs[0]).ToList();
        if (recs[^1] == "" || recs[^1] == "\n") recs.RemoveAt(recs.Count - 1);
        return recs;
    }

    private List<string> SplitFs(string s, string fs)
    {
        if (fs == " ")
        {
            var t = s.Trim();
            return t == "" ? new List<string>() : RegexCmd.JsSplit(t, SpaceSplitRe);
        }
        if (s == "") return new List<string>();
        if (fs.Length == 1 && fs != "\\") return s.Split(fs[0]).ToList();
        return RegexCmd.JsSplit(s, GetRegex(fs, ""));
    }

    private void SetRecord(string rec)
    {
        record = rec;
        var parts = SplitFs(rec, Str(vars["FS"]));
        fields = new List<string> { "" };
        fields.AddRange(parts);
        nf = parts.Count;
    }

    private void Rebuild() => record = string.Join(Str(vars["OFS"]), fields.Skip(1).Take(nf));

    private object GetField(double i)
    {
        if (i < 0) throw new AwkFatal($"attempt to access field {AwkCmd.JsString(i)}");
        if (i == 0) return new AwkCmd.StrNum(record);
        return i <= nf ? new AwkCmd.StrNum(fields[(int)i]) : AwkCmd.Uninit;
    }

    private void SetField(double i, string v)
    {
        if (i < 0) throw new AwkFatal($"attempt to access field {AwkCmd.JsString(i)}");
        if (i == 0)
        {
            SetRecord(v);
            return;
        }
        if (double.IsNaN(i))
        {
            Rebuild();
            return;
        }
        int idx = (int)Math.Min(i, int.MaxValue - 1);
        while (fields.Count <= idx) fields.Add("");
        fields[idx] = v;
        if (idx > nf) nf = idx;
        Rebuild();
    }

    private object GetVar(string name)
    {
        if (name == "NF") return (double)nf;
        if (arrays.ContainsKey(name)) throw new AwkFatal($"attempt to use array `{name}' in a scalar context");
        return vars.TryGetValue(name, out var v) ? v : AwkCmd.Uninit;
    }

    private void SetVar(string name, object v)
    {
        if (arrays.ContainsKey(name)) throw new AwkFatal($"attempt to use array `{name}' in a scalar context");
        if (name == "NF")
        {
            double n = Math.Max(0, Math.Truncate(Num(v)));
            if (double.IsNaN(n)) n = 0;
            int ni = (int)Math.Min(n, int.MaxValue - 1);
            while (fields.Count <= ni) fields.Add("");
            nf = ni;
            Rebuild();
            return;
        }
        vars[name] = v;
    }

    private OrderedDictionary<string, object> GetArray(string name)
    {
        if (vars.ContainsKey(name) || name == "NF") throw new AwkFatal($"attempt to use scalar `{name}' as an array");
        if (!arrays.TryGetValue(name, out var a))
        {
            a = new OrderedDictionary<string, object>(StringComparer.Ordinal);
            arrays[name] = a;
        }
        return a;
    }

    private string Key(List<Expr> subs) => string.Join(Str(vars["SUBSEP"]), subs.Select(s => Str(Ev(s))));

    private object Get(Expr target)
    {
        switch (target)
        {
            case Expr.Var v:
                return GetVar(v.Name);
            case Expr.Field f:
                return GetField(Math.Truncate(Num(Ev(f.E))));
            case Expr.Idx x:
            {
                var a = GetArray(x.Name);
                var k = Key(x.Subs);
                if (!a.ContainsKey(k)) a[k] = AwkCmd.Uninit;
                return a[k];
            }
        }
        throw new AwkFatal("invalid assignment target");
    }

    private void Set(Expr target, object v)
    {
        if (target is Expr.Var var) SetVar(var.Name, v);
        else if (target is Expr.Field f) SetField(Math.Truncate(Num(Ev(f.E))), Str(v));
        else if (target is Expr.Idx x) GetArray(x.Name)[Key(x.Subs)] = v;
    }

    private Regex GetRegex(string src, string flags)
    {
        var key = flags + "/" + src;
        if (!regexCache.TryGetValue(key, out var re))
        {
            try
            {
                re = RegexCmd.NewRegExp(RegexCmd.ToJsRegex(src, true), flags);
            }
            catch (ArgumentException)
            {
                throw new AwkFatal($"invalid regexp: /{src}/");
            }
            regexCache[key] = re;
        }
        return re;
    }

    private Regex RegexOf(Expr e, string flags = "") => GetRegex(e is Expr.Re r ? r.Src : Str(Ev(e)), flags);
}
