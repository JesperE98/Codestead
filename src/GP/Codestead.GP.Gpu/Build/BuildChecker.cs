using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Readers;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Build;

/// <summary>
/// The compile step of "Build &amp; run": the mistakes a compiler would stop at. Brackets that do not match, API
/// names that do not exist (with "did you mean"), and shaders that do not parse or lack their #version line.
/// </summary>
public static class BuildChecker
{
    private static readonly Dictionary<string, Regex> ApiNames = new()
    {
        [Apis.OpenGL] = new(@"(?<![\w.>])(gl[A-Z]\w*|GL_[A-Z0-9_]+|glfw[A-Z]\w*|GLFW_[A-Z0-9_]+)\b", RegexOptions.CultureInvariant),
        [Apis.Vulkan] = new(@"(?<![\w.>])(vk[A-Z]\w*|Vk[A-Z]\w*|VK_[A-Z0-9_]+|glfw[A-Z]\w*|GLFW_[A-Z0-9_]+)\b", RegexOptions.CultureInvariant),
        [Apis.D3D12] = new(@"(?<![\w.>])(D3D12[A-Z]\w*|ID3D12\w+|IDXGI\w+|DXGI_[A-Z0-9_]+|D3D_[A-Z0-9_]+|D3D12_[A-Z0-9_]+|CD3DX12_\w+|D3DCompile\w*|D3DCOMPILE_\w+|XM[A-Z]\w*|CreateDXGIFactory\w*)\b", RegexOptions.CultureInvariant),
    };

    private static readonly Regex ArrowCall = new(@"->\s*([A-Za-z_]\w*)\s*\(", RegexOptions.CultureInvariant);

    public static List<Diagnostic> Check(GpuProject project, string api)
    {
        var list = new List<Diagnostic>();
        foreach (var (file, text) in project.Files)
        {
            var ext = Path.GetExtension(file).ToLowerInvariant();
            if (ext is ".cpp" or ".h" or ".hpp" or ".c") Cpp(file, text, api, list);
            else if (ext is ".vs" or ".fs" or ".vert" or ".frag" or ".glsl" or ".geom" or ".gs") Glsl(file, text, api, list);
            else if (ext is ".hlsl") Hlsl(file, text, list);
        }
        return list;
    }

    private static void Cpp(string file, string text, string api, List<Diagnostic> list)
    {
        var src = new CppSource(file, text);
        if (Brackets(file, src.Code, list)) return;
        // Names the file defines itself (#define, functions, variables) are not API names.
        var own = new HashSet<string>(Regex.Matches(src.Code, @"#\s*define\s+(\w+)|\b(\w+)\s*\(").Select(m => m.Groups[1].Success ? m.Groups[1].Value : m.Groups[2].Value)
            .Where(n => Regex.IsMatch(src.Code, @"(?:#\s*define\s+|\b(?:void|bool|int|float|auto|static|HRESULT|VkResult|uint32_t|std::\w+(?:<[^>]*>)?|[A-Z]\w*)[\s*&]+)" + Regex.Escape(n) + @"\b")), StringComparer.Ordinal);
        if (ApiNames.TryGetValue(api, out var re))
        {
            var known = ApiSymbols.For(api);
            var reported = new HashSet<string>(StringComparer.Ordinal);
            foreach (Match m in re.Matches(StripStrings(src.Code)))
            {
                var name = m.Groups[1].Value;
                if (known.Contains(name) || own.Contains(name) || IsDeclared(src.Code, name) || !reported.Add(name)) continue;
                var suggestion = ApiSymbols.Suggest(name, known);
                list.Add(new Diagnostic(file, src.LineAt(m.Index), true,
                    $"'{name}' was not declared in this scope" + (suggestion is null ? "" : $"; did you mean '{suggestion}'?")));
            }
        }
        if (api == Apis.D3D12)
        {
            var methods = ApiSymbols.For("d3d12-methods");
            // A program that loads models with Assimp (aiMesh, aiMaterial …) calls its methods after -> too.
            if (src.Code.Contains("assimp/", StringComparison.Ordinal)) methods = [.. methods, .. ApiSymbols.For("assimp-methods")];
            var reported = new HashSet<string>(StringComparer.Ordinal);
            foreach (Match m in ArrowCall.Matches(src.Code))
            {
                var name = m.Groups[1].Value;
                if (methods.Contains(name) || own.Contains(name) || src.Functions.ContainsKey(name) || !reported.Add(name)) continue;
                var suggestion = ApiSymbols.Suggest(name, methods);
                list.Add(new Diagnostic(file, src.LineAt(m.Index), true,
                    $"no member named '{name}'" + (suggestion is null ? "" : $"; did you mean '{suggestion}'?")));
            }
        }
    }

