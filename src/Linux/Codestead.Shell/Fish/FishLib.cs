namespace Codestead.Shell;

// Port of src/shell/fish.ts – translates fish code into bash code the shell's normal parser can run.
//
// fish has its own syntax: blocks end with `end`, variables are set with `set`, command
// substitution is written (command), `and`/`or`/`not` are commands and $argv/$status replace
// $@/$?. The translation covers the common cases:
//
//   set NAME value…            ->  __fish_set NAME value…   (builtin command)
//   (command)                  ->  $(command)
//   if A; and B; …; else; …; end      ->  if A && B; then …; else …; fi
//   for x in a b c; …; end     ->  for x in a b c; do …; done
//   while …; …; end            ->  while …; do …; done
//   function f; …; end         ->  f() { …; }
//   begin; …; end              ->  { …; }
//   switch $x; case a b; …; end       ->  case $x in a|b) … ;; esac
//   $argv, $argv[1], $status   ->  "$@", ${1}, $?
//
// Bash syntax fish does not accept (X=1, $?, ${X}, $((...)), then/do/fi …) gives fish's own errors.

public static partial class FishLib
{
    /// <summary>Fish commands the shell has its own (hidden) builtins for.</summary>
    private static readonly Dictionary<string, string> FishBuiltins = new()
    {
        ["set"] = "__fish_set",
        ["count"] = "__fish_count",
        ["math"] = "__fish_math",
        ["status"] = "__fish_status",
        ["contains"] = "__fish_contains",
    };

    /// <summary>Bash words that do not exist in fish.</summary>
    private static readonly HashSet<string> BashOnly = new() { "then", "do", "done", "fi", "esac", "elif", "local", "declare", "let", "[[", "until", "select" };

    private const string Dim = "\x1b[2m";
    private const string Reset = "\x1b[0m";

