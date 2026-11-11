using Codestead.GP.Gpu.Shading;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// Runs the functions an explicit API program calls every frame (vulkan-tutorial's updateUniformBuffer and
/// recordCommandBuffer; the D3D12 samples' OnUpdate and PopulateCommandList) and records what reaches the GPU: each
/// draw with the push constants / root constants set before it, and the uniform buffer / constant buffer structs.
/// </summary>
internal sealed class FrameRecorder
{
    /// <param name="Model">The draw is a Model::Draw (learnopengl's Model class): one draw per mesh of the model.</param>
    /// <param name="StencilRef">The stencil reference set before the draw (vkCmdSetStencilReference, OMSetStencilRef), or null.</param>
    /// <param name="Bound">What was bound before the draw: descriptor sets (vkCmdBindDescriptorSets) and descriptor tables
    /// (SetGraphicsRootDescriptorTable) as their argument text, by set number / root parameter.</param>
    public sealed record RecordedDraw(bool Indexed, int Count, int Instances, int First, Dictionary<string, ShaderValue> Constants, string? Pipeline, bool Model = false,
        int? StencilRef = null, IReadOnlyDictionary<int, string>? Bound = null, object? State = null, string? ModelName = null);

    /// <summary>The pipeline / pipeline state object bound now (vkCmdBindPipeline, SetPipelineState, Reset(…, pso)).</summary>
    private string? pipeline;
    private int? stencilRef;
    private readonly Dictionary<int, string> bound = new();

    /// <summary>The variable an argument names: graphicsPipeline, m_lightPSO.Get(), &amp;x.</summary>
    private static string? NameOf(Expr e) => e switch
    {
        Name n => n.Id,
        Member m => m.Field,
        Call { Function: ".Get", Args: [var target] } => NameOf(target),
        _ => null,
    };

    private readonly CppExec exec;
    private readonly Scene.Scene scene;
    private readonly CppSource source;
    private readonly IReadOnlyList<Global> blocks;
    private readonly bool transposeMatrices;
    private Dictionary<string, ShaderValue> constants = new(StringComparer.Ordinal);

    public List<RecordedDraw> Draws { get; } = new();

    /// <summary>The draws and device ops recorded while the program set itself up (see <see cref="Setup"/>).</summary>
    public int SetupDraws { get; private set; }
    public int SetupOps { get; private set; }

    public ShaderRunner Runner => exec.Runner;

    /// <param name="blocks">The shaders' uniform blocks / cbuffers (their fields are the names constants are set under).</param>
    /// <param name="transposeMatrices">HLSL reads a C++ (row-major) matrix transposed (column_major packing).</param>
    public FrameRecorder(CppSource src, double time, Scene.Scene scene, IReadOnlyList<Global> blocks, bool transposeMatrices, IDeviceModel? device = null)
    {
        this.blocks = blocks;
        this.scene = scene;
        this.transposeMatrices = transposeMatrices;
        source = src;
        exec = new CppExec(src, time, Hook, scene);
        // What the program prints (std::cout, std::cerr, OutputDebugStringA): the output pane.
        exec.Runner.Output = scene.Log.Add;
        this.device = device;
        if (device is not null)
        {
            device.Attach(exec);
            device.DrawCount = () => Draws.Count;
        }
    }

    private readonly IDeviceModel? device;

    public void Run(string function) => exec.RunFunction(function);

    /// <summary>
    /// Runs the program's setup (the D3D12 samples' OnInit, or LoadPipeline and LoadAssets) so the device model sees the
    /// resources, views and data it creates. What it draws into off-screen targets there stays for every frame (an
    /// environment captured into a cube map once): those draws are kept as the first <see cref="SetupDraws"/> of
    /// <see cref="Draws"/>, with the device's ops so far. Draws into the window before the first frame are dropped.
    /// </summary>
    public void Setup()
    {
        if (source.Functions.ContainsKey("OnInit")) exec.RunFunction("OnInit");
        else if (source.Functions.ContainsKey("initVulkan")) exec.RunFunction("initVulkan");
        else
            foreach (var fn in new[] { "LoadPipeline", "LoadAssets" }.Where(source.Functions.ContainsKey)) exec.RunFunction(fn);
        if (device is not null && Draws.Count > 0 && Draws.All(d => device.Offscreen(d.State)))
        {
            SetupDraws = Draws.Count;
            SetupOps = device.Ops.Count;
        }
        else
        {
            Draws.Clear();
            device?.Ops.Clear();
        }
        // The window's size is the simulated window's (the swap chain helpers may have left something else).
        foreach (var name in new[] { "swapChainExtent", "m_width", "m_height", "m_aspectRatio" }) exec.Runner.Globals.Remove(name);
    }

