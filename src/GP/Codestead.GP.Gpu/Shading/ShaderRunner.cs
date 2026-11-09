using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Shading;

/// <summary>
/// Runs a parsed shader (or evaluates a C++ expression): globals, user functions, statements and the built-in
/// functions in ShaderRunner.Builtins.cs. Names it does not know are asked of <see cref="Resolve"/> (the C++ side
/// uses it for its variables), and textures are read through <see cref="Sample"/>.
/// </summary>
public sealed partial class ShaderRunner
{
    private readonly ShaderProgram program;
    private readonly List<Dictionary<string, ShaderValue>> scopes = new();
    private int steps;

    /// <summary>The shader's globals: inputs, outputs, uniforms and constants (and gl_Position …).</summary>
    public Dictionary<string, ShaderValue> Globals { get; } = new(StringComparer.Ordinal);

    /// <summary>Asked for names the shader does not declare (null: unknown name).</summary>
    public Func<string, ShaderValue?>? Resolve { get; set; }

    /// <summary>Reads a texture: (texture or sampler name, u, v) → RGBA.</summary>
    public Func<string, double, double, double[]>? Sample { get; set; }

    /// <summary>Reads a cube map: (name, direction) → RGBA, or null when the name is not a cube map.</summary>
    public Func<string, double, double, double, double[]?>? SampleCube { get; set; }

    /// <summary>Texture sizes for textureSize(): name → (width, height).</summary>
    public Func<string, (int Width, int Height)?>? TextureSize { get; set; }

    /// <summary>Geometry shaders: EmitVertex() / EndPrimitive() (GLSL), stream.Append(v) / stream.RestartStrip() (HLSL).</summary>
    public Action<string, ShaderValue?>? Emit { get; set; }

    /// <summary>The value of glfwGetTime() and friends, in seconds.</summary>
    public double Time { get; set; } = 1.0;

    /// <summary>Set when the clock was read (the result changes over time).</summary>
    public bool UsedTime { get; set; }

    /// <summary>
    /// C++ mode: a statement that fails is skipped, and a call the runner does not know goes to <see cref="Hook"/>
    /// (the API calls) and otherwise gives 0.
    /// </summary>
    public bool Lenient { get; set; }

    /// <summary>Calls the runner does not know (C++ mode): name (".Method" for methods; args[0] is then the object), arguments.</summary>
    public Func<string, IReadOnlyList<Expr>, ShaderValue?>? Hook { get; set; }

    /// <summary>Evaluates an argument inside a hook (does not restart the step count).</summary>
    public ShaderValue EvalArg(Expr e) => Eval(e);

    /// <summary>Runs C++ statements at the top level: what they declare becomes a global.</summary>
    public void RunStatements(IReadOnlyList<Stmt> body)
    {
        steps = 0;
        scopes.Add(Globals);
        try
        {
            foreach (var s in body)
            {
                try
                {
                    var flow = Exec(s);
                    if (flow.Returned) return;
                }
                catch (ShaderRuntimeException) when (Lenient)
                {
                }
            }
        }
        finally
        {
            scopes.RemoveAt(scopes.Count - 1);
        }
    }

    private const int MaxSteps = 20000;

    public ShaderRunner(ShaderProgram program)
    {
        this.program = program;
        foreach (var g in program.Globals)
        {
            if (g.Block is not null)
            {
                // Uniform blocks: fields are globals (cbuffer, GLSL block without instance) or members of the instance.
                var fields = g.Block.ToDictionary(f => f.Id, f => Default(f.Type, f.ArraySize));
                if (g.Id == "") foreach (var (k, v) in fields) Globals[k] = v;
                else Globals[g.Id] = ShaderValue.Struct(fields);
                continue;
            }
            Globals[g.Id] = g.Value is not null ? Coerce(g.Type, Eval(g.Value)) : Default(g.Type, g.ArraySize);
        }
    }

    /// <summary>A fresh runner for an expression with no shader around it (C++ values).</summary>
    public static ShaderRunner ForExpressions(Func<string, ShaderValue?> resolve, double time = 1.0) =>
        new(new ShaderProgram()) { Resolve = resolve, Time = time };