    /// <summary>Is a name declared in the file as a variable or parameter (uint32_t glfwExtensionCount = 0;)?</summary>
    private static bool IsDeclared(string code, string name) =>
        Regex.Matches(code, @"(?:\b(?<type>[A-Za-z_][\w:]*(?:<[^;(){}]*>)?)\s*[*&]*\s+|[*&]\s*)" + Regex.Escape(name) + @"\s*(?:=|;|\[|\{|,|\)|:)")
            .Any(m => m.Groups["type"].Value is not ("return" or "else" or "case" or "new" or "delete" or "throw" or "sizeof"));

    /// <summary>String literals blanked (a window title is not an API name).</summary>
    private static string StripStrings(string code) => Regex.Replace(code, "\"(?:[^\"\\\\\\n]|\\\\.)*\"", m => new string(' ', m.Length));

    /// <summary>Reports the first bracket that does not match; true when one was found.</summary>
    private static bool Brackets(string file, string code, List<Diagnostic> list)
    {
        var stack = new Stack<(char Ch, int At)>();
        for (int i = 0; i < code.Length; i++)
        {
            char c = code[i];
            if (c == '"' || c == '\'')
            {
                int j = i + 1;
                while (j < code.Length && code[j] != c && code[j] != '\n')
                {
                    if (code[j] == '\\') j++;
                    j++;
                }
                i = j;
                continue;
            }
            if (c is '(' or '{' or '[') stack.Push((c, i));
            else if (c is ')' or '}' or ']')
            {
                char open = c == ')' ? '(' : c == '}' ? '{' : '[';
                if (stack.Count == 0 || stack.Peek().Ch != open)
                {
                    list.Add(new Diagnostic(file, LineAt(code, i), true, stack.Count == 0
                        ? $"expected declaration before '{c}' token"
                        : $"expected '{Close(stack.Peek().Ch)}' before '{c}' token"));
                    return true;
                }
                stack.Pop();
            }
        }
        if (stack.Count > 0)
        {
            var (ch, at) = stack.Peek();
            list.Add(new Diagnostic(file, LineAt(code, at), true, $"'{ch}' is never closed: expected '{Close(ch)}' at end of input"));
            return true;
        }
        return false;
    }

    private static char Close(char open) => open == '(' ? ')' : open == '{' ? '}' : ']';

    private static int LineAt(string s, int offset)
    {
        int line = 1;
        for (int i = 0; i < offset && i < s.Length; i++)
            if (s[i] == '\n') line++;
        return line;
    }

    private static void Glsl(string file, string text, string api, List<Diagnostic> list)
    {
        var code = CppSource.BlankComments(text.Replace("\r\n", "\n"));
        var first = code.Split('\n').Select((l, i) => (l.Trim(), i + 1)).FirstOrDefault(x => x.Item1.Length > 0);
        if (!first.Item1.StartsWith("#version", StringComparison.Ordinal))
        {
            list.Add(new Diagnostic(file, first.Item2 == 0 ? 1 : first.Item2, true, "the shader must start with a #version line (" + (api == Apis.Vulkan ? "#version 450" : "#version 330 core") + ")"));
            return;
        }
        if (Brackets(file, code, list)) return;
        Parse(file, text, list);
    }

    private static void Hlsl(string file, string text, List<Diagnostic> list)
    {
        if (Brackets(file, CppSource.BlankComments(text.Replace("\r\n", "\n")), list)) return;
        Parse(file, text, list);
    }

    private static void Parse(string file, string text, List<Diagnostic> list)
    {
        try
        {
            ShaderParser.ParseProgram(text);
        }
        catch (ShaderSyntaxException e)
        {
            list.Add(new Diagnostic(file, e.Line, true, e.Message));
        }
    }
}
