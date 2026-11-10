using Codestead.GP.Gpu.Shading;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// Runs the learner's C++ the way the program would, for the values the GPU gets: locals, structs (UBO and
/// constant buffer structs), GLM / DirectXMath maths, loops and ifs, at a point in time. What it does not
/// understand is skipped; API calls go to a hook (the readers record draws, push constants and root constants there).
/// </summary>
public sealed class CppExec
{
    private readonly CppSource src;
    private readonly Scene.Scene? scene;

    public ShaderRunner Runner { get; }

    public CppExec(CppSource src, double time, Func<string, IReadOnlyList<Expr>, ShaderValue?>? hook = null, Scene.Scene? scene = null)
    {
        this.src = src;
        this.scene = scene;
        var program = new ShaderProgram();
        foreach (System.Text.RegularExpressions.Match m in System.Text.RegularExpressions.Regex.Matches(src.Code, @"\bstruct\s+(\w+)\s*\{"))
        {
            var fields = StructLayout.Fields(src, m.Groups[1].Value);
            if (fields is null) continue;
            program.Structs.Add(new Struct(m.Groups[1].Value, fields.Select(f =>
            {
                int per = StructLayout.FloatsOf(f.Type);
                return new Field(f.Type, f.Name, null, f.Floats > per ? f.Floats / per : 0);
            }).ToList()));
        }
        Runner = new ShaderRunner(program)
        {
            Lenient = true,
            Time = time,
            // Without a hook of its own (the OpenGL reader), the program's helpers that make no API calls run here.
            Hook = hook ?? HelperFunction,
            DepthZeroToOne = src.Code.Contains("GLM_FORCE_DEPTH_ZERO_TO_ONE", StringComparison.Ordinal),
        };
        Runner.Resolve = Resolve;
    }

    private int helperDepth;
    private readonly Dictionary<string, (List<(string Name, bool Ref)> Params, List<Stmt> Body)?> helpers = new(StringComparer.Ordinal);

    /// <summary>
    /// A call of one of the program's own functions that makes no graphics API calls (learnopengl's ourLerp in the SSAO
    /// kernel): its body runs with the arguments, reference parameters written back. Functions with gl* calls are left to
    /// the OpenGL reader, which follows them itself.
    /// </summary>
    private ShaderValue? HelperFunction(string name, IReadOnlyList<Expr> args)
    {
        if (helperDepth > 6 || name is "main" || name.StartsWith('.') || !src.Functions.ContainsKey(name)) return null;
        if (!helpers.TryGetValue(name, out var helper))
        {
            var body = src.FunctionBody(name) ?? "";
            var header = System.Text.RegularExpressions.Regex.Match(src.Code, @"(?<![\w.>])" + System.Text.RegularExpressions.Regex.Escape(name) + @"\s*\(([^()]*)\)\s*(?:const\s*)?\{");
            helper = !header.Success || System.Text.RegularExpressions.Regex.IsMatch(body, @"\b(?:gl[A-Z]\w*|glfw\w+|vk[A-Z]\w*)\s*\(") ? null
                : (CppSource.SplitArgs(header.Groups[1].Value).Where(p => p.Trim() is not ("" or "void"))
                    .Select(p => (System.Text.RegularExpressions.Regex.Match(p, @"(\w+)\s*(?:\[\s*\])?\s*(?:=[^,]*)?$").Groups[1].Value, p.Contains('&') && !p.Contains("&&"))).ToList(),
                   ShaderParser.ParseStatementsLenient(CppSource.Prepare("{" + body + "}")));
            helpers[name] = helper;
        }
        if (helper is not { } h) return null;
        var values = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
        for (int i = 0; i < h.Params.Count && i < args.Count; i++)
            values[h.Params[i].Name] = Runner.EvalArg(args[i]).Clone();
        helperDepth++;
        try
        {
            var (result, scope) = Runner.RunBody(h.Body, values);
            for (int i = 0; i < h.Params.Count && i < args.Count; i++)
                if (h.Params[i].Ref && args[i] is Name or Member or IndexOf && scope.TryGetValue(h.Params[i].Name, out var v)) Runner.Assign(args[i], v);
            return result ?? ShaderValue.Scalar(0);
        }
        catch (ShaderRuntimeException)
        {
            return null;
        }
        finally
        {
            helperDepth--;
        }
    }

    /// <summary>The window's size, for the names the tutorials use for it (swapChainExtent, m_width, m_aspectRatio …).</summary>
    private (int W, int H) Size => scene is { } s ? (s.Width, s.Height) : (800, 600);