    /// <summary>A zero value of a type (struct types get their fields).</summary>
    public ShaderValue Default(string type, int arraySize = 0)
    {
        if (arraySize > 0) return ShaderValue.Array(Enumerable.Range(0, arraySize).Select(_ => Default(type)).ToArray());
        if (program.FindStruct(type) is { } s)
            return ShaderValue.Struct(s.Fields.ToDictionary(f => f.Id, f => Default(f.Type, f.ArraySize)));
        int n = ComponentCount(type);
        if (MatrixSize(type) is int m and > 0) return ShaderValue.Identity(m);
        return n > 0 ? ShaderValue.Vec(new double[n]) : ShaderValue.Str(type);
    }

    /// <summary>Calls a function of the shader with arguments; returns its return value (or null) and fills out-parameters.</summary>
    public ShaderValue? Call(string id, IReadOnlyList<ShaderValue> args)
    {
        var f = program.FindFunction(id) ?? throw new ShaderRuntimeException($"no function '{id}'", 0);
        steps = 0;
        return Invoke(f, args);
    }

    public ShaderValue Evaluate(Expr e)
    {
        steps = 0;
        return Eval(e);
    }

    private ShaderValue? Invoke(Function f, IReadOnlyList<ShaderValue> args)
    {
        var scope = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
        for (int i = 0; i < f.Params.Count; i++)
            scope[f.Params[i].Id] = i < args.Count ? Coerce(f.Params[i].Type, args[i]).Clone() : Default(f.Params[i].Type);
        scopes.Add(scope);
        try
        {
            var r = Run(f.Body);
            return r.Returned ? r.Value : null;
        }
        finally
        {
            scopes.RemoveAt(scopes.Count - 1);
        }
    }

    private readonly record struct Flow(bool Returned, ShaderValue? Value, bool Discarded = false);

    /// <summary>True when the last fragment was discarded.</summary>
    public bool Discarded { get; private set; }

    /// <summary>Forgets a discard, before the next fragment.</summary>
    public void ClearDiscard() => Discarded = false;

    private Flow Run(IReadOnlyList<Stmt> body)
    {
        scopes.Add(new Dictionary<string, ShaderValue>(StringComparer.Ordinal));
        try
        {
            foreach (var s in body)
            {
                if (++steps > MaxSteps) throw new ShaderRuntimeException("the shader runs too long for the simulator", s.Line);
                Flow flow;
                try
                {
                    flow = Exec(s);
                }
                catch (ShaderRuntimeException) when (Lenient)
                {
                    continue;
                }
                if (flow.Returned || flow.Discarded) return flow;
            }
            return default;
        }
        finally
        {
            scopes.RemoveAt(scopes.Count - 1);
        }
    }

    private Flow Exec(Stmt s)
    {
        switch (s)
        {
            case Declare d:
            {
                // C++: Type name{} / Type name = {} is a zero-initialised struct.
                if (d.Value is InitList { Items.Count: 0 }) scopes[^1][d.Id] = Default(d.Type);
                else scopes[^1][d.Id] = d.Value is null ? Default(d.Type) : Coerce(d.Type, Eval(d.Value)).Clone();
                return default;
            }
            case Assign a:
            {
                var value = Eval(a.Value);
                if (a.Op != "=") value = BinaryOp(a.Op[..1], Eval(a.Target), value, a.Line);
                Store(a.Target, value);
                return default;
            }
            case Return r:
                return new Flow(true, r.Value is null ? null : Eval(r.Value));
            case Discard:
                Discarded = true;
                return new Flow(false, null, true);
            case If i:
                return Truthy(Eval(i.Condition)) ? Run(i.Then) : i.Else is not null ? Run(i.Else) : default;
            case For f:
            {
                scopes.Add(new Dictionary<string, ShaderValue>(StringComparer.Ordinal));
                try
                {
                    if (f.Init is not null) Exec(f.Init);
                    for (int n = 0; f.Condition is null || Truthy(Eval(f.Condition)); n++)
                    {
                        if (n > 1024) throw new ShaderRuntimeException("the loop runs too long for the simulator", f.Line);
                        var flow = Run(f.Body);
                        if (flow.Returned || flow.Discarded) return flow;
                        if (f.Step is not null) Exec(f.Step);
                    }
                    return default;
                }
                finally
                {
                    scopes.RemoveAt(scopes.Count - 1);
                }
            }
            case ExprStmt e:
                Eval(e.Value);
                return default;
            default:
                return default;
        }
    }