    private int callDepth;
    /// <summary>A recursive function goes as deep as the program's data (a scene graph's chain of entities).</summary>
    private const int MaxCallDepth = 32;
    private readonly Dictionary<string, List<Stmt>> bodies = new(StringComparer.Ordinal);
    private readonly Dictionary<string, List<(string Name, bool Ref, string? Default)>?> headers = new(StringComparer.Ordinal);

    /// <summary>
    /// A call of one of the program's own functions (LoadTexture(…), LoadCubemap(…)) while the device model runs: its
    /// body runs with the arguments; reference parameters (ComPtr&lt;…&gt;&amp; texture) are written back to the caller.
    /// </summary>
    private ShaderValue? CallProgramFunction(string name, IReadOnlyList<Expr> args)
    {
        if (name.Contains("::", StringComparison.Ordinal)) name = name[(name.LastIndexOf("::", StringComparison.Ordinal) + 2)..];
        if (device is null || callDepth > MaxCallDepth || name is "main" or "wWinMain" or "WinMain" or "OnRender" or "mainLoop" or "run" or "drawFrame" || !source.Functions.ContainsKey(name)) return null;
        name = source.ChooseOverload(name, args, exec.TryEval);
        if (!headers.TryGetValue(name, out var parameters))
            headers[name] = parameters = source.ParametersOf(name)?.Select(p => (p.Name, p.Ref, p.Default)).ToList();
        if (parameters is null) return null;
        if (EmulateLoadObj(name, parameters, args) is { } emulated) return emulated;
        if (!bodies.TryGetValue(name, out var body))
            bodies[name] = body = ShaderParser.ParseStatementsLenient(CppSource.Prepare("{" + source.ExpandedBody(name) + "}"));
        var values = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
        for (int i = 0; i < parameters.Count; i++)
        {
            // A parameter not given takes its default value (DrawSprite(…, float rotate = 0.0f, …)).
            // A struct or container by reference (addChild(Entity& parent, …)) is the caller's object itself.
            if (i < args.Count) values[parameters[i].Name] = Value(args[i]) is { } given
                ? parameters[i].Ref && given is { Fields: not null } or { Items: not null } or { Map: not null } ? given : given.Clone()
                : ShaderValue.Scalar(0);
            else if (parameters[i].Default is { } fallback && exec.Eval(fallback) is { } v) values[parameters[i].Name] = v;
        }
        callDepth++;
        try
        {
            var (result, scope) = exec.Runner.RunBody(body, values);
            for (int i = 0; i < parameters.Count && i < args.Count; i++)
                if (parameters[i].Ref && args[i] is Name or Member or IndexOf && scope.TryGetValue(parameters[i].Name, out var v))
                    exec.Runner.Assign(args[i], v);
            return result ?? ShaderValue.Scalar(0);
        }
        finally
        {
            callDepth--;
        }
    }

    /// <summary>The project, for the model files a loadModel reads (and the files std::ifstream and FreeType read).</summary>
    public GpuProject? Project
    {
        get => project;
        init
        {
            project = value;
            if (value is null) return;
            exec.Runner.ReadText = value.Find;
            exec.Runner.ReadBytes = value.FindAsset;
        }
    }

    private readonly GpuProject? project;

