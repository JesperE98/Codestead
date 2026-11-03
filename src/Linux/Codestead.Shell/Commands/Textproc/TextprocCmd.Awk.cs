namespace Codestead.Shell.Commands;

// The awk command: processes text column by column (a small programming language).

public static partial class TextprocCmd
{
    private static readonly CommandDef Awk = new()
    {
        Name = "awk",
        Summary = "Bearbetar text kolumn för kolumn (ett litet programspråk)",
        Man = """
NAMN
       awk - mönsterstyrt språk för att bearbeta text i kolumner

SYNOPSIS
       awk [-F AVGRÄNSARE] [-v VAR=VÄRDE] 'PROGRAM' [FIL]...
       awk [-F AVGRÄNSARE] -f PROGRAMFIL [FIL]...

BESKRIVNING
       awk läser filer (eller standard input) rad för rad och delar upp
       varje rad i fält. Fälten heter $1, $2, ... och hela raden $0.
       Standard är att fälten skiljs åt av mellanslag och tabbar.

       Ett PROGRAM består av par: MÖNSTER { ÅTGÄRD }
       Åtgärden körs för varje rad som matchar mönstret. Utan mönster körs
       den för alla rader; utan åtgärd skrivs raden ut.

FLAGGOR
       -F TECKEN   fältavgränsare, t.ex. -F: eller -F,
       -v VAR=VÄRDE
                   sätt en variabel innan programmet startar
       -f FIL      läs programmet från FIL

MÖNSTER
       BEGIN { ... }      körs en gång innan första raden
       END { ... }        körs en gång efter sista raden
       /regex/            rader som matchar
       $3 > 10            jämförelser: == != < <= > >=
       $1 ~ /^a/          fält som matchar (!~ = matchar inte)
       NR > 1 && $2 == "x"    && (och), || (eller), ! (inte)

ÅTGÄRDER
       print $1, $3       komma ger mellanslag (OFS) mellan fälten
       printf "%-10s %5.1f\n", $1, $2
       summa += $3        variabler behöver inte deklareras
       antal[$1]++        arrayer med text som index
       if (...) ... else ...   while (...) ...   for (i = 1; i <= NF; i++) ...
       for (nyckel in antal) ...   next   exit

INBYGGDA VARIABLER
       NR    radnummer         NF    antal fält på raden
       $NF   sista fältet      FS / OFS   fältavgränsare in / ut
       FILENAME              filen som läses

FUNKTIONER
       length(s)  substr(s, start, antal)  index(s, t)  split(s, arr, sep)
       sub(/re/, "ny")  gsub(/re/, "ny")  match(s, /re/)  sprintf(...)
       toupper(s)  tolower(s)  int(x)  sqrt(x)

EXEMPEL
       awk '{print $1}' fil.txt
       awk -F: '{print $1, $7}' /etc/passwd
       awk -F, 'NR > 1 {summa += $3} END {print summa}' betyg.csv
       awk '$3 > 50 {print NR": "$0}' data.txt
       ls -l | awk '{print $5, $NF}'

SIMULATORN
       Egna funktioner (function), getline, omdirigering av utdata
       (print > fil) och intervallmönster stöds inte.
""",
        Run = ctx =>
        {
            var args = ctx.Args;
            var assigns = new List<(string Name, string Value)>();
            string? fs = null;
            string? program = null;
            var label = "cmd. line";
            int Usage()
            {
                ctx.Err("Usage: awk [POSIX or GNU style options] -f progfile [--] file ...\nUsage: awk [POSIX or GNU style options] [--] 'program' file ...\n");
                return 2;
            }
            int k = 0;
            for (; k < args.Count; k++)
            {
                var a = args[k];
                if (a == "--")
                {
                    k++;
                    break;
                }
                if (!a.StartsWith('-') || a == "-") break;
                char opt = a[1];
                if (opt == 'F' || opt == 'v' || opt == 'f')
                {
                    var v = a.Length > 2 ? a[2..] : (++k < args.Count ? args[k] : null);
                    if (v is null)
                    {
                        ctx.Err($"awk: option requires an argument -- {opt}\n");
                        return Usage();
                    }
                    if (opt == 'F') fs = v;
                    else if (opt == 'v')
                    {
                        int eq = v.IndexOf('=');
                        if (eq < 1)
                        {
                            ctx.Err($"awk: `{v}' argument to `-v' not in `var=value' form\n");
                            return Usage();
                        }
                        assigns.Add((v[..eq], v[(eq + 1)..]));
                    }
                    else
                    {
                        try
                        {
                            program = ctx.Sh.Vfs.ReadFile(ctx.Sh.Resolve(v), ctx.Sh.CurrentUser());
                            label = v;
                        }
                        catch (FsError e)
                        {
                            ctx.Err($"awk: fatal: can't open source file `{v}' for reading: {e.Message}\n");
                            return 2;
                        }
                    }
                    continue;
                }
                ctx.Err($"awk: {(a.StartsWith("--", StringComparison.Ordinal) ? $"unrecognized option '{a}'" : $"invalid option -- '{opt}'")}\n");
                return Usage();
            }
            var operands = args.Slice(k);
            if (program is null)
            {
                if (operands.Count == 0) return Usage();
                program = operands[0];
                operands.RemoveAt(0);
            }

            List<Rule> rules;
            try
            {
                rules = AwkCmd.ParseAwk(program);
            }
            catch (AwkSyntaxError e)
            {
                var before = program[..Math.Min(e.Pos, program.Length)];
                int lineNo = before.Count(c => c == '\n') + 1;
                int lineStart = before.LastIndexOf('\n') + 1;
                int lineEnd = program.IndexOf('\n', lineStart);
                var srcLine = lineEnd < 0 ? program[lineStart..] : program[lineStart..lineEnd];
                var prefix = $"awk: {label}:{lineNo}: ";
                ctx.Err($"{prefix}{srcLine}\n{prefix}{" ".Repeat(e.Pos - lineStart)}^ {e.Message}\n");
                if (e.Unsupported is { } u)
                    DimNote(ctx, "textproc.awkUnsupported", ("feature", u.Describe(ctx.Sh)), ("note", ctx.Sh.Msg("textproc.awkNote")));
                else
                    DimNote(ctx, "textproc.awkNote");
                return 1;
            }

            var sh = ctx.Sh;
            var interp = new AwkInterpreter(rules, new AwkIO
            {
                // Debian and Ubuntu have mawk, which does not change å, ä and ö.
                AsciiCase = sh.Distro.Family == "debian",
                Out = s => ctx.Out(s),
                ReadInput = op =>
                {
                    var path = sh.Resolve(op);
                    if (sh.Vfs.TryLookup(path, sh.CurrentUser())?.Type == "dir")
                    {
                        ctx.Err($"awk: warning: command line argument `{op}' is a directory: skipped\n");
                        return null;
                    }
                    try
                    {
                        return new AwkInput { Name = op, Content = sh.Vfs.ReadFile(path, sh.CurrentUser()) };
                    }
                    catch (FsError e)
                    {
                        ctx.Err($"awk: fatal: cannot open file `{op}' for reading: {e.Message}\n");
                        throw new AwkFatal("__reported__");
                    }
                },
            });
            if (fs is not null) interp.Assign("FS", fs == "t" ? "\t" : fs);
            foreach (var (name, value) in assigns) interp.Assign(name, value);
            try
            {
                return interp.Run(operands, ctx.Stdin ?? "");
            }
            catch (AwkFatal e)
            {
                if (e.Message == "__reported__") return 2;
                if (e.Message == "__steps__")
                {
                    ctx.Err($"awk: {label}: fatal: program stopped\n");
                    DimNote(ctx, "textproc.awkTooManySteps");
                }
                else ctx.Err($"awk: {label}:1: fatal: {e.Message}\n");
                return 2;
            }
        },
    };
}
