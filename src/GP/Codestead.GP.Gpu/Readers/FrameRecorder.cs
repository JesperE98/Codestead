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
    public sealed record RecordedDraw(bool Indexed, int Count, int Instances, int First, Dictionary<string, ShaderValue> Constants);

    private readonly CppExec exec;
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
        exec = new CppExec(src, time, Hook, scene);
    }

    public void Run(string function) => exec.RunFunction(function);

    private ShaderValue? Hook(string name, IReadOnlyList<Expr> args)
    {
        switch (name)
        {
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
                Draws.Add(new RecordedDraw(false, Int(args[1]), Int(args[2]), Int(args[3]), new(constants)));
                return ShaderValue.Scalar(0);
            case "vkCmdDrawIndexed" when args.Count >= 6:
                Draws.Add(new RecordedDraw(true, Int(args[1]), Int(args[2]), Int(args[3]), new(constants)));
                return ShaderValue.Scalar(0);
            case ".DrawInstanced" when args.Count >= 5:
                Draws.Add(new RecordedDraw(false, Int(args[1]), Int(args[2]), Int(args[3]), new(constants)));
                return ShaderValue.Scalar(0);
            case ".DrawIndexedInstanced" when args.Count >= 6:
                Draws.Add(new RecordedDraw(true, Int(args[1]), Int(args[2]), Int(args[3]), new(constants)));
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