    /// <summary>
    /// vulkan-tutorial's loadModel (tinyobj::LoadObj and the loop over the shapes' indices): instead of running the loop,
    /// the vectors it fills get the model's vertices – as the program's Vertex structs, position, normal, texCoord with v
    /// flipped (1 - v), colour white, the material index – and its indices. The vectors are the ones the body
    /// push_backs into: the program's members (vertices, indices) or reference parameters (loadModel(path, v, i)).
    /// </summary>
    private ShaderValue? EmulateLoadObj(string name, List<(string Name, bool Ref, string? Default)> parameters, IReadOnlyList<Expr> args)
    {
        if (Project is null || source.FunctionBody(name) is not { } body || !body.Contains("LoadObj", StringComparison.Ordinal)) return null;
        var call = System.Text.RegularExpressions.Regex.Match(body, @"\bLoadObj\s*\(");
        if (!call.Success) return null;
        int close = CppSource.MatchBracket(body, call.Index + call.Length - 1);
        if (close < 0) return null;
        var loadArgs = CppSource.SplitArgs(body[(call.Index + call.Length)..close]);
        if (loadArgs.Count < 6) return null;
        var pathText = System.Text.RegularExpressions.Regex.Replace(loadArgs[5].Trim(), @"\s*\.\s*c_str\s*\(\s*\)$", "");
        int pathParam = parameters.FindIndex(p => p.Name == pathText);
        var pathValue = pathParam >= 0 && pathParam < args.Count ? Value(args[pathParam])
            : CppSource.StringArg(pathText) is { } literal ? ShaderValue.Str(literal)
            : Value(new Name(pathText, 0)) ?? source.Evaluate(pathText, exec.Runner.Time);
        var path = pathValue?.Text ?? Models.ModelFiles.Path(source);
        var model = path is null ? null : Models.ObjModel.Load(Project, path);
        if (model is null) return null;

        var pushes = System.Text.RegularExpressions.Regex.Matches(body, @"(\w+)\s*\.\s*(?:push_back|emplace_back)\s*\(\s*([^;]*)\)\s*;").Select(m => (Target: m.Groups[1].Value, Arg: m.Groups[2].Value.Trim())).ToList();
        var vertexVector = pushes.FirstOrDefault(p => p.Arg == "vertex").Target ?? "vertices";
        var indexVector = pushes.Where(p => p.Target != vertexVector).Select(p => p.Target).OrderByDescending(t => t.Contains("ind", StringComparison.OrdinalIgnoreCase)).FirstOrDefault() ?? "indices";
        // The vertex type: std::vector<Vertex> – of the parameter or of the member.
        var header = System.Text.RegularExpressions.Regex.Match(source.Code, @"(?<![\w.>])" + System.Text.RegularExpressions.Regex.Escape(name) + @"\s*\(([^()]*)\)");
        var vertexParamText = header.Success ? CppSource.SplitArgs(header.Groups[1].Value).FirstOrDefault(p => System.Text.RegularExpressions.Regex.IsMatch(p, @"\b" + vertexVector + @"\s*$")) : null;
        var vectorType = vertexParamText ?? source.DeclaredType(vertexVector) ?? "";
        var structName = System.Text.RegularExpressions.Regex.Match(vectorType, @"<\s*(\w+)\s*>").Groups[1].Value;
        if (StructLayout.Fields(source, structName) is not { } fields) return null;

        var vertices = new List<ShaderValue>();
        var indices = new List<ShaderValue>();
        foreach (var mesh in model.Meshes)
        {
            int baseVertex = vertices.Count;
            for (int i = 0; i < mesh.Positions.Count; i++)
            {
                var v = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
                foreach (var (_, field, _) in fields)
                    v[field] = field.Contains("material", StringComparison.OrdinalIgnoreCase) || field.Contains("index", StringComparison.OrdinalIgnoreCase) ? ShaderValue.Scalar(mesh.Material?.Index ?? -1)
                        : field.Contains("pos", StringComparison.OrdinalIgnoreCase) ? ShaderValue.Vec(mesh.Positions[i])
                        : field.Contains("tex", StringComparison.OrdinalIgnoreCase) || field.Contains("uv", StringComparison.OrdinalIgnoreCase) ? ShaderValue.Vec(mesh.TexCoords[i][0], 1 - mesh.TexCoords[i][1])
                        : field.Contains("normal", StringComparison.OrdinalIgnoreCase) ? ShaderValue.Vec(mesh.Normals[i])
                        : ShaderValue.Vec(1, 1, 1);
                vertices.Add(ShaderValue.Struct(v));
            }
            indices.AddRange(mesh.Indices.Select(x => ShaderValue.Scalar(x + baseVertex)));
        }
        void Fill(string vector, ShaderValue value)
        {
            int k = parameters.FindIndex(p => p.Name == vector);
            if (k >= 0 && k < args.Count) exec.Runner.Assign(args[k], value);
            else exec.Runner.Globals[vector] = value;
        }
        Fill(vertexVector, ShaderValue.Array(vertices.ToArray()));
        Fill(indexVector, ShaderValue.Array(indices.ToArray()));
        return ShaderValue.Scalar(0);
    }

    /// <summary>Functions of the program not run now (a game's drawFrame in a frame that is not shown).</summary>
    public HashSet<string> Skip { get; } = new(StringComparer.Ordinal);

    /// <summary>Called when the program polls its window's events (glfwPollEvents): the frame's key presses.</summary>
    public Action? OnPollEvents { get; set; }

    /// <summary>Runs C++ statements (text) with the program's state.</summary>
    public void RunCode(string code) => exec.Run(code);

