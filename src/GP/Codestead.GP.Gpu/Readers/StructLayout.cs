using System.Text.RegularExpressions;

namespace Codestead.GP.Gpu.Readers;

/// <summary>The fields of a C++ struct in order, with their number of floats (glm::vec3 → 3, XMFLOAT4 → 4, float → 1).</summary>
internal static class StructLayout
{
    public static List<(string Type, string Name, int Floats)>? Fields(CppSource src, string structName)
    {
        var m = Regex.Match(src.Code, @"\bstruct\s+" + Regex.Escape(structName) + @"\s*\{", RegexOptions.CultureInvariant);
        if (!m.Success) return null;
        int open = m.Index + m.Length - 1;
        int close = CppSource.MatchBracket(src.Code, open);
        if (close < 0) return null;
        var body = src.Code[(open + 1)..close];
        // Drop member functions (static VkVertexInputBindingDescription getBindingDescription() { … }).
        body = RemoveBlocks(body);
        var fields = new List<(string, string, int)>();
        foreach (Match f in Regex.Matches(body, @"(?:^|;)\s*(?<type>(?:glm::|DirectX::)?[A-Za-z_]\w*)\s+(?<names>[A-Za-z_]\w*(?:\s*\[\s*\d+\s*\])?(?:\s*,\s*[A-Za-z_]\w*)*)\s*(?=;)", RegexOptions.CultureInvariant))
        {
            var type = f.Groups["type"].Value.Replace("glm::", "").Replace("DirectX::", "");
            if (type is "static" or "return" or "using" or "friend") continue;
            foreach (var raw in f.Groups["names"].Value.Split(','))
            {
                var nm = Regex.Match(raw.Trim(), @"^(\w+)(?:\s*\[\s*(\d+)\s*\])?$");
                if (!nm.Success) continue;
                int count = nm.Groups[2].Success ? int.Parse(nm.Groups[2].Value) : 1;
                fields.Add((type, nm.Groups[1].Value, FloatsOf(type) * count));
            }
        }
        return fields;
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
        // "static X f(...)" leftovers before a body: drop declarations with parentheses.
        return Regex.Replace(sb.ToString(), @"[^;]*\([^;]*\)\s*(?:const\s*)?;", ";");
    }

    public static int FloatsOf(string type) => type switch
    {
        "vec2" or "XMFLOAT2" or "float2" or "ivec2" or "uvec2" => 2,
        "vec3" or "XMFLOAT3" or "float3" or "ivec3" or "uvec3" => 3,
        "vec4" or "XMFLOAT4" or "float4" or "ivec4" or "uvec4" => 4,
        "mat4" or "XMFLOAT4X4" or "XMMATRIX" => 16,
        "mat3" or "XMFLOAT3X3" => 9,
        _ => 1,
    };
}
