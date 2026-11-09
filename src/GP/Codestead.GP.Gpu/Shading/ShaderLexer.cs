namespace Codestead.GP.Gpu.Shading;

/// <summary>
/// Splits GLSL, HLSL or a C++ expression into tokens. Comments and preprocessor lines (#version, #include …) are
/// skipped; "0.5f" is the number 0.5; "glm::vec4" and "DirectX::XMFLOAT4" become "vec4" and "XMFLOAT4".
/// </summary>
public static class ShaderLexer
{
    private static readonly string[] Symbols =
    {
        "<<=", ">>=", "::", "+=", "-=", "*=", "/=", "==", "!=", "<=", ">=", "&&", "||", "++", "--", "->",
        "+", "-", "*", "/", "%", "=", "<", ">", "!", "(", ")", "{", "}", "[", "]", ",", ";", ".", ":", "?", "&", "|", "^", "~",
    };

    public static List<ShaderToken> Tokenize(string source)
    {
        var tokens = new List<ShaderToken>();
        int i = 0, line = 1;
        bool lineStart = true;
        while (i < source.Length)
        {
            char c = source[i];
            if (c == '\n')
            {
                line++;
                i++;
                lineStart = true;
                continue;
            }
            if (char.IsWhiteSpace(c) || c == '\0')
            {
                i++;
                continue;
            }
            if (c == '#' && lineStart)
            {
                // A preprocessor line: skip it (and its continuation lines).
                while (i < source.Length && source[i] != '\n')
                {
                    if (source[i] == '\\' && i + 1 < source.Length && source[i + 1] == '\n')
                    {
                        line++;
                        i++;
                    }
                    i++;
                }
                continue;
            }
            lineStart = false;
            if (c == '/' && i + 1 < source.Length && source[i + 1] == '/')
            {
                while (i < source.Length && source[i] != '\n') i++;
                continue;
            }
            if (c == '/' && i + 1 < source.Length && source[i + 1] == '*')
            {
                i += 2;
                while (i + 1 < source.Length && !(source[i] == '*' && source[i + 1] == '/'))
                {
                    if (source[i] == '\n') line++;
                    i++;
                }
                i += 2;
                continue;
            }
            if (char.IsDigit(c) || (c == '.' && i + 1 < source.Length && char.IsDigit(source[i + 1])))
            {
                int start = i;
                if (c == '0' && i + 1 < source.Length && (source[i + 1] is 'x' or 'X'))
                {
                    i += 2;
                    while (i < source.Length && Uri.IsHexDigit(source[i])) i++;
                    var hex = Convert.ToInt64(source[(start + 2)..i], 16).ToString(System.Globalization.CultureInfo.InvariantCulture);
                    while (i < source.Length && char.IsLetter(source[i])) i++;
                    tokens.Add(new ShaderToken(ShaderTokenKind.Number, hex, line));
                    continue;
                }
                while (i < source.Length && (char.IsDigit(source[i]) || source[i] == '.')) i++;
                if (i < source.Length && (source[i] is 'e' or 'E') && i + 1 < source.Length && (char.IsDigit(source[i + 1]) || source[i + 1] is '-' or '+'))
                {
                    i += 2;
                    while (i < source.Length && char.IsDigit(source[i])) i++;
                }
                var text = source[start..i];
                // Suffixes: 0.5f, 1u, 2.0lf, 10ull …
                while (i < source.Length && (source[i] is 'f' or 'F' or 'u' or 'U' or 'l' or 'L' or 'h' or 'H')) i++;
                tokens.Add(new ShaderToken(ShaderTokenKind.Number, text, line));
                continue;
            }
            if (char.IsLetter(c) || c == '_')
            {
                int start = i;
                while (i < source.Length && (char.IsLetterOrDigit(source[i]) || source[i] == '_')) i++;
                var word = source[start..i];
                // L"wide" and u8"utf-8" strings.
                if (i < source.Length && source[i] == '"' && word is "L" or "u8" or "u" or "U") continue;
                tokens.Add(new ShaderToken(ShaderTokenKind.Identifier, word, line));
                continue;
            }
            if (c == '"' || c == '\'')
            {
                var sb = new System.Text.StringBuilder();
                i++;
                while (i < source.Length && source[i] != c)
                {
                    if (source[i] == '\\' && i + 1 < source.Length)
                    {
                        i++;
                        sb.Append(source[i] switch { 'n' => '\n', 't' => '\t', '0' => '\0', _ => source[i] });
                    }
                    else
                    {
                        if (source[i] == '\n') line++;
                        sb.Append(source[i]);
                    }
                    i++;
                }
                i++;
                tokens.Add(new ShaderToken(ShaderTokenKind.String, sb.ToString(), line));
                continue;
            }
            var symbol = Symbols.FirstOrDefault(s => string.CompareOrdinal(source, i, s, 0, s.Length) == 0) ?? c.ToString();
            i += symbol.Length;
            tokens.Add(new ShaderToken(ShaderTokenKind.Symbol, symbol, line));
        }
        tokens.Add(new ShaderToken(ShaderTokenKind.End, "", line));
        return DropNamespaces(tokens);
    }

    /// <summary>glm::vec4 → vec4, std::sin → sin, DirectX::XMFLOAT4 → XMFLOAT4.</summary>
    private static List<ShaderToken> DropNamespaces(List<ShaderToken> tokens)
    {
        var result = new List<ShaderToken>(tokens.Count);
        for (int i = 0; i < tokens.Count; i++)
        {
            if (tokens[i].Kind == ShaderTokenKind.Identifier && i + 2 < tokens.Count && tokens[i + 1].Is("::") && tokens[i + 2].Kind == ShaderTokenKind.Identifier
                && tokens[i].Text is "glm" or "std" or "DirectX")
            {
                i++;
                continue;
            }
            result.Add(tokens[i]);
        }
        return result;
    }
}
