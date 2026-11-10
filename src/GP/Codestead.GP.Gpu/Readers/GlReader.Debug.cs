using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Shading;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Readers;

// learnopengl's "Debugging": glGetError's error flag, the debug output of a debug context (glDebugMessageCallback)
// with Mesa's wording of each message, the queries a program asks in its own code (glGetShaderiv, glGetIntegerv …),
// and function-like macros (#define glCheckError() glCheckError_(__FILE__, __LINE__)).
public sealed partial class GlReader
{
    /// <summary>The error flag glGetError returns (and clears): only the first error is kept until then.</summary>
    private int errorFlag;
    private bool debugContext, debugOutput;
    private string? debugCallback;

    private const int GlInvalidEnum = 0x0500, GlInvalidOperation = 0x0502;

    /// <summary>
    /// A call failed: the error flag is set (when none is), and the debug output (a debug context with GL_DEBUG_OUTPUT
    /// on and a callback) calls the program's callback right away with the driver's message – as Mesa words it.
    /// </summary>
    private void GlError(int code, string message)
    {
        if (errorFlag == 0) errorFlag = code;
        if (!debugOutput || !debugContext || debugCallback is null) return;
        var text = message.Replace("\\", "\\\\").Replace("\"", "\\\"");
        // GL_DEBUG_SOURCE_API, GL_DEBUG_TYPE_ERROR, id 1, GL_DEBUG_SEVERITY_HIGH.
        env.Run($"{debugCallback}(0x8246, 0x824C, 1, 0x9146, {message.Length}, \"{text}\", nullptr);");
    }

    /// <summary>State a debugging program sets (the debug context, the debug output, the callback); false: go on.</summary>
    private bool DebugCall(string name, IReadOnlyList<string> a)
    {
        string A(int i) => i < a.Count ? a[i].Trim() : "";
        switch (name)
        {
            case "glfwWindowHint" when A(0) == "GLFW_OPENGL_DEBUG_CONTEXT":
                debugContext = A(1) is "true" or "GL_TRUE" or "GLFW_TRUE" or "1";
                return true;
            case "glEnable" or "glDisable" when A(0) == "GL_DEBUG_OUTPUT":
                debugOutput = name == "glEnable";
                return true;
            case "glDebugMessageCallback":
                debugCallback = Regex.Match(A(0), @"^\(?\s*(?:GLDEBUGPROC\s*\)\s*)?&?\s*(\w+)\s*\)?$") is { Success: true } fn && src.Functions.ContainsKey(fn.Groups[1].Value) ? fn.Groups[1].Value : null;
                return true;
            case "glDebugMessageControl" or "glObjectLabel":
                return true;
        }
        return false;
    }

    /// <summary>The answers of the API queries the program's own code evaluates (null: not one of them).</summary>
    private ShaderValue? ApiValue(string name, IReadOnlyList<Expr> args)
    {
        void Out(int index, ShaderValue value)
        {
            if (index >= args.Count) return;
            try
            {
                env.Runner.Assign(args[index], value);
            }
            catch (ShaderRuntimeException)
            {
            }
        }
        switch (name)
        {
            case "glGetError":
            {
                int code = errorFlag;
                errorFlag = 0;
                return ShaderValue.Integer(code);
            }
            case "glCheckFramebufferStatus":
                // The simulated framebuffers are complete.
                return ShaderValue.Str("GL_FRAMEBUFFER_COMPLETE");
            case "glGetShaderiv" or "glGetProgramiv":
                // Compile and link status: the simulator reports a failed shader itself (in the output, as the driver's
                // log would) – the program's own check sees success.
                Out(2, ShaderValue.Integer(1));
                return ShaderValue.Integer(0);
            case "glGetIntegerv" when args.Count >= 2 && args[0] is Name { Id: "GL_CONTEXT_FLAGS" }:
                // GL_CONTEXT_FLAG_DEBUG_BIT in a debug context (4.3: debug output is core).
                Out(1, ShaderValue.Integer(debugContext ? 0x2 : 0));
                return ShaderValue.Integer(0);
        }
        return null;
    }

    /// <summary>
    /// A statement with the program's function-like macros expanded (glCheckError() → glCheckError_(__FILE__,
    /// __LINE__)), __FILE__ as the main file's name and __LINE__ as the statement's line.
    /// </summary>
    private string ExpandMacros(string text, int line) => src.ExpandMacros(text, line, Path.GetFileName(project.MainFile));
}
