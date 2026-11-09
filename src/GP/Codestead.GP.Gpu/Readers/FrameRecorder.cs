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
        int? StencilRef = null, IReadOnlyDictionary<int, string>? Bound = null);

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
    private readonly CppSource source;
    private readonly IReadOnlyList<Global> blocks;
    private readonly bool transposeMatrices;
    private Dictionary<string, ShaderValue> constants = new(StringComparer.Ordinal);

    public List<RecordedDraw> Draws { get; } = new();

    public ShaderRunner Runner => exec.Runner;

    /// <param name="blocks">The shaders' uniform blocks / cbuffers (their fields are the names constants are set under).</param>
    /// <param name="transposeMatrices">HLSL reads a C++ (row-major) matrix transposed (column_major packing).</param>
    public FrameRecorder(CppSource src, double time, Scene.Scene scene, IReadOnlyList<Global> blocks, bool transposeMatrices)
    {
        this.blocks = blocks;
        this.transposeMatrices = transposeMatrices;
        source = src;
        exec = new CppExec(src, time, Hook, scene);
    }

    public void Run(string function) => exec.RunFunction(function);

    private ShaderValue? Hook(string name, IReadOnlyList<Expr> args)
    {
        switch (name)
        {
            case "vkCmdBindPipeline" when args.Count >= 3:
                pipeline = NameOf(args[2]);
                return ShaderValue.Scalar(0);
            case ".SetPipelineState" when args.Count >= 2:
                pipeline = NameOf(args[1]);
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
                Draws.Add(new RecordedDraw(false, Int(args[1]), Int(args[2]), Int(args[3]), new(constants), pipeline, StencilRef: stencilRef, Bound: new Dictionary<int, string>(bound)));
                return ShaderValue.Scalar(0);
            case "vkCmdDrawIndexed" when args.Count >= 6:
                Draws.Add(new RecordedDraw(true, Int(args[1]), Int(args[2]), Int(args[3]), new(constants), pipeline, StencilRef: stencilRef, Bound: new Dictionary<int, string>(bound)));
                return ShaderValue.Scalar(0);
            case ".Draw" when args.Count >= 1 && NameOf(args[0]) is { } target && (source.DeclaredType(target) ?? "").Contains("Model", StringComparison.Ordinal):
                Draws.Add(new RecordedDraw(true, 0, 1, 0, new(constants), pipeline, Model: true, StencilRef: stencilRef, Bound: new Dictionary<int, string>(bound)));
                return ShaderValue.Scalar(0);
            case ".DrawInstanced" when args.Count >= 5:
                Draws.Add(new RecordedDraw(false, Int(args[1]), Int(args[2]), Int(args[3]), new(constants), pipeline, StencilRef: stencilRef, Bound: new Dictionary<int, string>(bound)));
                return ShaderValue.Scalar(0);
            case ".DrawIndexedInstanced" when args.Count >= 6:
                Draws.Add(new RecordedDraw(true, Int(args[1]), Int(args[2]), Int(args[3]), new(constants), pipeline, StencilRef: stencilRef, Bound: new Dictionary<int, string>(bound)));
                return ShaderValue.Scalar(0);
        }
        // Other API calls do nothing here (their arguments name API objects the runner does not have).
        return name.StartsWith("vk", StringComparison.Ordinal) || name.StartsWith("glfw", StringComparison.Ordinal) && name != "glfwGetTime"
            || (name.StartsWith('.') && name != ".size" && name != ".data") || name is "memcpy" or "ThrowIfFailed" or "WaitForPreviousFrame"
            ? ShaderValue.Scalar(0) : null;
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
        transposeMatrices && v.IsMatrix ? ShaderValue.Matrix(v.Cols, Enumerable.Range(0, v.Cols * v.Cols).Select(i => v.V![(i % v.Cols) * v.Cols + i / v.Cols]).ToArray()) : v;
}