    private ShaderValue? Hook(string name, IReadOnlyList<Expr> args)
    {
        if (Skip.Contains(name)) return ShaderValue.Scalar(0);
        if (name == "glfwPollEvents" && OnPollEvents is { } poll)
        {
            poll();
            return ShaderValue.Scalar(0);
        }
        var fromDevice = device?.Hook(name, args);
        switch (name)
        {
            case "SetWindowTextW" or "SetWindowTextA" or "SetWindowText" or "glfwSetWindowTitle" when args.Count >= 2:
                // The title the program sets while it runs (the frame's counts: "drawn: 37 / 101").
                if (Value(args[1])?.Text is { } title) scene.WindowTitle = title;
                return ShaderValue.Scalar(0);
            case "vkCmdBindPipeline" when args.Count >= 3:
                pipeline = PipelineName(args[2]);
                return ShaderValue.Scalar(0);
            case ".SetPipelineState" when args.Count >= 2:
                pipeline = PipelineName(args[1]);
                return ShaderValue.Scalar(0);
            case ".Reset" when args.Count >= 3:
                pipeline = NameOf(args[2]) ?? pipeline;
                return ShaderValue.Scalar(0);
            case "vkCmdSetStencilReference" when args.Count >= 3:
                stencilRef = Int(args[2]);
                return ShaderValue.Scalar(0);
            case ".OMSetStencilRef" when args.Count >= 2:
                stencilRef = Int(args[1]);
                return ShaderValue.Scalar(0);
            case "vkCmdBindDescriptorSets" when args.Count >= 6:
                bound[Int(args[3])] = ArgText(args[5]);
                return ShaderValue.Scalar(0);
            case ".SetGraphicsRootDescriptorTable" when args.Count >= 3:
                bound[Int(args[1])] = ArgText(args[2]);
                return ShaderValue.Scalar(0);
            case "vkCmdPushConstants" when args.Count >= 6:
                Set(Value(args[5]));
                return ShaderValue.Scalar(0);
            case ".SetGraphicsRoot32BitConstants" when args.Count >= 4:
                Set(Value(args[3]));
                return ShaderValue.Scalar(0);
            case ".SetGraphicsRoot32BitConstant" when args.Count >= 3:
                Set(Value(args[2]));
                return ShaderValue.Scalar(0);
            case "vkCmdDraw" when args.Count >= 5:
                Draws.Add(new RecordedDraw(false, Int(args[1]), Int(args[2]), Int(args[3]), new(constants), pipeline, StencilRef: stencilRef, Bound: new Dictionary<int, string>(bound), State: device?.Snapshot()));
                return ShaderValue.Scalar(0);
            case "vkCmdDrawIndexed" when args.Count >= 6:
                Draws.Add(new RecordedDraw(true, Int(args[1]), Int(args[2]), Int(args[3]), new(constants), pipeline, StencilRef: stencilRef, Bound: new Dictionary<int, string>(bound), State: device?.Snapshot()));
                return ShaderValue.Scalar(0);
            case ".Draw" when args.Count >= 1 && NameOf(args[0]) is { } target && (source.DeclaredType(target) ?? "").Contains("Model", StringComparison.Ordinal):
                Draws.Add(new RecordedDraw(true, 0, 1, 0, new(constants), pipeline, Model: true, StencilRef: stencilRef, Bound: new Dictionary<int, string>(bound), State: device?.Snapshot(), ModelName: target));
                return ShaderValue.Scalar(0);
            case ".DrawInstanced" when args.Count >= 5:
                Draws.Add(new RecordedDraw(false, Int(args[1]), Int(args[2]), Int(args[3]), new(constants), pipeline, StencilRef: stencilRef, Bound: new Dictionary<int, string>(bound), State: device?.Snapshot()));
                return ShaderValue.Scalar(0);
            case ".DrawIndexedInstanced" when args.Count >= 6:
                Draws.Add(new RecordedDraw(true, Int(args[1]), Int(args[2]), Int(args[3]), new(constants), pipeline, StencilRef: stencilRef, Bound: new Dictionary<int, string>(bound), State: device?.Snapshot()));
                return ShaderValue.Scalar(0);
        }
        if (fromDevice is not null) return fromDevice;
        if (CallProgramFunction(name, args) is { } returned) return returned;
        // Other API calls do nothing here (their arguments name API objects the runner does not have).
        return name.StartsWith("vk", StringComparison.Ordinal) || name.StartsWith("glfw", StringComparison.Ordinal) && name != "glfwGetTime"
            // Methods of API objects (m_device->CreateCommittedResource, COM's upper-case names) do nothing here; the C++
            // library's lower-case ones (insert, push_back, str, c_str …) are the runner's.
            || (name.StartsWith('.') && name.Length > 1 && char.IsUpper(name[1]) && name is not ".Get") || name is "memcpy" or "ThrowIfFailed" or "WaitForPreviousFrame"
            ? ShaderValue.Scalar(0) : null;
    }

