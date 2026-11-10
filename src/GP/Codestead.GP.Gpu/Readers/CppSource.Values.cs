using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

// Values of C++ expressions: constants, float variables, arrays and initializer lists, evaluated with the shader
// expression engine (C++ arithmetic on floats looks the same). A clock (glfwGetTime, std::chrono) is the time.
public sealed partial class CppSource
{
    private readonly HashSet<string> resolving = new(StringComparer.Ordinal);
    private Dictionary<string, string>? defines;

    /// <summary>Set when an evaluated value depended on the time (the preview then animates).</summary>
    public bool UsedTime { get; private set; }

    /// <summary>Other names to know (e.g. a struct variable filled in elsewhere).</summary>
    public Func<string, ShaderValue?>? Extra { get; set; }

    private static readonly Regex ChronoRe = new(@"(?:std::)?chrono::duration\s*<[^;]*?>\s*\([^;]*?\)\s*\.\s*count\s*\(\s*\)", RegexOptions.CultureInvariant);
    private static readonly Regex TickRe = new(@"\bGetTickCount(?:64)?\s*\(\s*\)", RegexOptions.CultureInvariant);

    /// <summary>C++ → the shader expression language: clocks become glfwGetTime(), casts and suffixes go.</summary>
    internal static string Prepare(string expr)
    {
        expr = ChronoRe.Replace(expr, "glfwGetTime()");
        expr = TickRe.Replace(expr, "(glfwGetTime() * 1000.0)");
        return expr;
    }

    /// <summary>Evaluates an expression at a time; null when it cannot be (unknown names, unsupported syntax).</summary>
    public ShaderValue? Evaluate(string expr, double time = 1.0)
    {
        if (string.IsNullOrWhiteSpace(expr)) return null;
        var prepared = Prepare(expr);
        if (prepared.Contains("glfwGetTime", StringComparison.Ordinal)) UsedTime = true;
        try
        {
            var runner = ShaderRunner.ForExpressions(name => Resolve(name, time), time);
            return runner.Evaluate(ShaderParser.ParseExpression(prepared));
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

    /// <summary>The numbers of an expression or initializer list, flattened ({ {0.5f, 1}, {2} } → 0.5, 1, 2).</summary>
    public List<double>? Numbers(string expr, double time = 1.0)
    {
        var v = Evaluate(expr, time);
        if (v is null) return null;
        var list = new List<double>();
        Flatten(v, list);
        return list;
    }

    private static void Flatten(ShaderValue v, List<double> into)
    {
        if (v.V is not null) into.AddRange(v.V);
        else if (v.Items is not null) foreach (var i in v.Items) Flatten(i, into);
        else if (v.Fields is not null) foreach (var f in v.Fields.Values) Flatten(f, into);
    }

    private static readonly Regex DefineRe = new(@"^[ \t]*#[ \t]*define[ \t]+(\w+)[ \t]+(.+)$", RegexOptions.Multiline | RegexOptions.CultureInvariant);

    /// <summary>The value of a name in this file: a #define, a constant or variable with an initializer, or an API constant.</summary>
    private ShaderValue? Resolve(string name, double time)
    {
        if (Extra?.Invoke(name) is { } extra) return extra;
        if (KnownConstant(name) is { } k) return ShaderValue.Scalar(k);
        if (!resolving.Add(name)) return null;
        try
        {
            defines ??= DefineRe.Matches(Code).GroupBy(m => m.Groups[1].Value).ToDictionary(g => g.Key, g => g.First().Groups[2].Value.Trim(), StringComparer.Ordinal);
            if (defines.TryGetValue(name, out var defined)) return EvaluateOrNull(defined, time);
            var init = Initializer(name);
            if (init is not null) return EvaluateOrNull(init, time);
            // An API constant (VK_SAMPLE_COUNT_1_BIT as a member's initializer): its name.
            return Regex.IsMatch(name, @"^(?:D3D12|DXGI|D3D|VK)_[A-Z0-9_]+$") ? ShaderValue.Str(name) : null;
        }
        finally
        {
            resolving.Remove(name);
        }
    }

    private ShaderValue? EvaluateOrNull(string expr, double time)
    {
        var prepared = Prepare(expr);
        if (prepared.Contains("glfwGetTime", StringComparison.Ordinal)) UsedTime = true;
        try
        {
            var runner = ShaderRunner.ForExpressions(n => Resolve(n, time), time);
            return runner.Evaluate(ShaderParser.ParseExpression(prepared));
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

    /// <summary>A few API constants whose numeric value matters (TRUE/FALSE, GL_TRUE …).</summary>
    private static double? KnownConstant(string name) => name switch
    {
        "TRUE" or "GL_TRUE" or "VK_TRUE" or "GLFW_TRUE" => 1,
        "FALSE" or "GL_FALSE" or "VK_FALSE" or "GLFW_FALSE" or "NULL" or "nullptr" => 0,
        // glibc's rand() range (the simulator's rand() is glibc's).
        "RAND_MAX" => 2147483647,
        _ => null,
    };

    /// <summary>An integer argument (a draw count …), or null.</summary>
    public int? Int(string expr, double time = 1.0) => Evaluate(expr, time) is { V: { Length: > 0 } v } ? (int)Math.Round(v[0]) : null;
}
