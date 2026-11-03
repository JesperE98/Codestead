namespace Codestead.Shell.Commands;

// Argument parsing shared by the subcommands.

public static partial class GitCmd
{
    private sealed class Parsed
    {
        public OrderedDictionary<string, List<string>> Opts = new(StringComparer.Ordinal);
        public List<string> Operands = new();
        /// <summary>What came after "--" (null if there was no "--").</summary>
        public List<string>? Paths;

        public bool Has(string name) => Opts.ContainsKey(name);
        public string? Get(string name) => Opts.TryGetValue(name, out var v) && v.Count > 0 ? v[^1] : null;
        public List<string>? GetAll(string name) => Opts.TryGetValue(name, out var v) ? v : null;
    }

    private static readonly Regex NegNumRe = new("^-[0-9]+\\z", RO);

    /// <summary>
    /// Parses flags according to a list like ["a|all", "m|message=", "amend"]:
    /// short|long name, "=" means the flag takes a value. Flags can be repeated.
    /// </summary>
    private static Parsed ParseArgs(List<string> args, string[] spec, string cmd)
    {
        var shortDefs = new Dictionary<string, (string Name, bool Value)>(StringComparer.Ordinal);
        var longDefs = new OrderedDictionary<string, (string Name, bool Value)>(StringComparer.Ordinal);
        foreach (var s in spec)
        {
            bool value = s.EndsWith('=');
            var names = (value ? s[..^1] : s).Split('|');
            var name = names.FirstOrDefault(n => n.Length > 1) ?? names[0];
            foreach (var n in names)
            {
                if (n.Length == 1) shortDefs[n] = (name, value);
                else longDefs[n] = (name, value);
            }
        }
        var o = new Parsed();
        void Add(string name, string v)
        {
            if (!o.Opts.TryGetValue(name, out var list)) o.Opts[name] = list = new List<string>();
            list.Add(v);
        }
        GitExit Bad(string what) => new($"error: unknown {what}\nusage: git {cmd} [<options>]\n", 129);
        for (int i = 0; i < args.Count; i++)
        {
            var a = args[i];
            if (a == "--")
            {
                o.Paths = args.Skip(i + 1).ToList();
                break;
            }
            if (a.StartsWith("--", StringComparison.Ordinal) && a.Length > 2)
            {
                int eq = a.IndexOf('=');
                var key = eq >= 0 ? a.Slice(2, eq) : a.Slice(2);
                (string Name, bool Value)? def = longDefs.TryGetValue(key, out var d0) ? d0 : null;
                bool negated = false;
                if (def is null && key.StartsWith("no-", StringComparison.Ordinal) && longDefs.ContainsKey(key.Slice(3)))
                {
                    def = longDefs[key.Slice(3)];
                    key = key.Slice(3);
                    negated = true;
                }
                if (def is null)
                {
                    // Abbreviations such as --stag for --staged.
                    var hits = longDefs.Keys.Where(k => k.StartsWith(key, StringComparison.Ordinal)).ToList();
                    if (hits.Count == 1) def = longDefs[hits[0]];
                }
                if (def is null) throw Bad($"option '{a.Slice(2)}'");
                if (negated)
                {
                    o.Opts.Remove(def.Value.Name);
                    Add("no-" + def.Value.Name, "");
                }
                else if (def.Value.Value)
                {
                    string? v = eq >= 0 ? a.Slice(eq + 1) : (++i < args.Count ? args[i] : null);
                    if (v is null) throw new GitExit($"error: option `{key}' requires a value\n", 129);
                    Add(def.Value.Name, v);
                }
                else Add(def.Value.Name, "");
                continue;
            }
            if (a.StartsWith('-') && a.Length > 1 && !NegNumRe.IsMatch(a))
            {
                for (int j = 1; j < a.Length; j++)
                {
                    var c = a[j].ToString();
                    if (!shortDefs.TryGetValue(c, out var def)) throw Bad($"switch `{c}'");
                    if (def.Value)
                    {
                        var rest = a.Slice(j + 1);
                        string? v = rest != "" ? rest : (++i < args.Count ? args[i] : null);
                        if (v is null) throw new GitExit($"error: switch `{c}' requires a value\n", 129);
                        Add(def.Name, v);
                        break;
                    }
                    Add(def.Name, "");
                }
                continue;
            }
            o.Operands.Add(a);
        }
        return o;
    }
}
