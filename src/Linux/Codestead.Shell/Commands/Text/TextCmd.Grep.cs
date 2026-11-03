namespace Codestead.Shell.Commands;

// The grep command: searches for lines matching a pattern.

public static partial class TextCmd
{
    private static readonly CommandDef Grep = new()
    {
        Name = "grep",
        Summary = "Söker efter rader som matchar ett mönster",
        Man = """
NAMN
       grep - skriv ut rader som matchar ett mönster

SYNOPSIS
       grep [FLAGGA]... MÖNSTER [FIL]...

BESKRIVNING
       Söker igenom filer (eller standard input) och skriver ut raderna som
       innehåller MÖNSTER. MÖNSTER är ett reguljärt uttryck.

FLAGGOR
       -i    ignorera skillnad mellan stora och små bokstäver
       -v    visa rader som INTE matchar
       -n    visa radnummer
       -c    visa bara antalet matchande rader
       -l    visa bara namnen på filer som matchar
       -r    sök rekursivt i kataloger
       -w    matcha bara hela ord
       -o    visa bara den del som matchar
       -E    utökade reguljära uttryck (t.ex. "ERROR|WARN")
       -F    mönstret är vanlig text, inte ett reguljärt uttryck

EXEMPEL
       grep ERROR server.log
       grep -in "varning" *.txt
       grep -E "ERROR|WARN" server.log
       ps aux | grep firefox
""",
        Run = RunGrep,
    };

    private static int RunGrep(CmdCtx ctx)
    {
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
        {
            Flags = "ivnclrRwqhHEFos",
            Values = "e",
            Long = new()
            {
                ["ignore-case"] = "i",
                ["invert-match"] = "v",
                ["line-number"] = "n",
                ["count"] = "c",
                ["files-with-matches"] = "l",
                ["recursive"] = "r",
                ["word-regexp"] = "w",
                ["quiet"] = "q",
                ["extended-regexp"] = "E",
                ["fixed-strings"] = "F",
                ["only-matching"] = "o",
                ["color"] = "C",
                ["colour"] = "C",
            },
        });
        if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error, 2);
        var ops = o.Operands.ToList();
        var pattern = o.Values.Get("e");
        if (pattern is null && ops.Count > 0)
        {
            pattern = ops[0];
            ops.RemoveAt(0);
        }
        if (pattern is null)
        {
            ctx.Err("Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.\n");
            return 2;
        }
        var source = o.Flags.Contains("F") ? ParserLib.EscapeRegex(pattern) : o.Flags.Contains("E") ? pattern : BreToJs(pattern);
        if (o.Flags.Contains("w")) source = $"\\b(?:{source})\\b";
        Regex re;
        try
        {
            re = JsRegex(source, o.Flags.Contains("i"));
        }
        catch (ArgumentException)
        {
            ctx.Err("grep: Invalid regular expression\n");
            return 2;
        }

        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        bool recursive = o.Flags.Contains("r") || o.Flags.Contains("R");
        var files = new List<(string Label, string Content)>();
        bool failed = false;
        if (recursive)
        {
            void Walk(string label, FsNode node)
            {
                // grep -r does not follow symbolic links inside the directories it searches.
                if (node.Type == "link") return;
                if (node.Type == "file")
                {
                    if (VfsLib.HasPerm(node, user, 'r')) files.Add((label, node.Content ?? ""));
                    else
                    {
                        ctx.Err($"grep: {label}: Permission denied\n");
                        failed = true;
                    }
                    return;
                }
                if (!VfsLib.HasPerm(node, user, 'r') || !VfsLib.HasPerm(node, user, 'x'))
                {
                    ctx.Err($"grep: {label}: Permission denied\n");
                    failed = true;
                    return;
                }
                foreach (var n in node.Children!.Keys.ToList().SortJs()) Walk(label.EndsWith('/') ? label + n : $"{label}/{n}", node.Children[n]);
            }
            foreach (var p in ops.Count > 0 ? ops : new List<string> { "." })
            {
                try
                {
                    Walk(p, sh.Vfs.Lookup(sh.Resolve(p), user));
                }
                catch (FsError e)
                {
                    ctx.Err($"grep: {p}: {e.Message}\n");
                    failed = true;
                }
            }
        }
        else
        {
            foreach (var p in ops.Count > 0 ? ops : new List<string> { "-" })
            {
                if (p == "-")
                {
                    files.Add(("(standard input)", ctx.Stdin ?? ""));
                    continue;
                }
                var node = sh.Vfs.TryLookup(sh.Resolve(p), user);
                if (node?.Type == "dir")
                {
                    ctx.Err($"grep: {p}: Is a directory\n");
                    continue;
                }
                try
                {
                    files.Add((p, sh.Vfs.ReadFile(sh.Resolve(p), user)));
                }
                catch (FsError e)
                {
                    ctx.Err($"grep: {p}: {e.Message}\n");
                    failed = true;
                }
            }
        }

        bool showName = (files.Count > 1 || recursive) && !o.Flags.Contains("h") ? true : o.Flags.Contains("H");
        bool color = ctx.IsTTY;
        string Paint(string code, string s) => color ? $"{code}{s}{UtilCmd.Color.Reset}" : s;
        bool matchedAny = false;
        foreach (var f in files)
        {
            int count = 0;
            var lines = UtilCmd.SplitLines(f.Content);
            for (int idx = 0; idx < lines.Count; idx++)
            {
                var line = lines[idx];
                bool matches = re.IsMatch(line);
                if (matches == o.Flags.Contains("v")) continue;
                count++;
                matchedAny = true;
                if (o.Flags.Contains("q") || o.Flags.Contains("c") || o.Flags.Contains("l")) continue;
                var prefix =
                    (showName ? Paint(UtilCmd.Color.Magenta, f.Label) + Paint(UtilCmd.Color.Cyan, ":") : "") +
                    (o.Flags.Contains("n") ? Paint(UtilCmd.Color.Green, Js.Num(idx + 1)) + Paint(UtilCmd.Color.Cyan, ":") : "");
                if (o.Flags.Contains("o") && !o.Flags.Contains("v"))
                {
                    foreach (Match m in re.Matches(line)) if (m.Value != "") ctx.Out(prefix + Paint(UtilCmd.Color.Red, m.Value) + "\n");
                    continue;
                }
                var body = color && !o.Flags.Contains("v") ? re.Replace(line, m => Paint(UtilCmd.Color.Red, m.Value)) : line;
                ctx.Out(prefix + body + "\n");
            }
            if (o.Flags.Contains("q")) continue;
            if (o.Flags.Contains("c")) ctx.Out((showName ? Paint(UtilCmd.Color.Magenta, f.Label) + Paint(UtilCmd.Color.Cyan, ":") : "") + count + "\n");
            else if (o.Flags.Contains("l") && count > 0) ctx.Out(Paint(UtilCmd.Color.Magenta, f.Label) + "\n");
        }
        if (failed && !(o.Flags.Contains("q") && matchedAny)) return 2;
        return matchedAny ? 0 : 1;
    }
}
