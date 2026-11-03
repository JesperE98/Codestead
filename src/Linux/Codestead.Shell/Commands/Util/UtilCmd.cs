namespace Codestead.Shell.Commands;

// Port of src/shell/commands/util.ts

public static partial class UtilCmd
{
    /// <summary>Edit distance: insertions, deletions and substitutions (git's "most similar command").</summary>
    public static int Levenshtein(string a, string b)
    {
        var dp = new int[a.Length + 1, b.Length + 1];
        for (int i = 0; i <= a.Length; i++) dp[i, 0] = i;
        for (int j = 1; j <= b.Length; j++) dp[0, j] = j;
        for (int i = 1; i <= a.Length; i++)
            for (int j = 1; j <= b.Length; j++)
                dp[i, j] = Math.Min(Math.Min(dp[i - 1, j] + 1, dp[i, j - 1] + 1), dp[i - 1, j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
        return dp[a.Length, b.Length];
    }

    /// <summary>Like <see cref="Levenshtein"/>, but two swapped neighbours count as one edit ("sl" → "ls").</summary>
    public static int TypoDistance(string a, string b)
    {
        var dp = new int[a.Length + 1, b.Length + 1];
        for (int i = 0; i <= a.Length; i++) dp[i, 0] = i;
        for (int j = 0; j <= b.Length; j++) dp[0, j] = j;
        for (int i = 1; i <= a.Length; i++)
            for (int j = 1; j <= b.Length; j++)
            {
                dp[i, j] = Math.Min(Math.Min(dp[i - 1, j] + 1, dp[i, j - 1] + 1), dp[i - 1, j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
                if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1]) dp[i, j] = Math.Min(dp[i, j], dp[i - 2, j - 2] + 1);
            }
        return dp[a.Length, b.Length];
    }

    public static class Color
    {
        public const string Reset = "\x1b[0m";
        public const string Bold = "\x1b[1m";
        public const string Dim = "\x1b[2m";
        public const string Red = "\x1b[1;31m";
        public const string Green = "\x1b[32m";
        public const string Yellow = "\x1b[33m";
        public const string Blue = "\x1b[1;34m";
        public const string Magenta = "\x1b[35m";
        public const string Cyan = "\x1b[36m";
        public const string ExecGreen = "\x1b[1;32m";
    }

    /// <summary>Simple getopt: handles -la, -n 5, -n5, --all, --lines=5 and --.</summary>
    public static Opts ParseOpts(IReadOnlyList<string> args, OptSpec spec)
    {
        var o = new Opts();
        bool TakesValue(string c) => spec.Values?.Contains(c, StringComparison.Ordinal) ?? false;
        for (int i = 0; i < args.Count; i++)
        {
            var a = args[i];
            if (a == "--")
            {
                o.Operands.AddRange(args.Skip(i + 1));
                break;
            }
            if (a.StartsWith("--") && a.Length > 2)
            {
                int eq = a.IndexOf('=');
                var key = eq >= 0 ? a[2..eq] : a[2..];
                if (spec.Long is null || !spec.Long.TryGetValue(key, out var mapped))
                {
                    o.Error = $"unrecognized option '{a}'";
                    return o;
                }
                if (TakesValue(mapped))
                {
                    string? v = eq >= 0 ? a[(eq + 1)..] : (++i < args.Count ? args[i] : null);
                    if (v is null)
                    {
                        o.Error = $"option '{a}' requires an argument";
                        return o;
                    }
                    o.Values[mapped] = v;
                }
                else
                {
                    o.Flags.Add(mapped);
                }
                continue;
            }
            if (a.StartsWith('-') && a.Length > 1)
            {
                for (int j = 1; j < a.Length; j++)
                {
                    char c = a[j];
                    if (TakesValue(c.ToString()))
                    {
                        var rest = a[(j + 1)..];
                        string? v = rest != "" ? rest : (++i < args.Count ? args[i] : null);
                        if (v is null)
                        {
                            o.Error = $"option requires an argument -- '{c}'";
                            return o;
                        }
                        o.Values[c.ToString()] = v;
                        break;
                    }
                    if (spec.Flags?.Contains(c) == true) o.Flags.Add(c.ToString());
                    else
                    {
                        o.Error = $"invalid option -- '{c}'";
                        return o;
                    }
                }
                continue;
            }
            o.Operands.Add(a);
        }
        return o;
    }

    public static int BadOption(CmdCtx ctx, string error, int code = 1)
    {
        ctx.Err($"{ctx.Name}: {error}\nTry '{ctx.Name} --help' for more information.\n");
        return code;
    }

    /// <summary>The message of an FsError; any other exception is rethrown.</summary>
    public static string FsMessage(Exception e)
    {
        if (e is FsError) return e.Message;
        System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(e).Throw();
        throw e; // unreachable
    }

    public static List<string> SplitLines(string text)
    {
        if (text == "") return new List<string>();
        var lines = text.Split('\n').ToList();
        if (lines[^1] == "") lines.RemoveAt(lines.Count - 1);
        return lines;
    }

    public static string JoinLines(IEnumerable<string> lines) => string.Concat(lines.Select(l => l + "\n"));

    /// <summary>
    /// Reads the files in <paramref name="operands"/> (or stdin if none are given / "-").
    /// Errors are printed directly; Failed becomes true if anything went wrong.
    /// </summary>
    public static (List<Input> Inputs, bool Failed) ReadInputs(CmdCtx ctx, IReadOnlyList<string> operands, Func<string, string, string>? errFormat = null)
    {
        errFormat ??= (l, m) => $"{ctx.Name}: {l}: {m}";
        var inputs = new List<Input>();
        bool failed = false;
        var list = operands.Count > 0 ? operands : new List<string> { "-" };
        foreach (var op in list)
        {
            if (op == "-")
            {
                inputs.Add(new Input { Label = "(standard input)", Content = ctx.Stdin ?? "" });
                continue;
            }
            try
            {
                inputs.Add(new Input { Label = op, Content = ctx.Sh.Vfs.ReadFile(ctx.Sh.Resolve(op), ctx.Sh.CurrentUser()) });
            }
            catch (FsError e)
            {
                ctx.Err(errFormat(op, e.Message) + "\n");
                failed = true;
            }
        }
        return (inputs, failed);
    }

    public static readonly string[] Months = { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };
    public static readonly string[] Days = { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };

    public static string LsDate(long ms)
    {
        var d = Js.LocalDate(ms);
        return $"{Months[d.Month - 1]} {d.Day,2} {d.Hour:00}:{d.Minute:00}";
    }

    public static string LongDate(DateTime? date = null)
    {
        var d = date ?? Js.LocalNow();
        var t = $"{d.Hour:00}:{d.Minute:00}:{d.Second:00}";
        var tz = TimeZoneAbbreviation(d);
        return $"{Days[(int)d.DayOfWeek]} {Months[d.Month - 1]} {d.Day,2} {t} {tz} {d.Year}";
    }

    /// <summary>A short time zone name such as "UTC" or "CET" (best effort, like toLocaleTimeString's timeZoneName).</summary>
    public static string TimeZoneAbbreviation(DateTime d)
    {
        var tz = TimeZoneInfo.Local;
        if (tz.Id is "UTC" or "Etc/UTC" or "Etc/Universal" or "Coordinated Universal Time") return "UTC";
        var name = tz.IsDaylightSavingTime(d) ? tz.DaylightName : tz.StandardName;
        if (name.Length <= 5 && !name.Contains(' ')) return name;
        var offset = tz.GetUtcOffset(d);
        if (offset == TimeSpan.Zero) return "UTC";
        var sign = offset < TimeSpan.Zero ? "-" : "+";
        return $"GMT{sign}{Math.Abs(offset.Hours)}" + (offset.Minutes != 0 ? $":{Math.Abs(offset.Minutes):00}" : "");
    }

    public static string ModeString(FsNode n)
    {
        int m = n.Mode;
        string Tri(int shift, int special, char ch)
        {
            int bits = (m >> shift) & 7;
            char r = (bits & 4) != 0 ? 'r' : '-';
            char w = (bits & 2) != 0 ? 'w' : '-';
            char x = (bits & 1) != 0 ? 'x' : '-';
            if ((m & special) != 0) x = (bits & 1) != 0 ? ch : char.ToUpperInvariant(ch);
            return $"{r}{w}{x}";
        }
        return (n.Type == "dir" ? "d" : n.Type == "link" ? "l" : "-") + Tri(6, Js.Oct(4000), 's') + Tri(3, Js.Oct(2000), 's') + Tri(0, Js.Oct(1000), 't');
    }

    /// <param name="broken">For a symbolic link: it points to nothing (shown in red, like ls does).</param>
    public static string ColorName(string name, FsNode node, bool tty, bool broken = false)
    {
        if (!tty) return name;
        if (node.Type == "link") return broken ? $"\x1b[40;31;1m{name}{Color.Reset}" : $"\x1b[1;36m{name}{Color.Reset}";
        if (node.Type == "dir")
        {
            if ((node.Mode & Js.Oct(1002)) == Js.Oct(1002)) return $"\x1b[30;42m{name}{Color.Reset}";
            return $"{Color.Blue}{name}{Color.Reset}";
        }
        if ((node.Mode & Js.Oct(4000)) != 0) return $"\x1b[37;41m{name}{Color.Reset}";
        if ((node.Mode & Js.Oct(111)) != 0) return $"{Color.ExecGreen}{name}{Color.Reset}";
        return name;
    }

    public static string HumanSize(double n)
    {
        if (n < 1024) return Js.Num(n);
        string[] units = { "K", "M", "G" };
        double v = n;
        int u = -1;
        do
        {
            v /= 1024;
            u++;
        } while (v >= 1024 && u < units.Length - 1);
        return (v < 10 ? Js.ToFixed(Math.Ceiling(v * 10) / 10, 1) : Js.Num(Math.Ceiling(v))) + units[u];
    }

    private static readonly Regex AnsiRe = new("\x1b\\[[0-9;]*m", RegexOptions.CultureInvariant);

    public static string StripAnsi(string s) => AnsiRe.Replace(s, "");

    private static readonly Regex NamnRe = new(@"^\s*NAMN\b", RegexOptions.CultureInvariant);

    /// <summary>Formats a simplified man page.</summary>
    public static string FormatMan(string name, string body)
    {
        var title = $"{name.ToUpperInvariant()}(1)";
        // Swedish man pages start with NAMN, English ones with NAME.
        var mid = NamnRe.IsMatch(body) ? "Simulerad manual" : "Simulated manual";
        int pad = Math.Max(1, (72 - title.Length * 2 - mid.Length) / 2);
        var spaces = new string(' ', pad);
        return $"{title}{spaces}{mid}{spaces}{title}\n\n{body.Trim()}\n\n";
    }
}
