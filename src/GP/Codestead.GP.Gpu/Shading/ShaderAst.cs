namespace Codestead.GP.Gpu.Shading;

/// <summary>The syntax tree of the shader subset the simulator runs (and of C++ value expressions).</summary>
public static class ShaderAst
{
    public abstract record Expr(int Line);

    /// <summary>A literal; <see cref="Integer"/> for one written without a fraction, exponent or float suffix (2, 16u, 0x55).</summary>
    public sealed record Number(double Value, int Line, bool Integer = false) : Expr(Line)
    {
        /// <summary>The literal as a value of a running shader (made the first time it is evaluated).</summary>
        internal ShaderValue? Cached;
    }

    public sealed record Name(string Id, int Line) : Expr(Line);

    /// <summary>a.b – a struct member or a swizzle (.xyz, .rgb).</summary>
    public sealed record Member(Expr Target, string Field, int Line) : Expr(Line);

    public sealed record IndexOf(Expr Target, Expr At, int Line) : Expr(Line);

    /// <summary>f(args) – a function, a constructor (vec4, float3) or an array constructor (vec2[]).</summary>
    public sealed record Call(string Function, IReadOnlyList<Expr> Args, int Line, bool ArrayConstructor = false) : Expr(Line);

    public sealed record Unary(string Op, Expr Operand, int Line) : Expr(Line);

    public sealed record Binary(string Op, Expr Left, Expr Right, int Line) : Expr(Line);

    public sealed record Conditional(Expr Condition, Expr Then, Expr Else, int Line) : Expr(Line);

    /// <summary>{ a, b, c } – an initializer list (C++ and HLSL).</summary>
    public sealed record InitList(IReadOnlyList<Expr> Items, int Line) : Expr(Line);

    public abstract record Stmt(int Line);

    /// <summary>T name[N] = value; (Value may be null.)</summary>
    public sealed record Declare(string Type, string Id, Expr? Value, int Line, bool IsArray = false, int ArraySize = 0, Expr? SizeExpr = null) : Stmt(Line)
    {
        /// <summary>C++: a static local – initialised once, it keeps its value between calls.</summary>
        public bool Static { get; init; }
    }

    /// <summary>target op value; with op "=", "+=", "-=", "*=" or "/=".</summary>
    public sealed record Assign(Expr Target, string Op, Expr Value, int Line) : Stmt(Line);

    public sealed record Return(Expr? Value, int Line) : Stmt(Line);

    public sealed record If(Expr Condition, IReadOnlyList<Stmt> Then, IReadOnlyList<Stmt>? Else, int Line) : Stmt(Line);

    /// <summary>for (init; condition; step) body – only loops with a small, known number of steps run.</summary>
    public sealed record For(Stmt? Init, Expr? Condition, Stmt? Step, IReadOnlyList<Stmt> Body, int Line) : Stmt(Line);

    public sealed record Discard(int Line) : Stmt(Line);

    /// <summary>break; – leaves the innermost loop.</summary>
    public sealed record Break(int Line) : Stmt(Line);

    /// <summary>continue; – the innermost loop's next iteration.</summary>
    public sealed record Continue(int Line) : Stmt(Line);

    /// <summary>C++: for (const T&amp; name : container) body.</summary>
    public sealed record ForEach(string Id, Expr Container, IReadOnlyList<Stmt> Body, int Line) : Stmt(Line);

    /// <summary>An expression used as a statement (a call, i++).</summary>
    public sealed record ExprStmt(Expr Value, int Line) : Stmt(Line);

    /// <summary>A function parameter: type, name, qualifiers (in/out), HLSL semantic (POSITION, SV_TARGET …).</summary>
    public sealed record Param(string Type, string Id, string? Semantic, bool Out);

    public sealed record Function(string ReturnType, string Id, IReadOnlyList<Param> Params, string? Semantic, IReadOnlyList<Stmt> Body, int Line);

    /// <summary>A struct member (HLSL members can have a semantic).</summary>
    public sealed record Field(string Type, string Id, string? Semantic, int ArraySize)
    {
        /// <summary>C++: the member's default initialiser (unsigned int Width = SCREEN_WIDTH;), or null.</summary>
        public Expr? Default { get; init; }
    }

    public sealed record Struct(string Id, IReadOnlyList<Field> Fields);

    /// <summary>
    /// A global: "in"/"out"/"uniform"/"const"/plain, with GLSL layout(location = n) / layout(push_constant) /
    /// layout(binding = n), or an HLSL cbuffer/Texture2D/SamplerState with register(..).
    /// A uniform or cbuffer block has <see cref="Block"/> fields; <see cref="Id"/> is then the instance name
    /// (or empty: the fields are globals).
    /// </summary>
    /// <summary>
    /// <see cref="Binding"/>: GLSL layout(binding = n), or the number of an HLSL register (t0 → 0, s1 → 1, b0 → 0).
    /// </summary>
    public sealed record Global(string Storage, string Type, string Id, int? Location, bool PushConstant, IReadOnlyList<Field>? Block, Expr? Value, int ArraySize, int Line, int? Binding = null);
}
