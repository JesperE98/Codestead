namespace Codestead.Shell.Commands;

// fish's builtin set (called through the fish translation).

public static partial class ShellsCmd
{
    private static readonly Dictionary<string, string> SetLong = new()
    {
        ["local"] = "l", ["global"] = "g", ["universal"] = "U", ["export"] = "x", ["unexport"] = "u",
        ["erase"] = "e", ["query"] = "q", ["append"] = "a", ["prepend"] = "p", ["names"] = "n",
    };

    private static readonly Regex SetShortRe = new(@"^-[lgUxueqapnS]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex VarNameRe = new(@"^[A-Za-z_][A-Za-z0-9_]*\z", RegexOptions.CultureInvariant);

    private static readonly CommandDef FishSet = FishBuiltin("set", ctx =>
    {
        var sh = ctx.Sh;
        var flags = new HashSet<string>();
        int i = 0;
        for (; i < ctx.Args.Count; i++)
        {
            var a = ctx.Args[i];
            if (a == "--")
            {
                i++;
                break;
            }
            if (a.StartsWith("--", StringComparison.Ordinal) && SetLong.TryGetValue(a.Slice(2), out var longFlag)) flags.Add(longFlag);
            else if (SetShortRe.IsMatch(a)) foreach (var c in a.Slice(1)) flags.Add(c.ToString());
            else if (a.StartsWith('-') && a.Length > 1)
            {
                ctx.Err($"set: {a}: unknown option\n");
                return 2;
            }
            else break;
        }
        var restArgs = ctx.Args.Slice(i);
        if (restArgs.Count == 0)
        {
            // Object.entries(sh.env).sort() compares the entries as "key,value" strings.
            foreach (var (k, v) in sh.Env.OrderBy(kv => kv.Key + "," + kv.Value, StringComparer.Ordinal).ToList())
                ctx.Out(flags.Contains("n") ? $"{k}\n" : $"{k} {v}\n");
            return 0;
        }
        var name = restArgs[0];
        var values = restArgs.Slice(1);
        if (flags.Contains("q")) return restArgs.Count(n => !sh.Env.ContainsKey(n));
        if (!VarNameRe.IsMatch(name))
        {
            ctx.Err($"set: {name}: invalid variable name. See `help identifiers`\n");
            return 2;
        }
        if (flags.Contains("e"))
        {
            if (flags.Contains("U")) ShellmodeLib.SaveUniversalVar(sh, name, null);
            if (!sh.Env.ContainsKey(name)) return 4;
            sh.Env.Remove(name);
            return 0;
        }
        // fish has lists; the simulator stores them separated by spaces (PATH lists with colons).
        var sep = name.EndsWith("PATH", StringComparison.Ordinal) ? ":" : " ";
        var oldValue = sh.Env.Get(name);
        var old = !string.IsNullOrEmpty(oldValue) ? new List<string> { oldValue } : new List<string>();
        var list = flags.Contains("a") ? old.Concat(values) : flags.Contains("p") ? values.Concat(old) : values;
        var value = string.Join(sep, list);
        if (flags.Contains("U")) ShellmodeLib.SaveUniversalVar(sh, name, value);
        // Without -g/-U a new variable in a function is local to the function (like -l).
        bool local = flags.Contains("l") || (!flags.Contains("g") && !flags.Contains("U") && sh.FuncDepth > 0 && !sh.Env.ContainsKey(name));
        if (local && sh.DeclareLocal(name, value)) return 0;
        sh.SetVar(name, value);
        return 0;
    });
}
