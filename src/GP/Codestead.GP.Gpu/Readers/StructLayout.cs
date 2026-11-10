using System.Text.RegularExpressions;

namespace Codestead.GP.Gpu.Readers;

/// <summary>The fields of a C++ struct in order, with their number of floats (glm::vec3 → 3, XMFLOAT4 → 4, float → 1).</summary>
internal static class StructLayout
{
    /// <summary>struct Name { or struct Name : Base { (and : public Base): the base's name in group 1.</summary>
    private static Regex Header(string structName) =>
        new(@"\bstruct\s+" + Regex.Escape(structName) + @"\s*(?::\s*(?:public\s+)?(\w+)\s*)?\{", RegexOptions.CultureInvariant);

    public static List<(string Type, string Name, int Floats)>? Fields(CppSource src, string structName, int depth = 0)
    {
        var m = Header(structName).Match(src.Code);
        if (!m.Success) return null;
        int open = m.Index + m.Length - 1;
        int close = CppSource.MatchBracket(src.Code, open);
        if (close < 0) return null;
        var body = src.Code[(open + 1)..close];
        var fields = new List<(string, string, int)>();
        // A derived struct (struct BallObject : GameObject): the base's members first, as C++ lays them out.
        if (m.Groups[1].Success && depth < 8 && Fields(src, m.Groups[1].Value, depth + 1) is { } inherited) fields.AddRange(inherited);
        foreach (var (type, name, count, _) in Members(src, body)) fields.Add((type, name, FloatsOf(type) * count));
        return fields;
    }

    /// <summary>
    /// The default member initialisers of a struct (unsigned int Width = SCREEN_WIDTH; GameState State = GAME_ACTIVE;):
    /// member name → the initialiser's text.
    /// </summary>
    public static Dictionary<string, string> Defaults(CppSource src, string structName, int depth = 0)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        var m = Header(structName).Match(src.Code);
        if (!m.Success) return result;
        if (m.Groups[1].Success && depth < 8)
            foreach (var (k, v) in Defaults(src, m.Groups[1].Value, depth + 1)) result[k] = v;
        int open = m.Index + m.Length - 1;
        int close = CppSource.MatchBracket(src.Code, open);
        if (close < 0) return result;
        foreach (var (_, name, _, init) in Members(src, src.Code[(open + 1)..close]))
            if (init is not null) result[name] = init;
        return result;
    }

    /// <summary>The data members of a struct body: type, name, array size, default initialiser (or null).</summary>
    private static IEnumerable<(string Type, string Name, int Count, string? Default)> Members(CppSource src, string body)
    {
        // Member functions go ({ … } blocks; an initialiser "= {}" keeps its braces' place as "{}").
        body = Regex.Replace(body, @"=\s*\{\s*\}", "= {}");
        var flat = RemoveBlocks(body.Replace("= {}", "= \u0001"));
        // Types of one word (vec3, float), with a namespace (glm::vec2), unsigned int, std::string and templates
        // (std::vector<GameObject>: the game's members).
        foreach (Match f in Regex.Matches(flat, @"(?:^|;)\s*(?:const\s+)?(?<type>(?:unsigned\s+|signed\s+)?(?:glm::|DirectX::|std::)?[A-Za-z_]\w*(?:\s*<[^;{}()]*>)?)\s+(?<names>[A-Za-z_][^;{}]*?)\s*(?=;)", RegexOptions.CultureInvariant))
        {
            var type = f.Groups["type"].Value.Replace("glm::", "").Replace("DirectX::", "");
            if (type is "static" or "return" or "using" or "friend" or "typedef") continue;
            // unsigned int → uint (an integer); std::vector<T> → vector, std::string → string, std::map<…> → map.
            type = Regex.Replace(type, @"^unsigned\s+(?:int|long|short)?$", "uint");
            type = Regex.Replace(type, @"^signed\s+(int|long|short)$", "int");
            if (Regex.IsMatch(type, @"^(?:std::)?vector\s*<")) type = "vector";
            else if (Regex.IsMatch(type, @"^(?:std::)?(?:map|unordered_map)\s*<")) type = "map";
            else if (type is "std::string" or "string") type = "string";
            else if (type.StartsWith("std::", StringComparison.Ordinal)) type = type[5..];
            foreach (var raw in CppSource.SplitArgs(f.Groups["names"].Value))
            {
                var nm = Regex.Match(raw.Trim(), @"^(\w+)(?:\s*\[\s*(\w+)\s*\])?\s*(?:=\s*(.+))?$", RegexOptions.Singleline);
                if (!nm.Success) continue;
                // The size: a number or a constant (Light lights[NR_LIGHTS]; with const unsigned int NR_LIGHTS = 32;).
                int count = !nm.Groups[2].Success ? 1 : int.TryParse(nm.Groups[2].Value, out var literal) ? literal : src.Int(nm.Groups[2].Value) ?? 1;
                var init = nm.Groups[3].Success ? nm.Groups[3].Value.Trim() : null;
                yield return (type, nm.Groups[1].Value, count, init == "\u0001" ? "{}" : init);
            }
        }
    }

    private static string RemoveBlocks(string body)
    {
        var sb = new System.Text.StringBuilder();
        int depth = 0;
        foreach (char c in body)
        {
            if (c == '{') depth++;
            if (depth == 0) sb.Append(c);
            if (c == '}')
            {
                depth--;
                if (depth == 0) sb.Append(';');
            }
        }
        // "static X f(...)" leftovers before a body: drop function declarations (a parenthesis before any "=";
        // a member's initialiser glm::vec2 Position = glm::vec2(0.0f) stays).
        return Regex.Replace(sb.ToString(), @"(?<=^|;)[^;=]*\([^;]*\)\s*(?:const\s*)?;", ";");
    }

    public static int FloatsOf(string type) => type switch
    {
        "vec2" or "XMFLOAT2" or "float2" or "ivec2" or "uvec2" => 2,
        "vec3" or "XMFLOAT3" or "float3" or "ivec3" or "uvec3" => 3,
        "vec4" or "XMFLOAT4" or "float4" or "ivec4" or "uvec4" => 4,
        "mat4" or "XMFLOAT4X4" or "XMMATRIX" or "float4x4" => 16,
        "mat3" or "XMFLOAT3X3" or "float3x3" => 9,
        _ => 1,
    };
}
