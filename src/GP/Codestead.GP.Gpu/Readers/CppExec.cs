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
                return new Field(f.Type, f.Name, null, per == 1 && f.Floats > 1 ? f.Floats : 0);
            }).ToList()));
        }
        Runner = new ShaderRunner(program)
        {
            Lenient = true,
            Time = time,
            Hook = hook,
            DepthZeroToOne = src.Code.Contains("GLM_FORCE_DEPTH_ZERO_TO_ONE", StringComparison.Ordinal),
        };
        Runner.Resolve = Resolve;
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
        if (src.Evaluate(name, Runner.Time) is { } v)
        {
            if (src.UsedTime) Runner.UsedTime = true;
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

    public static void Flatten(ShaderValue v, List<double> into)
    {
        if (v.V is not null) into.AddRange(v.V);
        else if (v.Items is not null) foreach (var i in v.Items) Flatten(i, into);
        else if (v.Fields is not null) foreach (var f in v.Fields.Values) Flatten(f, into);
    }
}
