namespace Codestead.Shell.Commands;

// The xargs command: build command lines from standard input.

public static partial class RunCmd
{
    /// <summary>Splits xargs input into words: blanks separate, quotes and backslashes keep blanks.</summary>
    private static List<string>? SplitWords(string input, out string? error)
    {
        error = null;
        var words = new List<string>();
        var cur = new StringBuilder();
        bool inWord = false;
        char quote = '\0';
        for (int i = 0; i < input.Length; i++)
        {
            char c = input[i];
            if (quote != '\0')
            {
                if (c == quote) quote = '\0';
                else if (c == '\n')
                {
                    error = $"unmatched {(quote == '\'' ? "single" : "double")} quote; by default quotes are special to xargs unless you use the -0 option";
                    return null;
                }
                else cur.Append(c);
                continue;
            }
            if (c == '\'' || c == '"')
            {
                quote = c;
                inWord = true;
                continue;
            }
            if (c == '\\' && i + 1 < input.Length)
            {
                cur.Append(input[++i]);
                inWord = true;
                continue;
            }
            if (char.IsWhiteSpace(c))
            {
                if (inWord) words.Add(cur.ToString());
                cur.Clear();
                inWord = false;
                continue;
            }
            cur.Append(c);
            inWord = true;
        }
        if (quote != '\0')
        {
            error = $"unmatched {(quote == '\'' ? "single" : "double")} quote; by default quotes are special to xargs unless you use the -0 option";
            return null;
        }
        if (inWord) words.Add(cur.ToString());
        return words;
    }