    /// <summary>
    /// The program's variable for a pipeline argument: a helper's parameter (renderToCubemap(VkPipeline pipeline, …))
    /// is the member that holds the same handle.
    /// </summary>
    private string? PipelineName(Expr e)
    {
        var name = NameOf(e);
        if (name is null || Value(e)?.Text is not { Length: > 0 } handle || !handle.Contains(':')) return name;
        if (exec.Runner.Globals.TryGetValue(name, out var own) && own.Text == handle) return name;
        var holders = exec.Runner.Globals.Where(kv => kv.Value.Text == handle).Select(kv => kv.Key).ToList();
        return holders.Count == 1 ? holders[0] : name;
    }

    private ShaderValue? Value(Expr e)
    {
        try
        {
            return exec.Runner.EvalArg(e);
        }
        catch (ShaderRuntimeException)
        {
            return null;
        }
    }

    /// <summary>
    /// An argument as text, with indices and plain numbers worked out: &amp;descriptorSets[currentFrame] →
    /// "descriptorSets[0]", CD3DX12_GPU_DESCRIPTOR_HANDLE(heapStart, 2, size) → "CD3DX12_GPU_DESCRIPTOR_HANDLE(…, 2, …)".
    /// </summary>
    private string ArgText(Expr e)
    {
        switch (e)
        {
            case Name n:
                return n.Id;
            case Number num:
                return num.Value.ToString(System.Globalization.CultureInfo.InvariantCulture);
            case Member m:
                return ArgText(m.Target) + "." + m.Field;
            case IndexOf ix:
                return ArgText(ix.Target) + "[" + Int(ix.At) + "]";
            case Unary { Op: "&" or "*" } u:
                return ArgText(u.Operand);
            case Call c:
            {
                if (c.Function.StartsWith('.') && c.Args.Count > 0)
                    return ArgText(c.Args[0]) + c.Function + "(" + string.Join(", ", c.Args.Skip(1).Select(ArgOrNumber)) + ")";
                return c.Function + "(" + string.Join(", ", c.Args.Select(ArgOrNumber)) + ")";
            }
            default:
                return ArgOrNumber(e);
        }
    }

    private string ArgOrNumber(Expr e) =>
        e is Name or Member or Call or IndexOf ? ArgText(e)
        : Value(e) is { V: { Length: 1 } v } ? v[0].ToString(System.Globalization.CultureInfo.InvariantCulture) : "?";

    private int Int(Expr e) => Value(e) is { V: { Length: > 0 } v } ? (int)Math.Round(v[0]) : 0;

    /// <summary>Constants pushed: a struct's fields by name, or a single value for a block with one field.</summary>
    private void Set(ShaderValue? value)
    {
        if (value is null) return;
        constants = new Dictionary<string, ShaderValue>(constants, StringComparer.Ordinal);
        if (value.Fields is not null)
        {
            foreach (var (k, v) in value.Fields) constants[k] = Upload(v.Clone());
            return;
        }
        var single = blocks.FirstOrDefault(b => b.Block is { Count: 1 });
        if (single is not null) constants[single.Block![0].Id] = Upload(value.Clone());
    }

    /// <summary>The uniform buffer / constant buffer contents: the fields of the variables of the blocks' struct types.</summary>
    public Dictionary<string, ShaderValue> BufferContents()
    {
        var d = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
        foreach (var block in blocks.Where(b => !b.PushConstant))
            foreach (var g in exec.Runner.Globals.Values.Where(v => v.Fields is not null && block.Block!.All(f => v.Fields!.ContainsKey(f.Id))))
                foreach (var (k, v) in g.Fields!) d[k] = Upload(v.Clone());
        return d;
    }

    private ShaderValue Upload(ShaderValue v) =>
        transposeMatrices && v.IsMatrix ? ShaderValue.Matrix(v.Cols, Enumerable.Range(0, v.Cols * v.Cols).Select(i => v.V![(i % v.Cols) * v.Cols + i / v.Cols]).ToArray())
        // An array of matrices (float4x4 shadowMatrices[6]): each one.
        : transposeMatrices && v.Items is { Length: > 0 } items && items.Any(x => x.IsMatrix) ? ShaderValue.Array(items.Select(Upload).ToArray()) : v;
}
