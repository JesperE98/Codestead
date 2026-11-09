using System.Text.RegularExpressions;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// Walks a function body statement by statement, in order. The render loop (a while loop whose condition asks
/// whether the window should close, or a message loop that runs until WM_QUIT) is marked; the bodies of if, for,
/// switch and other loops are skipped, but their conditions are kept (if (!gladLoadGLLoader(…)) still loads GLAD).
/// </summary>
public static class CppStatements
{
    private static readonly Regex Keyword = new(@"^(if|while|for|switch|do|else|try|catch)\b", RegexOptions.CultureInvariant);

    public static List<CppStatement> Walk(CppSource src, string function)
    {
        var list = new List<CppStatement>();
        if (!src.Functions.TryGetValue(function, out var range)) return list;
        Walk(src.Code, range.Start, range.End, list);
        return list;
    }

    private static bool IsRenderLoop(string condition) =>
        condition.Contains("WindowShouldClose", StringComparison.Ordinal) || condition.Contains("WM_QUIT", StringComparison.Ordinal);

    private static void Walk(string code, int start, int end, List<CppStatement> into)
    {
        int i = start;
        while (i < end)
        {
            while (i < end && char.IsWhiteSpace(code[i])) i++;
            if (i >= end) break;
            if (code[i] == ';')
            {
                i++;
                continue;
            }
            if (code[i] == '{')
            {
                int close = CppSource.MatchBracket(code, i);
                if (close < 0) return;
                Walk(code, i + 1, close, into);
                i = close + 1;
                continue;
            }
            var m = Keyword.Match(code[i..Math.Min(end, i + 8)]);
            if (m.Success)
            {
                var word = m.Groups[1].Value;
                int j = i + word.Length;
                while (j < end && char.IsWhiteSpace(code[j])) j++;
                string condition = "";
                if (j < end && code[j] == '(')
                {
                    int close = CppSource.MatchBracket(code, j);
                    if (close < 0) return;
                    condition = code[(j + 1)..close];
                    j = close + 1;
                }
                if (condition.Length > 0 && word is "if" or "while" or "switch")
                    into.Add(new CppStatement(condition, i));
                while (j < end && char.IsWhiteSpace(code[j])) j++;
                // The body: a block or a single statement.
                int bodyStart = j, bodyEnd;
                if (j < end && code[j] == '{')
                {
                    bodyEnd = CppSource.MatchBracket(code, j);
                    if (bodyEnd < 0) return;
                    bodyStart = j + 1;
                }
                else
                {
                    bodyEnd = j;
                    int depth = 0;
                    while (bodyEnd < end && !(code[bodyEnd] == ';' && depth == 0))
                    {
                        if (code[bodyEnd] is '(' or '{') depth++;
                        else if (code[bodyEnd] is ')' or '}') depth--;
                        bodyEnd++;
                    }
                }
                if (word == "while" && IsRenderLoop(condition))
                {
                    into.Add(new CppStatement("", i, "loop-start"));
                    Walk(code, bodyStart, bodyEnd, into);
                    into.Add(new CppStatement("", bodyEnd, "loop-end"));
                }
                // do { … } while (…); – skip the trailing while.
                i = bodyEnd + 1;
                if (word == "do")
                {
                    int semi = code.IndexOf(';', i);
                    i = semi < 0 ? end : semi + 1;
                }
                continue;
            }
            // A plain statement up to ';' at depth 0.
            int k = i, d = 0;
            while (k < end)
            {
                char c = code[k];
                if (c == '"' || c == '\'')
                {
                    k++;
                    while (k < end && code[k] != c)
                    {
                        if (code[k] == '\\') k++;
                        k++;
                    }
                }
                else if (c is '(' or '{' or '[') d++;
                else if (c is ')' or '}' or ']') d--;
                else if (c == ';' && d <= 0) break;
                k++;
            }
            into.Add(new CppStatement(code[i..Math.Min(k, end)].Trim(), i));
            i = k + 1;
        }
    }
}