    private static readonly CommandDef Xargs = new()
    {
        Name = "xargs",
        Summary = "Gör om indata till argument till ett kommando",
        SummaryEn = "Build command lines from standard input",
        Man = """
            NAMN
                   xargs - gör om indata till argument

            SYNOPSIS
                   ... | xargs [-n N] [-I ERSÄTT] [-0] [-t] [KOMMANDO [ARGUMENT]...]

            BESKRIVNING
                   Många kommandon läser inte från en pipe utan vill ha filnamn som
                   argument, t.ex. rm, mkdir och wc. xargs läser orden från sin
                   indata och sätter dem efter KOMMANDO. Utan KOMMANDO används echo.

                       find . -name "*.tmp" | xargs rm
                   blir samma sak som
                       rm ./a.tmp ./b.tmp

            FLAGGOR
                   -n N        högst N argument per körning
                   -I ERSÄTT   kör KOMMANDO en gång per rad och byt ut ERSÄTT
                               (ofta {}) mot raden
                   -0          orden skiljs åt av NUL-tecken (find -print0)
                   -d TECKEN   orden skiljs åt av TECKEN, t.ex. -d '\n'
                   -t          visa varje kommando innan det körs
                   -r          kör inte KOMMANDO alls om indata är tom

            EXEMPEL
                   ls *.txt | xargs wc -l
                   cat namn.txt | xargs -n 1 echo Hej
                   ls *.log | xargs -I {} cp {} backup/
            """,
        ManEn = """
            NAME
                   xargs - build command lines from standard input

            SYNOPSIS
                   ... | xargs [-n N] [-I REPLACE] [-0] [-t] [COMMAND [ARGUMENT]...]

            DESCRIPTION
                   Many commands do not read from a pipe but want file names as
                   arguments, for example rm, mkdir and wc. xargs reads the words in
                   its input and puts them after COMMAND. Without COMMAND, echo is used.

                       find . -name "*.tmp" | xargs rm
                   is the same as
                       rm ./a.tmp ./b.tmp

            OPTIONS
                   -n N        at most N arguments per run
                   -I REPLACE  run COMMAND once per line, with REPLACE (often {})
                               replaced by the line
                   -0          words are separated by NUL characters (find -print0)
                   -d CHAR     words are separated by CHAR, for example -d '\n'
                   -t          show each command before it runs
                   -r          do not run COMMAND at all if the input is empty

            EXAMPLES
                   ls *.txt | xargs wc -l
                   cat names.txt | xargs -n 1 echo Hello
                   ls *.log | xargs -I {} cp {} backup/
            """,
        Run = ctx =>
        {
            // Options come before the command; everything from the command on belongs to it.
            var args = ctx.Args.ToList();
            int maxArgs = 0;
            string? replace = null;
            string? delimiter = null;
            bool trace = false, noEmpty = false;
            int i = 0;
            for (; i < args.Count; i++)
            {
                var a = args[i];
                if (!a.StartsWith('-') || a == "-") break;
                if (a == "--") { i++; break; }
                string? Value(string flag)
                {
                    if (a.Length > flag.Length) return a[flag.Length..];
                    return ++i < args.Count ? args[i] : null;
                }
                if (a.StartsWith("-n", StringComparison.Ordinal))
                {
                    var v = Value("-n");
                    if (v is null || !int.TryParse(v, NumberStyles.None, CultureInfo.InvariantCulture, out maxArgs) || maxArgs < 1)
                    {
                        ctx.Err($"xargs: invalid number \"{v}\" for -n option\n");
                        return 1;
                    }
                }
                else if (a.StartsWith("-I", StringComparison.Ordinal) || a.StartsWith("-i", StringComparison.Ordinal))
                {
                    replace = a.StartsWith("-i", StringComparison.Ordinal) ? (a.Length > 2 ? a[2..] : "{}") : Value("-I");
                    if (replace is null) return UtilCmd.BadOption(ctx, "option requires an argument -- 'I'");
                }
                else if (a.StartsWith("-d", StringComparison.Ordinal))
                {
                    var v = Value("-d");
                    if (v is null) return UtilCmd.BadOption(ctx, "option requires an argument -- 'd'");
                    delimiter = v switch { "\\n" => "\n", "\\t" => "\t", "\\0" => "\0", _ => v[..1] };
                }
                else if (a == "-0" || a == "--null") delimiter = "\0";
                else if (a == "-t" || a == "--verbose") trace = true;
                else if (a == "-r" || a == "--no-run-if-empty") noEmpty = true;
                else return UtilCmd.BadOption(ctx, $"invalid option -- '{a.TrimStart('-')}'");
            }
            var command = args.Skip(i).ToList();
            if (command.Count == 0) command.Add("echo");
            var input = ctx.Stdin ?? "";

            List<string> items;
            if (replace is not null)
                items = input.Split('\n').Select(l => l.Trim()).Where(l => l != "").ToList();
            else if (delimiter is not null)
            {
                items = input.Split(delimiter[0]).ToList();
                if (items.Count > 0 && items[^1] == "") items.RemoveAt(items.Count - 1);
                if (delimiter == "\n") items = items.Select(l => l.TrimEnd('\r')).ToList();
            }
            else
            {
                var words = SplitWords(input, out var error);
                if (words is null)
                {
                    ctx.Err($"xargs: {error}\n");
                    return 1;
                }
                items = words;
            }

            var runs = new List<List<string>>();
            if (replace is not null)
                foreach (var item in items) runs.Add(command.Select(w => w.Replace(replace, item, StringComparison.Ordinal)).ToList());
            else if (items.Count == 0)
            {
                if (!noEmpty) runs.Add(command.ToList());
            }
            else
            {
                int per = maxArgs > 0 ? maxArgs : int.MaxValue;
                for (int k = 0; k < items.Count; k += per)
                    runs.Add(command.Concat(items.Skip(k).Take(per)).ToList());
            }

            int result = 0;
            foreach (var argv in runs)
            {
                if (trace) ctx.Err(string.Join(" ", argv) + "\n");
                var io = new IO(ctx.OutFn, ctx.ErrFn, null, ctx.IsTTY);
                int code = Exec(ctx, "xargs", argv, io);
                if (code == 127 || code == 126) return code;
                if (code == 255)
                {
                    ctx.Err($"xargs: {argv[0]}: exited with status 255; aborting\n");
                    return 124;
                }
                if (code != 0) result = 123;
            }
            return result;
        },
    };
}
