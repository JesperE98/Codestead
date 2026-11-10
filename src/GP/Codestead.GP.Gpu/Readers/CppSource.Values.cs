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

    private Dictionary<string, long>? enumerators;
    private static readonly Regex EnumRe = new(@"\benum\s+(?:class\s+|struct\s+)?(?:\w+\s*)?(?::\s*[\w\s]+)?\{([^{}]*)\}", RegexOptions.CultureInvariant);

    /// <summary>The program's enum constants (enum GameState { GAME_ACTIVE, GAME_MENU, GAME_WIN }): 0, 1, 2 … or as given.</summary>
    private Dictionary<string, long> Enumerators()
    {
        if (enumerators is not null) return enumerators;
        var result = new Dictionary<string, long>(StringComparer.Ordinal);
        foreach (Match m in EnumRe.Matches(Code))
        {
            long next = 0;
            foreach (var item in SplitArgs(m.Groups[1].Value))
            {
                var e = Regex.Match(item.Trim(), @"^(\w+)\s*(?:=\s*(.+))?$", RegexOptions.Singleline);
                if (!e.Success) continue;
                if (e.Groups[2].Success)
                {
                    var text = e.Groups[2].Value.Trim();
                    if (long.TryParse(text, out var literal)) next = literal;
                    else if (text.StartsWith("0x", StringComparison.OrdinalIgnoreCase) && long.TryParse(text[2..], System.Globalization.NumberStyles.HexNumber, null, out var hex)) next = hex;
                    else if (result.TryGetValue(text, out var other)) next = other;
                }
                result[e.Groups[1].Value] = next++;
            }
        }
        return enumerators = result;
    }

    private static readonly Regex DefineRe = new(@"^[ \t]*#[ \t]*define[ \t]+(\w+)[ \t]+(.+)$", RegexOptions.Multiline | RegexOptions.CultureInvariant);

    /// <summary>The value of a name in this file: a #define, a constant or variable with an initializer, or an API constant.</summary>
    private ShaderValue? Resolve(string name, double time)
    {
        if (Extra?.Invoke(name) is { } extra) return extra;
        if (KnownConstant(name) is { } k) return ShaderValue.Scalar(k);
        if (Enumerators().TryGetValue(name, out var enumerator)) return ShaderValue.Integer(enumerator);
        if (!resolving.Add(name)) return null;
        try
        {
            defines ??= DefineRe.Matches(Code).GroupBy(m => m.Groups[1].Value).ToDictionary(g => g.Key, g => g.First().Groups[2].Value.Trim(), StringComparer.Ordinal);
            if (defines.TryGetValue(name, out var defined)) return EvaluateOrNull(defined, time);
            var init = Initializer(name);
            if (init is not null)
            {
                // A number has its variable's type: float fov = 45 divides as a float, int rows = 7 as an integer.
                var value = EvaluateOrNull(init, time);
                if (value is { V.Length: 1, IsMatrix: false })
                {
                    var type = (DeclaredType(name) ?? "").Replace("const", "").Replace("static", "").Replace("constexpr", "").Replace("unsigned", "").Trim();
                    bool isInt = type == "" ? DeclaredType(name)?.Contains("unsigned", StringComparison.Ordinal) == true : ShaderValue.IsIntType(type);
                    if (isInt != value.Int) return isInt ? ShaderValue.Integer(Math.Truncate(value.X)) : ShaderValue.Scalar(value.X);
                }
                return value;
            }
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
        // VK_EXT_debug_utils' severity and type bits (vulkan-tutorial's debugCallback compares the severity).
        "VK_DEBUG_UTILS_MESSAGE_SEVERITY_VERBOSE_BIT_EXT" => 0x1,
        "VK_DEBUG_UTILS_MESSAGE_SEVERITY_INFO_BIT_EXT" => 0x10,
        "VK_DEBUG_UTILS_MESSAGE_SEVERITY_WARNING_BIT_EXT" => 0x100,
        "VK_DEBUG_UTILS_MESSAGE_SEVERITY_ERROR_BIT_EXT" => 0x1000,
        "VK_DEBUG_UTILS_MESSAGE_TYPE_GENERAL_BIT_EXT" => 0x1,
        "VK_DEBUG_UTILS_MESSAGE_TYPE_VALIDATION_BIT_EXT" => 0x2,
        "VK_DEBUG_UTILS_MESSAGE_TYPE_PERFORMANCE_BIT_EXT" => 0x4,
        // OpenGL's error codes and the debug output's enums (learnopengl's glCheckError_ and glDebugOutput switch on them).
        "GL_NO_ERROR" => 0,
        "GL_INVALID_ENUM" => 0x0500,
        "GL_INVALID_VALUE" => 0x0501,
        "GL_INVALID_OPERATION" => 0x0502,
        "GL_STACK_OVERFLOW" => 0x0503,
        "GL_STACK_UNDERFLOW" => 0x0504,
        "GL_OUT_OF_MEMORY" => 0x0505,
        "GL_INVALID_FRAMEBUFFER_OPERATION" => 0x0506,
        "GL_CONTEXT_FLAG_DEBUG_BIT" => 0x2,
        "GL_DEBUG_SOURCE_API" => 0x8246,
        "GL_DEBUG_SOURCE_WINDOW_SYSTEM" => 0x8247,
        "GL_DEBUG_SOURCE_SHADER_COMPILER" => 0x8248,
        "GL_DEBUG_SOURCE_THIRD_PARTY" => 0x8249,
        "GL_DEBUG_SOURCE_APPLICATION" => 0x824A,
        "GL_DEBUG_SOURCE_OTHER" => 0x824B,
        "GL_DEBUG_TYPE_ERROR" => 0x824C,
        "GL_DEBUG_TYPE_DEPRECATED_BEHAVIOR" => 0x824D,
        "GL_DEBUG_TYPE_UNDEFINED_BEHAVIOR" => 0x824E,
        "GL_DEBUG_TYPE_PORTABILITY" => 0x824F,
        "GL_DEBUG_TYPE_PERFORMANCE" => 0x8250,
        "GL_DEBUG_TYPE_OTHER" => 0x8251,
        "GL_DEBUG_TYPE_MARKER" => 0x8268,
        "GL_DEBUG_TYPE_PUSH_GROUP" => 0x8269,
        "GL_DEBUG_TYPE_POP_GROUP" => 0x826A,
        "GL_DEBUG_SEVERITY_HIGH" => 0x9146,
        "GL_DEBUG_SEVERITY_MEDIUM" => 0x9147,
        "GL_DEBUG_SEVERITY_LOW" => 0x9148,
        "GL_DEBUG_SEVERITY_NOTIFICATION" => 0x826B,
        // GLFW's key codes and actions (input: no key is down unless the simulator presses one).
        "GLFW_RELEASE" => 0,
        "GLFW_PRESS" => 1,
        "GLFW_REPEAT" => 2,
        "GLFW_KEY_SPACE" => 32,
        "GLFW_KEY_ESCAPE" => 256,
        "GLFW_KEY_ENTER" => 257,
        "GLFW_KEY_RIGHT" => 262,
        "GLFW_KEY_LEFT" => 263,
        "GLFW_KEY_DOWN" => 264,
        "GLFW_KEY_UP" => 265,
        "GLFW_KEY_LEFT_SHIFT" => 340,
        "VK_SPACE" => 0x20,
        "VK_ESCAPE" => 0x1B,
        "VK_RETURN" => 0x0D,
        "VK_LEFT" => 0x25,
        "VK_UP" => 0x26,
        "VK_RIGHT" => 0x27,
        "VK_DOWN" => 0x28,
        // GLFW_KEY_A … GLFW_KEY_Z, GLFW_KEY_0 … GLFW_KEY_9: the character's code.
        _ when name.Length == 10 && name.StartsWith("GLFW_KEY_", StringComparison.Ordinal) && (char.IsAsciiLetterUpper(name[9]) || char.IsAsciiDigit(name[9])) => name[9],
        _ => null,
    };

    /// <summary>An integer argument (a draw count …), or null.</summary>
    public int? Int(string expr, double time = 1.0) => Evaluate(expr, time) is { V: { Length: > 0 } v } ? (int)Math.Round(v[0]) : null;
}