    private ShaderValue? Resolve(string name)
    {
        switch (name)
        {
            case "swapChainExtent":
                return ShaderValue.Struct(new() { ["width"] = ShaderValue.Scalar(Size.W), ["height"] = ShaderValue.Scalar(Size.H) });
            case "m_aspectRatio":
                return ShaderValue.Scalar(Size.W / (double)Size.H);
            case "m_width":
                return ShaderValue.Scalar(Size.W);
            case "m_height":
                return ShaderValue.Scalar(Size.H);
        }
        // A member of a struct type the runner does not know (D3D12_VERTEX_BUFFER_VIEW m_vertexBufferViews[2] = {};):
        // empty structs that keep the fields the program sets.
        if (src.DeclaredType(name) is { } declared && Runner.Default(declared.Replace("glm::", "").Replace("DirectX::", "")).Text is not null
            && declared is not ("float" or "double" or "int" or "UINT" or "bool" or "auto") && !declared.StartsWith("std::", StringComparison.Ordinal)
            && System.Text.RegularExpressions.Regex.IsMatch(src.Code, @"\b" + System.Text.RegularExpressions.Regex.Escape(declared) + @"\s+" + System.Text.RegularExpressions.Regex.Escape(name) + @"\s*(?:\[[^\]]*\]\s*)?(?:=\s*\{\s*\}\s*)?;"))
        {
            var size = System.Text.RegularExpressions.Regex.Match(src.Code, @"\b" + System.Text.RegularExpressions.Regex.Escape(name) + @"\s*\[\s*([^\]]+)\]");
            ShaderValue empty() => ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal));
            var made = size.Success && (src.Int(size.Groups[1].Value) ?? 0) is int n and > 0 and < 4096
                ? ShaderValue.Array(Enumerable.Range(0, n).Select(_ => empty()).ToArray())
                : empty();
            Runner.Globals[name] = made;
            return made;
        }
        if (src.Evaluate(name, Runner.Time) is { } v)
        {
            // An array of the program's structs (const std::vector<Vertex> vertices = { … }): its elements as structs.
            if (v.Items is not null && src.DeclaredType(name) is { } arrayType
                && System.Text.RegularExpressions.Regex.Match(arrayType, @"^(?:const)?(?:std::)?(?:vector|array)<(\w+)") is { Success: true } elem)
                v = Runner.AsStructArray(elem.Groups[1].Value, v);
            else if (v.Items is not null && src.DeclaredType(name) is { } plainType && System.Text.RegularExpressions.Regex.IsMatch(src.Code, @"\b" + System.Text.RegularExpressions.Regex.Escape(plainType) + @"\s+" + System.Text.RegularExpressions.Regex.Escape(name) + @"\s*\["))
                v = Runner.AsStructArray(plainType, v);
            if (src.UsedTime) Runner.UsedTime = true;
            // A global of the program: kept, so assignments to it (lightPos.x = …) last.
            if (v.Text is null) Runner.Globals[name] = v;
            return v;
        }
        // A member or global of a struct type with no initializer: zero-initialised, kept between statements.
        if (src.DeclaredType(name) is { } type)
        {
            var t = type.Replace("glm::", "").Replace("DirectX::", "");
            var value = Runner.Default(t);
            if (value.Fields is not null || value.V is not null)
            {
                Runner.Globals[name] = value;
                return value;
            }
        }
        // An API constant (DXGI_FORMAT_R8G8B8A8_UNORM, D3D12_SRV_DIMENSION_TEXTURECUBE): its name, so descriptions keep it.
        if (System.Text.RegularExpressions.Regex.IsMatch(name, @"^(?:D3D12|DXGI|D3D|VK|GL)_[A-Z0-9_]+$")) return ShaderValue.Str(name);
        return null;
    }

    /// <summary>Runs C++ statements (text).</summary>
    public void Run(string code) => Runner.RunStatements(ShaderParser.ParseStatementsLenient(CppSource.Prepare(code)));

    /// <summary>Runs a function's body (by name), if the file defines it.</summary>
    public bool RunFunction(string name)
    {
        if (src.FunctionBody(name) is not { } body) return false;
        Run(body);
        return true;
    }

    /// <summary>The value of an expression now, or null.</summary>
    public ShaderValue? Eval(string expr)
    {
        if (string.IsNullOrWhiteSpace(expr)) return null;
        try
        {
            return Runner.Evaluate(ShaderParser.ParseExpression(CppSource.Prepare(expr)));
        }
        catch (ShaderSyntaxException)
        {
            return null;
        }
        catch (ShaderRuntimeException)
        {
            return null;
        }
    }

    public int? Int(string expr) => Eval(expr) is { V: { Length: > 0 } v } ? (int)Math.Round(v[0]) : null;

    /// <summary>All numbers of a value, flattened.</summary>
    public List<double>? Numbers(string expr)
    {
        var v = Eval(expr);
        if (v is null) return null;
        var list = new List<double>();
        Flatten(v, list);
        return list;
    }

    /// <summary>
    /// The numbers of a value in memory order. rowMajor: matrices row by row, as DirectXMath stores XMFLOAT4X4 /
    /// XMMATRIX (GLM stores them column by column, the runner's own order).
    /// </summary>
    public static void Flatten(ShaderValue v, List<double> into, bool rowMajor = false)
    {
        if (v.V is not null && rowMajor && v.IsMatrix)
            for (int r = 0; r < v.Cols; r++)
                for (int c = 0; c < v.Cols; c++) into.Add(v.V[c * v.Cols + r]);
        else if (v.V is not null) into.AddRange(v.V);
        else if (v.Items is not null) foreach (var i in v.Items) Flatten(i, into, rowMajor);
        else if (v.Fields is not null) foreach (var f in v.Fields.Values) Flatten(f, into, rowMajor);
    }
}
