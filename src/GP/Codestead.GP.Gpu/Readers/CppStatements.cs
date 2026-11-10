using System.Text.RegularExpressions;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// Walks a function body statement by statement, in order. The render loop (a while loop whose condition asks
/// whether the window should close, or a message loop that runs until WM_QUIT) is marked. The body of an if runs
/// unless it is an error branch (it returns or throws); a for loop comes with its body (the reader runs it);
/// else branches, switch and other loops are skipped, but conditions are kept (if (!gladLoadGLLoader(…)) still
/// loads GLAD).
/// </summary>
public static class CppStatements
{
    private static readonly Regex Keyword = new(@"^(if|while|for|switch|do|else|try|catch)\b", RegexOptions.CultureInvariant);

    /// <summary>name, !name, name == 0, name != nullptr …: a condition on one variable.</summary>
    private static readonly Regex SimpleCondition = new(@"^\s*!?\s*[A-Za-z_]\w*\s*(?:[!=]=\s*(?:0|true|false|NULL|nullptr)\s*)?$", RegexOptions.CultureInvariant);

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
                // else if (…): an if like any other (its body runs unless it is an error branch).
                if (word == "else" && Regex.IsMatch(code[j..Math.Min(end, j + 3)], @"^if\b"))
                {
                    i = j;
                    continue;
                }
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
                // The body of an if runs unless it is an error branch (it returns or throws): if (data) { glTexImage2D(…); }
                if (word == "if" && !System.Text.RegularExpressions.Regex.IsMatch(code[bodyStart..bodyEnd], @"\b(?:return|throw|exit)\b"))
                {
                    // A condition the reader may be able to decide (if (cubeVAO == 0), if (!oddRow)) comes with both
                    // branches; any other if is its body.
                    var then = new List<CppStatement>();
                    Walk(code, bodyStart, bodyEnd, then);
                    if (SimpleCondition.IsMatch(condition) && !then.Any(s => s.Kind is "loop-start"))
                    {
                        List<CppStatement>? otherwise = null;
                        int e = bodyEnd + 1;
                        while (e < end && char.IsWhiteSpace(code[e])) e++;
                        if (e + 4 <= end && Regex.IsMatch(code[e..Math.Min(end, e + 5)], @"^else\b"))
                        {
                            int es = e + 4;
                            while (es < end && char.IsWhiteSpace(code[es])) es++;
                            if (!Regex.IsMatch(code[es..Math.Min(end, es + 3)], @"^if\b"))
                            {
                                int ee;
                                if (es < end && code[es] == '{')
                                {
                                    ee = CppSource.MatchBracket(code, es);
                                    if (ee < 0) return;
                                    es++;
                                }
                                else
                                {
                                    ee = es;
                                    int depth = 0;
                                    while (ee < end && !(code[ee] == ';' && depth == 0))
                                    {
                                        if (code[ee] is '(' or '{') depth++;
                                        else if (code[ee] is ')' or '}') depth--;
                                        ee++;
                                    }
                                }
                                otherwise = new List<CppStatement>();
                                Walk(code, es, ee, otherwise);
                                bodyEnd = ee;
                            }
                        }
                        // The condition itself was added above as a statement: replaced by the if.
                        into.RemoveAt(into.Count - 1);
                        into.Add(new CppStatement(condition, i, "if", then, otherwise));
                    }
                    else into.AddRange(then);
                }
                else if (word == "for")
                {
                    var body = new List<CppStatement>();
                    Walk(code, bodyStart, bodyEnd, body);
                    into.Add(new CppStatement(condition, i, "for", body));
                }
                else if (word == "while" && IsRenderLoop(condition))
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
