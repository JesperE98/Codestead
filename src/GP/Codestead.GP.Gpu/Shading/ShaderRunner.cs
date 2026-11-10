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

    // A block's variables live in a dictionary; a loop body runs thousands of times per pixel, so the dictionaries
    // are used again instead of made anew.
    private readonly Stack<Dictionary<string, ShaderValue>> freeScopes = new();

    private Dictionary<string, ShaderValue> RentScope() => freeScopes.Count > 0 ? freeScopes.Pop() : new Dictionary<string, ShaderValue>(StringComparer.Ordinal);

    private void PopScope()
    {
        var scope = scopes[^1];
        scopes.RemoveAt(scopes.Count - 1);
        scope.Clear();
        if (freeScopes.Count < 64) freeScopes.Push(scope);
    }

    /// <summary>The shader's globals: inputs, outputs, uniforms and constants (and gl_Position …).</summary>
    public Dictionary<string, ShaderValue> Globals { get; } = new(StringComparer.Ordinal);

    /// <summary>Asked for names the shader does not declare (null: unknown name).</summary>
    public Func<string, ShaderValue?>? Resolve { get; set; }

    /// <summary>Reads a texture: (texture or sampler name, u, v) → RGBA.</summary>
    public Func<string, double, double, double[]>? Sample { get; set; }

    /// <summary>Reads a cube map: (name, direction) → RGBA, or null when the name is not a cube map.</summary>
    public Func<string, double, double, double, double[]?>? SampleCube { get; set; }

    /// <summary>Reads a cube map at a mip level (textureLod, SampleLevel): (name, direction, lod) → RGBA, or null.</summary>
    public Func<string, double, double, double, double, double[]?>? SampleCubeLod { get; set; }

    /// <summary>
    /// The screen-space derivatives of texture coordinates (u, v) where the fragment being shaded reads them – what a
    /// GPU picks a mip level from: (du/dx, dv/dx, du/dy, dv/dy), or null when not known.
    /// </summary>
    public Func<double, double, (double, double, double, double)?>? Footprint { get; set; }

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

    /// <summary>
    /// C++ mode: runs a function body of the program with its parameters in a scope of their own, statement by
    /// statement (one that fails is skipped). Returns the return value and the parameters' values at the end (the
    /// caller writes reference parameters back).
    /// </summary>
    public (ShaderValue? Value, Dictionary<string, ShaderValue> Scope) RunBody(IReadOnlyList<Stmt> body, Dictionary<string, ShaderValue> parameters)
    {
        var scope = new Dictionary<string, ShaderValue>(parameters, StringComparer.Ordinal);
        scopes.Add(scope);
        try
        {
            foreach (var s in body)
            {
                try
                {
                    var flow = Exec(s);
                    if (flow.Returned) return (flow.Value, scope);
                }
                catch (ShaderRuntimeException) when (Lenient)
                {
                }
            }
            return (null, scope);
        }
        finally
        {
            scopes.RemoveAt(scopes.Count - 1);
        }
    }

    /// <summary>Assigns to a variable, member or element (for hooks that write through an out-parameter).</summary>
    public void Assign(Expr target, ShaderValue value) => Store(target, value);

    /// <summary>
    /// Steps per run: the C++ program's setup may loop over hundreds of objects (learnopengl's 500 asteroids), and a
    /// shader that integrates over a hemisphere takes a thousand samples per pixel (an irradiance convolution).
    /// </summary>
    private const int MaxSteps = 400000;

    private GlibcRandom? random;

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

    /// <summary>
    /// A declared variable's zero value; in C++ mode a struct the runner does not know (D3D12_RESOURCE_DESC desc = {};)
    /// is an empty struct that takes the fields assigned to it.
    /// </summary>
    private ShaderValue LenientDefault(string type, int arraySize)
    {
        if (Lenient && arraySize == 0 && EmptyStream(type) is { } stream) return stream;
        if (Lenient && arraySize > 0) return ShaderValue.Array(Enumerable.Range(0, arraySize).Select(_ => LenientDefault(type, 0)).ToArray());
        var v = Default(type, arraySize);
        return Lenient && v.Text is not null ? ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)) : v;
    }

    /// <summary>
    /// The elements of an array of a struct type, as structs: { {x, y, z}, {} } fills the fields in order and a missing
    /// or empty one is zero (C++ aggregate initialisation) – so a Vertex array keeps its layout when copied.
    /// </summary>
    /// <summary>An array value as elements of a struct type of the program (for globals read from their initializers).</summary>
    public ShaderValue AsStructArray(string type, ShaderValue value) => StructItems(type, value);

    private ShaderValue StructItems(string type, ShaderValue value)
    {
        if (program.FindStruct(type) is not { } st || value.Items is null) return value;
        return ShaderValue.Array(value.Items.Select(item => AsStruct(st, item)).ToArray());
    }

    private ShaderValue AsStruct(Struct st, ShaderValue item)
    {
        if (item.Fields is not null) return item;
        var parts = item.Items ?? (item.V is { Length: > 0 } ? item.V.Select(ShaderValue.Scalar).ToArray() : []);
        var fields = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
        for (int i = 0; i < st.Fields.Count; i++)
        {
            var f = st.Fields[i];
            var part = i < parts.Length ? parts[i] : null;
            fields[f.Id] = part is null || part.V is { Length: 0 } || part.Items is { Length: 0 } ? FieldDefault(f) : Coerce(f.Type, part);
        }
        return ShaderValue.Struct(fields);
    }

    /// <summary>A struct member's first value: its default initialiser, else its type's zero value.</summary>
    private ShaderValue FieldDefault(Field f)
    {
        if (f.Default is { } init && f.ArraySize == 0)
        {
            try
            {
                return Coerce(f.Type, Eval(init)).Clone();
            }
            catch (ShaderRuntimeException)
            {
            }
        }
        return Default(f.Type, f.ArraySize);
    }

    /// <summary>A zero value of a type (struct types get their fields).</summary>
    public ShaderValue Default(string type, int arraySize = 0)
    {
        if (type is "map" or "unordered_map") return new ShaderValue { Map = new SortedDictionary<double, ShaderValue>() };
        // C++: an empty std::vector, an empty std::string.
        if (type is "vector" && arraySize == 0) return ShaderValue.Array([]);
        if (type is "string" or "std::string" or "wstring") return ShaderValue.Str("");
        if (arraySize > 0) return ShaderValue.Array(Enumerable.Range(0, arraySize).Select(_ => Default(type)).ToArray());
        if (program.FindStruct(type) is { } s)
            return ShaderValue.Struct(s.Fields.ToDictionary(f => f.Id, FieldDefault));
        int n = ComponentCount(type);
        if (MatrixSize(type) is int m and > 0) return ShaderValue.Identity(m);
        if (n == 1 && ShaderValue.IsIntType(type)) return ShaderValue.Integer(0);
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
        var scope = RentScope();
        for (int i = 0; i < f.Params.Count; i++)
            scope[f.Params[i].Id] = i < args.Count ? Coerce(f.Params[i].Type, args[i]).Clone() : Default(f.Params[i].Type);
        scopes.Add(scope);
        try
        {
            var r = Run(f.Body);
            return r.Returned ? (r.Value is null ? null : Coerce(f.ReturnType, r.Value)) : null;
        }
        finally
        {
            PopScope();
        }
    }

    private readonly record struct Flow(bool Returned, ShaderValue? Value, bool Discarded = false, bool Broke = false, bool Continued = false)
    {
        /// <summary>The statements after this one in the block do not run.</summary>
        public bool Leaves => Returned || Discarded || Broke || Continued;
    }

    /// <summary>True when the last fragment was discarded.</summary>
    public bool Discarded { get; private set; }

    /// <summary>Forgets a discard, before the next fragment.</summary>
    public void ClearDiscard() => Discarded = false;

    private Flow Run(IReadOnlyList<Stmt> body)
    {
        scopes.Add(RentScope());
        try
        {
            for (int index = 0; index < body.Count; index++)
            {
                var s = body[index];
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
                if (flow.Leaves) return flow;
            }
            return default;
        }
        finally
        {
            PopScope();
        }
    }

    private Flow Exec(Stmt s)
    {
        switch (s)
        {
            case Declare d:
            {
                // C++: Type name{} / Type name = {} is a zero-initialised struct.
                int arraySize = d.SizeExpr is not null ? (int)Math.Max(0, Math.Min(4096, Eval(d.SizeExpr).X)) : d.ArraySize;
                if (d.SizeExpr is not null && d.Value is InitList { Items.Count: > 0 } && Eval(d.Value) is { Items: { } given } && given.Length < arraySize)
                {
                    // std::array<VkImageView, 2> attachments = { a, b }: the elements given, the rest zero.
                    scopes[^1][d.Id] = StructItems(d.Type, ShaderValue.Array(given.Concat(Enumerable.Range(0, arraySize - given.Length).Select(_ => LenientDefault(d.Type, 0))).ToArray())).Clone();
                }
                else if (d.Value is null && d.SizeExpr is not null && arraySize == 0) scopes[^1][d.Id] = ShaderValue.Array([]);
                else if (d.Value is InitList { Items.Count: 0 } || d.Value is null && d.SizeExpr is not null) scopes[^1][d.Id] = LenientDefault(d.Type, arraySize);
                else if (!d.IsArray && d.Value is InitList && program.FindStruct(d.Type) is { } initStruct && Eval(d.Value) is { } listed && (listed.Items is not null || listed.V is not null))
                    // C++ aggregate initialisation: Character ch = { texture, size, bearing, advance } – the fields in order.
                    scopes[^1][d.Id] = AsStruct(initStruct, listed).Clone();
                else scopes[^1][d.Id] = d.Value is null ? LenientDefault(d.Type, d.ArraySize) : (d.IsArray ? StructItems(d.Type, Eval(d.Value)) : Coerce(d.Type, Eval(d.Value))).Clone();
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
            case Break:
                return new Flow(false, null, Broke: true);
            case Continue:
                return new Flow(false, null, Continued: true);
            case If i:
                return Truthy(Eval(i.Condition)) ? Run(i.Then) : i.Else is not null ? Run(i.Else) : default;
            case For f:
            {
                scopes.Add(RentScope());
                try
                {
                    if (f.Init is not null) Exec(f.Init);
                    for (int n = 0; f.Condition is null || Truthy(Eval(f.Condition)); n++)
                    {
                        if (n > 1024) throw new ShaderRuntimeException("the loop runs too long for the simulator", f.Line);
                        var flow = Run(f.Body);
                        if (flow.Returned || flow.Discarded) return flow;
                        if (flow.Broke) break;
                        if (f.Step is not null) Exec(f.Step);
                    }
                    return default;
                }
                finally
                {
                    PopScope();
                }
            }
            case ExprStmt e:
                Eval(e.Value);
                return default;
            case ForEach fe:
            {
                var container = Eval(fe.Container);
                var items = container.Items ?? container.Map?.Values.ToArray() ?? (container.V?.Select(ShaderValue.Scalar).ToArray())
                    ?? container.Text?.Select(ch => ShaderValue.Integer(ch)).ToArray() ?? [];
                scopes.Add(RentScope());
                try
                {
                    foreach (var item in items.Take(4096))
                    {
                        scopes[^1][fe.Id] = item;
                        var flow = Run(fe.Body);
                        if (flow.Returned || flow.Discarded) return flow;
                        if (flow.Broke) break;
                    }
                    return default;
                }
                finally
                {
                    PopScope();
                }
            }
            default:
                return default;
        }
    }

    /// <summary>True: a non-zero number; in C++ also a handle or a set of flags (a name), but not a null handle.</summary>
    private static bool Truthy(ShaderValue v) => v.V is { Length: > 0 } ? v.V[0] != 0
        // if (fstream): a stream is true while it is good.
        : v.Fields is { } f && f.TryGetValue(StreamOk, out var ok) ? ok.X != 0
        : v.Text is { Length: > 0 } t && t is not ("VK_NULL_HANDLE" or "nullptr" or "NULL");

    private ShaderValue Lookup(string id, int line)
    {
        for (int i = scopes.Count - 1; i >= 0; i--)
            if (scopes[i].TryGetValue(id, out var v)) return v;
        if (Globals.TryGetValue(id, out var g)) return g;
        if (Resolve?.Invoke(id) is { } r) return r;
        return id switch
        {
            "M_PI" or "PI" or "XM_PI" => ShaderValue.Scalar(Math.PI),
            "cout" or "std::cout" or "cerr" or "std::cerr" when Lenient => Console,
            "endl" or "std::endl" when Lenient => ShaderValue.Str("\n"),
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
                ShaderValue owner;
                try
                {
                    owner = Eval(m.Target);
                }
                catch (ShaderRuntimeException) when (Lenient && m.Target is Member or IndexOf)
                {
                    // C++ mode: a nested struct not set yet (imageInfo.extent.width = …).
                    Store(m.Target, ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)));
                    owner = Eval(m.Target);
                }
                if (owner.Fields is not null)
                {
                    owner.Fields[m.Field] = owner.Fields.TryGetValue(m.Field, out var old) ? Like(old, value) : value;
                    return;
                }
                if (owner.V is not null && Swizzle(m.Field) is { } idx)
                {
                    var src = value.V ?? [0];
                    // A number (f.x = …) gets a new value: numbers are shared (a literal's value serves every use).
                    if (owner.V.Length == 1 && !owner.IsMatrix && idx is [0])
                    {
                        Store(m.Target, owner.Int ? ShaderValue.Integer(Math.Truncate(src[0])) : ShaderValue.Scalar(src[0]));
                        return;
                    }
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
                ShaderValue owner;
                try
                {
                    owner = Eval(ix.Target);
                }
                catch (ShaderRuntimeException) when (Lenient && ix.Target is Name)
                {
                    // C++ mode: an array member the runner has not seen (ComPtr<ID3D12Resource> m_renderTargets[FrameCount];).
                    owner = ShaderValue.Array([]);
                    Globals[((Name)ix.Target).Id] = owner;
                }
                // The subscript is evaluated once (translations[index++] = …).
                var atValue = Eval(ix.At);
                if (Lenient && owner.Items is not null && ix.Target is Name grow && atValue.X >= owner.Items.Length && atValue.X < 4096)
                {
                    var items = owner.Items.Concat(Enumerable.Range(0, (int)atValue.X + 1 - owner.Items.Length).Select(_ => ShaderValue.Scalar(0))).ToArray();
                    owner = ShaderValue.Array(items);
                    Store(grow, owner);
                }
                if (owner.Map is not null)
                {
                    owner.Map[ShaderValue.MapKey(atValue)] = value.Clone();
                    return;
                }
                int at = (int)Math.Floor(atValue.X);
                if (owner.Items is not null && at >= 0 && at < owner.Items.Length) owner.Items[at] = value.Int && !owner.Items[at].Int ? ShaderValue.Scalar(value.X) : value;
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
        // A float variable given an integer holds a float (x = 1; x / 2 is 0.5).
        if (value.Int && old.V is { Length: 1 } && !old.Int) return ShaderValue.Scalar(value.X);
        if (old.V is null || value.V is null || old.IsMatrix || value.IsMatrix || old.V.Length == value.V.Length) return value;
        if (value.V.Length == 1) return ShaderValue.Vec(Enumerable.Repeat(value.V[0], old.V.Length).ToArray());
        return ShaderValue.Vec(value.Padded(old.V.Length));
    }
}