    private static bool Truthy(ShaderValue v) => v.V is { Length: > 0 } && v.V[0] != 0;

    private ShaderValue Lookup(string id, int line)
    {
        for (int i = scopes.Count - 1; i >= 0; i--)
            if (scopes[i].TryGetValue(id, out var v)) return v;
        if (Globals.TryGetValue(id, out var g)) return g;
        if (Resolve?.Invoke(id) is { } r) return r;
        return id switch
        {
            "M_PI" or "PI" or "XM_PI" => ShaderValue.Scalar(Math.PI),
            "XM_2PI" => ShaderValue.Scalar(2 * Math.PI),
            "XM_PIDIV2" => ShaderValue.Scalar(Math.PI / 2),
            "XM_PIDIV4" => ShaderValue.Scalar(Math.PI / 4),
            _ => throw new ShaderRuntimeException($"'{id}' was not declared in this scope", line),
        };
    }

    /// <summary>Writes to a variable, a struct member, a swizzle or an array element.</summary>
    private void Store(Expr target, ShaderValue value)
    {
        switch (target)
        {
            case Name n:
            {
                for (int i = scopes.Count - 1; i >= 0; i--)
                    if (scopes[i].ContainsKey(n.Id))
                    {
                        scopes[i][n.Id] = Like(scopes[i][n.Id], value);
                        return;
                    }
                Globals[n.Id] = Globals.TryGetValue(n.Id, out var old) ? Like(old, value) : value;
                return;
            }
            case Member m:
            {
                var owner = Eval(m.Target);
                if (owner.Fields is not null)
                {
                    owner.Fields[m.Field] = owner.Fields.TryGetValue(m.Field, out var old) ? Like(old, value) : value;
                    return;
                }
                if (owner.V is not null && Swizzle(m.Field) is { } idx)
                {
                    var src = value.V ?? [0];
                    for (int k = 0; k < idx.Length; k++)
                        if (idx[k] < owner.V.Length) owner.V[idx[k]] = src[Math.Min(k, src.Length - 1)];
                    return;
                }
                throw new ShaderRuntimeException($"cannot assign to '.{m.Field}'", m.Line);
            }
            case IndexOf { Target: IndexOf inner } ix2 when Eval(inner.Target) is { IsMatrix: true } mat:
            {
                // m[col][row] = x (proj[1][1] *= -1 in vulkan-tutorial).
                int col = (int)Math.Floor(Eval(inner.At).X), row = (int)Math.Floor(Eval(ix2.At).X);
                if (col < 0 || col >= mat.Cols || row < 0 || row >= mat.Cols) throw new ShaderRuntimeException("matrix index out of range", ix2.Line);
                mat.V![col * mat.Cols + row] = value.X;
                return;
            }
            case IndexOf ix:
            {
                var owner = Eval(ix.Target);
                int at = (int)Math.Floor(Eval(ix.At).X);
                if (owner.Items is not null && at >= 0 && at < owner.Items.Length) owner.Items[at] = value;
                else if (owner.V is not null && at >= 0 && at < owner.V.Length && owner.Cols == 0) owner.V[at] = value.X;
                else if (owner.IsMatrix && at >= 0 && at < owner.Cols)
                    for (int r = 0; r < owner.Cols; r++) owner.V![at * owner.Cols + r] = value.Padded(owner.Cols)[r];
                else throw new ShaderRuntimeException("array index out of range", ix.Line);
                return;
            }
            default:
                throw new ShaderRuntimeException("cannot assign to this expression", target.Line);
        }
    }

    /// <summary>A value stored into a variable keeps the variable's number of components (vec3 v = vec4(…) is not allowed, but float → vecN broadcasts).</summary>
    private static ShaderValue Like(ShaderValue old, ShaderValue value)
    {
        if (old.V is null || value.V is null || old.IsMatrix || value.IsMatrix || old.V.Length == value.V.Length) return value;
        if (value.V.Length == 1) return ShaderValue.Vec(Enumerable.Repeat(value.V[0], old.V.Length).ToArray());
        return ShaderValue.Vec(value.Padded(old.V.Length));
    }
}
