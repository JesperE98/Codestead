namespace Codestead.Shell.Commands;

// The sed command (stream editor): replaces, deletes and prints lines.

public static partial class TextprocCmd
{
    private static bool IsDigit(char? c) => c is >= '0' and <= '9';

    private static readonly Regex YEscRe = new("\\\\([^\n\r\u2028\u2029])", RegexOptions.CultureInvariant);

    private static string? Substitute(string ps, SedCommand cmd)
    {
        var re = cmd.Re!.Re;
        int count = 0;
        var o = new StringBuilder();
        int last = 0;
        bool did = false;
        foreach (System.Text.RegularExpressions.Match m in re.Matches(ps))
        {
            count++;
            bool take = cmd.Global ? count >= cmd.Nth : count == cmd.Nth;
            if (!take) continue;
            o.Append(ps, last, m.Index - last).Append(BuildReplacement(cmd.Repl!, m));
            last = m.Index + m.Length;
            did = true;
            if (!cmd.Global) break;
        }
        return did ? o.Append(ps, last, ps.Length - last).ToString() : null;
    }

    private static string BuildReplacement(List<ReplPart> parts, System.Text.RegularExpressions.Match m)
    {
        var o = new StringBuilder();
        char? mode = null;
        char? once = null;
        void Add(string s)
        {
            if (s == "") return;
            if (mode == 'U') s = AwkCmd.JsUpper(s);
            else if (mode == 'L') s = AwkCmd.JsLower(s);
            if (once is not null)
            {
                var first = s[0].ToString();
                s = (once == 'u' ? AwkCmd.JsUpper(first) : AwkCmd.JsLower(first)) + s[1..];
                once = null;
            }
            o.Append(s);
        }
        foreach (var p in parts)
        {
            if (p.Text is not null) Add(p.Text);
            else if (p.Group is int g) Add(g < m.Groups.Count && m.Groups[g].Success ? m.Groups[g].Value : "");
            else if (p.CaseOp is 'u' or 'l') once = p.CaseOp;
            else mode = p.CaseOp == 'E' ? null : p.CaseOp;
        }
        return o.ToString();
    }

    private sealed class SedRun
    {
        public bool Quit { get; set; }
        public double ExitCode { get; set; }
    }

    /// <summary>Runs the sed program on a stream of lines.</summary>
    private static void RunSedStream(List<SedCommand> cmds, string content, bool quiet, Action<string> @out, SedRun run)
    {
        var lines = UtilCmd.SplitLines(content);
        bool missingNewline = content != "" && !content.EndsWith('\n');
        int lastNo = lines.Count;
        foreach (var c in cmds) c.Active = false;

        bool Test(SedAddr a, int n, string ps)
        {
            if (a.Kind == "line") return n == a.N;
            if (a.Kind == "last") return n == lastNo;
            if (a.Kind == "step") return a.Step > 0 ? n >= a.First && (n - a.First) % a.Step == 0 : n == a.First;
            return a.Re!.Re.IsMatch(ps);
        }
        bool Matches(SedCommand cmd, int n, string ps)
        {
            bool m;
            if (cmd.A1 is null) m = true;
            else if (cmd.A2 is null) m = Test(cmd.A1, n, ps);
            else if (!cmd.Active)
            {
                m = Test(cmd.A1, n, ps);
                if (m)
                {
                    var a2 = cmd.A2;
                    cmd.Active = !(a2.Kind == "line" ? a2.N <= n : a2.Kind == "last" ? n == lastNo : false);
                }
            }
            else
            {
                m = true;
                var a2 = cmd.A2;
                if (a2.Kind == "line" ? n >= a2.N : a2.Kind == "last" ? n == lastNo : Test(a2, n, ps)) cmd.Active = false;
            }
            return cmd.Neg ? !m : m;
        }

        for (int idx = 0; idx < lines.Count; idx++)
        {
            int n = idx + 1;
            var ps = lines[idx];
            bool deleted = false;
            var appended = new List<string>();
            foreach (var cmd in cmds)
            {
                if (!Matches(cmd, n, ps)) continue;
                if (cmd.Name == "s")
                {
                    var r = Substitute(ps, cmd);
                    if (r is not null)
                    {
                        ps = r;
                        if (cmd.Print) @out(ps + "\n");
                    }
                }
                else if (cmd.Name == "y")
                {
                    ps = string.Concat(CodePoints(ps).Select(c => cmd.Map!.TryGetValue(c, out var t) ? t : c));
                }
                else if (cmd.Name == "p")
                {
                    @out(ps + "\n");
                }
                else if (cmd.Name == "=")
                {
                    @out(n + "\n");
                }
                else if (cmd.Name == "a")
                {
                    appended.Add(cmd.Text!);
                }
                else if (cmd.Name == "i")
                {
                    @out(cmd.Text! + "\n");
                }
                else if (cmd.Name == "c")
                {
                    if (cmd.A2 is null || cmd.Neg || !cmd.Active) @out(cmd.Text! + "\n");
                    deleted = true;
                    break;
                }
                else if (cmd.Name == "d")
                {
                    deleted = true;
                    break;
                }
                else if (cmd.Name == "q" || cmd.Name == "Q")
                {
                    run.Quit = true;
                    run.ExitCode = cmd.ExitCode;
                    if (cmd.Name == "Q") deleted = true;
                    break;
                }
            }
            if (!deleted && !quiet) @out(ps + (n == lastNo && missingNewline && appended.Count == 0 ? "" : "\n"));
            foreach (var a in appended) @out(a + "\n");
            if (run.Quit) return;
        }
    }