    private static readonly Regex BareRe = new(@"^[A-Za-z0-9_\[\]-]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex UnquoteRe = new(@"\\([^\n\r\u2028\u2029])|'([^']*)'|""([^""]*)""", RegexOptions.CultureInvariant);
    private static readonly Regex IdentRe = new(@"^[A-Za-z_][A-Za-z0-9_]*\z", RegexOptions.CultureInvariant);
    private static readonly Regex AssignWordRe = new(@"^([A-Za-z_][A-Za-z0-9_]*)=(.*)\z", RegexOptions.CultureInvariant | RegexOptions.Singleline);
    private static readonly Regex AssignPrefixRe = new(@"^[A-Za-z_][A-Za-z0-9_]*=", RegexOptions.CultureInvariant);
    private static readonly Regex ReadScopeRe = new(@"^(-[lgxU]+|--(local|global|export|universal))\z", RegexOptions.CultureInvariant);
    private static readonly Regex BracedVarRe = new(@"^\{\$([A-Za-z_][A-Za-z0-9_]*)\}", RegexOptions.CultureInvariant);
    private static readonly Regex BashBracketRe = new(@"^\$\{([^}]*)\}", RegexOptions.CultureInvariant);
    private static readonly Regex DollarVarRe = new(@"^\$([A-Za-z_][A-Za-z0-9_]*)(?:\[(-?[0-9]+)\])?", RegexOptions.CultureInvariant);

    private static readonly Dictionary<string, string> DollarErrors = new()
    {
        ["?"] = "$? is not the exit status. In fish, please use $status.",
        ["$"] = "$$ is not the pid. In fish, please use $fish_pid.",
        ["#"] = "$# is not supported. In fish, please use 'count $argv'.",
        ["@"] = "$@ is not supported. In fish, please use $argv.",
        ["*"] = "$* is not supported. In fish, please use $argv.",
    };

    /// <summary>Translates fish code to bash. <paramref name="lang"/> is the language of the simulator's own hints.</summary>
    public static string TranslateFish(string text, string lang = ShellI18n.Source) =>
        new FishTranslator(lang).Translate(text);

    private static ParseError FishError(string message, bool incomplete = false) => new(message, incomplete);

    /// <summary>Finds the end of a quote starting at i (pointing at the quote character). Returns -1 if missing.</summary>
    private static int ClosingQuote(string s, int i)
    {
        char q = s[i];
        for (int j = i + 1; j < s.Length; j++)
        {
            if (s[j] == '\\' && (q == '"' || s.CharAt(j + 1) == "'" || s.CharAt(j + 1) == "\\")) j++;
            else if (s[j] == q) return j;
        }
        return -1;
    }

    /// <summary>Finds the parenthesis closing the one at i. Returns -1 if missing.</summary>
    private static int ClosingParen(string s, int i)
    {
        int depth = 0;
        for (int j = i; j < s.Length; j++)
        {
            char c = s[j];
            if (c == '\\') j++;
            else if (c == '\'' || c == '"')
            {
                int k = ClosingQuote(s, j);
                if (k < 0) return -1;
                j = k;
            }
            else if (c == '(') depth++;
            else if (c == ')' && --depth == 0) return j;
        }
        return -1;
    }

    private sealed class FTok
    {
        /// <summary>"word" or "op".</summary>
        public string T { get; init; } = "word";
        public string Raw { get; init; } = "";
        public string Op { get; init; } = "";
        public static FTok Word(string raw) => new() { T = "word", Raw = raw };
        public static FTok MakeOp(string op) => new() { T = "op", Op = op };
    }

    private static List<FTok> Lex(string text)
    {
        var toks = new List<FTok>();
        int i = 0;
        int n = text.Length;
        while (i < n)
        {
            char c = text[i];
            if (c == ' ' || c == '\t' || c == '\r')
            {
                i++;
            }
            else if (c == '\\' && text.CharAt(i + 1) == "\n")
            {
                i += 2;
            }
            else if (c == '#')
            {
                while (i < n && text[i] != '\n') i++;
            }
            else if (c == '\n' || c == ';')
            {
                toks.Add(FTok.MakeOp(";"));
                i++;
            }
            else if (c == '|')
            {
                bool two = text.CharAt(i + 1) == "|";
                toks.Add(FTok.MakeOp(two ? "||" : "|"));
                i += two ? 2 : 1;
            }
            else if (c == '&' && text.CharAt(i + 1) == "&")
            {
                toks.Add(FTok.MakeOp("&&"));
                i += 2;
            }
            else if (c == '&' && text.CharAt(i + 1) != ">")
            {
                toks.Add(FTok.MakeOp("&"));
                i++;
            }
            else
            {
                int start = i;
                while (i < n)
                {
                    char ch = text[i];
                    if (ch == '\\')
                    {
                        i += 2;
                    }
                    else if (ch == '\'' || ch == '"')
                    {
                        int j = ClosingQuote(text, i);
                        if (j < 0) throw FishError("Unexpected end of string, quotes are not balanced", true);
                        i = j + 1;
                    }
                    else if (ch == '(')
                    {
                        int j = ClosingParen(text, i);
                        if (j < 0) throw FishError("Unexpected end of string, parenthesis do not match", true);
                        i = j + 1;
                    }
                    else if (ch == ')')
                    {
                        throw FishError("Unexpected ')' for unopened parenthesis");
                    }
                    else if (ch == '<' && text.CharAt(i + 1) == "<")
                    {
                        throw FishError("Expected a string, but found a redirection");
                    }
                    else if (" \t\r\n;|".Contains(ch))
                    {
                        break;
                    }
                    else if (ch == '&' && text.CharAt(i - 1) != ">" && text.CharAt(i + 1) != ">")
                    {
                        break;
                    }
                    else
                    {
                        i++;
                    }
                }
                toks.Add(FTok.Word(text.Slice(start, i)));
            }
        }
        return toks;
    }

    /// <summary>The word without quotes, if it is a plain word (for keywords).</summary>
    private static string? Bare(FTok? t) => t is not null && t.T == "word" && BareRe.IsMatch(t.Raw) ? t.Raw : null;

    /// <summary>Removes quotes (used for case patterns, which work as wildcards).</summary>
    private static string Unquote(string raw) => UnquoteRe.Replace(raw, m =>
        m.Groups[1].Success ? m.Groups[1].Value : m.Groups[2].Success ? m.Groups[2].Value : m.Groups[3].Success ? m.Groups[3].Value : "");
}