    private static int ExitCodeOf(double d) => double.IsNaN(d) ? 0 : (int)Math.Clamp(d, int.MinValue, int.MaxValue);

    private static readonly CommandDef Sed = new()
    {
        Name = "sed",
        Summary = "Strömeditor: byter ut, tar bort och skriver ut rader",
        Man = """
NAMN
       sed - strömeditor (stream editor) för att filtrera och ändra text

SYNOPSIS
       sed [FLAGGA]... SKRIPT [FIL]...
       sed [FLAGGA]... -e SKRIPT [-e SKRIPT]... [FIL]...

BESKRIVNING
       sed läser filer (eller standard input) rad för rad, kör SKRIPT på
       varje rad och skriver ut resultatet. Filen ändras inte – om du inte
       använder -i.

       Ett skript består av kommandon, valfritt med en ADRESS framför som
       väljer vilka rader kommandot gäller. Flera kommandon skiljs åt med ;
       eller ges med flera -e.

FLAGGOR
       -n        skriv bara ut det som p-kommandot ber om
       -E, -r    utökade reguljära uttryck (som grep -E)
       -i[SUFFIX]
                 ändra filen på plats (in-place). Med SUFFIX sparas en
                 säkerhetskopia, t.ex. -i.bak
       -e SKRIPT lägg till SKRIPT (kan anges flera gånger)

KOMMANDON
       s/MÖNSTER/ERSÄTTNING/FLAGGOR
                 byt ut (substitute). FLAGGOR: g = alla träffar på raden,
                 i = skiftlägesokänsligt, p = skriv ut raden, N = bara
                 träff nummer N. I ERSÄTTNING betyder & hela träffen och
                 \1 ... \9 grupperna \( \) (eller ( ) med -E).
                 Vilket tecken som helst kan avgränsa: s|/usr|/opt|
       d         ta bort raden (delete)
       p         skriv ut raden (print) – oftast tillsammans med -n
       q         avsluta (quit) efter den här raden
       y/abc/xyz/   byt tecken mot tecken
       =         skriv ut radnumret
       a TEXT, i TEXT, c TEXT
                 lägg till text efter / före raden, eller ersätt raden

ADRESSER
       5         rad 5
       1~2       varannan rad (första~steg)
       $         sista raden
       /regex/   rader som matchar
       2,4       rad 2 till 4
       /a/,/b/   från en rad som matchar a till nästa som matchar b
       ADRESS!   alla rader UTOM de som matchar

EXEMPEL
       sed 's/ERROR/FEL/' server.log
       sed -n '5,8p' server.log
       sed '/^#/d' inställningar.conf
       sed -i 's/gammal/ny/g' fil.txt
       sed -E 's/([0-9]+)-([0-9]+)/\2-\1/' datum.txt

SIMULATORN
       Stöder s, d, p, q, Q, y, =, a, i och c. Kommandon som arbetar med
       hållutrymmet (h, H, g, G, x), hopp (b, t) och { } stöds inte.
""",
        Run = ctx =>
        {
            var scripts = new List<string>();
            var operands = new List<string>();
            bool quiet = false;
            bool ere = false;
            string? inPlace = null;
            int Bad(string msg)
            {
                ctx.Err($"sed: {msg}\nUsage: sed [OPTION]... {{script-only-if-no-other-script}} [input-file]...\n");
                return 1;
            }
            var args = ctx.Args;
            for (int k = 0; k < args.Count; k++)
            {
                var a = args[k];
                if (a == "--")
                {
                    operands.AddRange(args.Skip(k + 1));
                    break;
                }
                if (a.StartsWith("--", StringComparison.Ordinal))
                {
                    int eq = a.IndexOf('=');
                    var key = eq >= 0 ? a[..eq] : a;
                    string? val = eq >= 0 ? a[(eq + 1)..] : null;
                    if (key == "--quiet" || key == "--silent") quiet = true;
                    else if (key == "--regexp-extended") ere = true;
                    else if (key == "--in-place") inPlace = val ?? "";
                    else if (key == "--expression")
                    {
                        var v = val ?? (++k < args.Count ? args[k] : null);
                        if (v is null) return Bad("option '--expression' requires an argument");
                        scripts.Add(v);
                    }
                    else return Bad($"unrecognized option '{a}'");
                    continue;
                }
                if (a.StartsWith('-') && a.Length > 1)
                {
                    for (int j = 1; j < a.Length; j++)
                    {
                        char c = a[j];
                        if (c == 'n') quiet = true;
                        else if (c == 'E' || c == 'r') ere = true;
                        else if (c == 's' || c == 'u') continue;
                        else if (c == 'i')
                        {
                            inPlace = a[(j + 1)..];
                            break;
                        }
                        else if (c == 'e' || c == 'f')
                        {
                            var rest = a[(j + 1)..];
                            var v = rest != "" ? rest : (++k < args.Count ? args[k] : null);
                            if (v is null) return Bad($"option requires an argument -- '{c}'");
                            if (c == 'e') scripts.Add(v);
                            else
                            {
                                try
                                {
                                    var text = ctx.Sh.Vfs.ReadFile(ctx.Sh.Resolve(v), ctx.Sh.CurrentUser());
                                    scripts.Add(text.EndsWith('\n') ? text[..^1] : text);
                                }
                                catch (FsError e)
                                {
                                    ctx.Err($"sed: couldn't open file {v}: {e.Message}\n");
                                    return 1;
                                }
                            }
                            break;
                        }
                        else return Bad($"invalid option -- '{c}'");
                    }
                    continue;
                }
                operands.Add(a);
            }
            if (scripts.Count == 0)
            {
                if (operands.Count == 0)
                {
                    ctx.Err(
                        "Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...\n\n" +
                        "  -n, --quiet, --silent\n                 suppress automatic printing of pattern space\n" +
                        "  -e script, --expression=script\n                 add the script to the commands to be executed\n" +
                        "  -i[SUFFIX], --in-place[=SUFFIX]\n                 edit files in place (makes backup if SUFFIX supplied)\n" +
                        "  -E, -r, --regexp-extended\n                 use extended regular expressions in the script\n");
                    return 1;
                }
                scripts.Add(operands[0]);
                operands.RemoveAt(0);
            }

            var cmds = new List<SedCommand>();
            var state = new SedState();
            try
            {
                for (int k = 0; k < scripts.Count; k++) ParseSedScript(scripts[k], k + 1, ere, state, cmds);
            }
            catch (SedError e)
            {
                ctx.Err($"sed: {e.Message}\n");
                return 1;
            }
            catch (SedUnsupported e)
            {
                ctx.Err($"sed: unsupported command: `{e.Message}'\n");
                DimNote(ctx, "textproc.sedUnsupported", ("command", e.Message));
                return 1;
            }

            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            var run = new SedRun();
            int code = 0;

            if (inPlace is not null)
            {
                if (operands.Count == 0)
                {
                    ctx.Err("sed: no input files\n");
                    return 1;
                }
                foreach (var f in operands)
                {
                    var path = sh.Resolve(f);
                    var node = sh.Vfs.TryLookup(path, user);
                    if (node?.Type == "dir")
                    {
                        ctx.Err($"sed: couldn't edit {f}: not a regular file\n");
                        code = 4;
                        continue;
                    }
                    string content;
                    try
                    {
                        content = sh.Vfs.ReadFile(path, user);
                    }
                    catch (FsError e)
                    {
                        ctx.Err($"sed: can't read {f}: {e.Message}\n");
                        code = 2;
                        continue;
                    }
                    var result = new StringBuilder();
                    RunSedStream(cmds, content, quiet, s => result.Append(s), run);
                    try
                    {
                        if (inPlace != "") sh.Vfs.WriteFile(sh.Resolve(f + inPlace), content, user);
                        sh.Vfs.WriteFile(path, result.ToString(), user);
                    }
                    catch (FsError e)
                    {
                        ctx.Err($"sed: couldn't open temporary file {VfsLib.Dirname(path)}/sedXyZ12a: {e.Message}\n");
                        code = 4;
                    }
                    if (run.Quit) break;
                }
                return run.Quit ? ExitCodeOf(run.ExitCode) : code;
            }

            // Without -i every file is read as one long stream.
            var all = new StringBuilder();
            foreach (var f in operands.Count > 0 ? operands : new List<string> { "-" })
            {
                string text;
                if (f == "-") text = ctx.Stdin ?? "";
                else
                {
                    var path = sh.Resolve(f);
                    if (sh.Vfs.TryLookup(path, user)?.Type == "dir")
                    {
                        ctx.Err($"sed: read error on {f}: Is a directory\n");
                        code = 2;
                        continue;
                    }
                    try
                    {
                        text = sh.Vfs.ReadFile(path, user);
                    }
                    catch (FsError e)
                    {
                        ctx.Err($"sed: can't read {f}: {e.Message}\n");
                        code = 2;
                        continue;
                    }
                }
                if (all.Length > 0 && all[^1] != '\n') all.Append('\n');
                all.Append(text);
            }
            RunSedStream(cmds, all.ToString(), quiet, s => ctx.Out(s), run);
            return run.Quit ? ExitCodeOf(run.ExitCode) : code;
        },
    };
}
