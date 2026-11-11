using Codestead.GP.Gpu.Shading;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Readers;

// Compute: CreateComputePipelineState, unordered access views, the compute root parameters (descriptor tables, 32-bit
// constants) and Dispatch – run when it is recorded, writing the textures its UAVs name (the frame's draws then
// sample what it wrote).
internal sealed partial class D3D12Device
{
    /// <summary>Compute PSOs: handle → the compute shader's file and entry point.</summary>
    private readonly Dictionary<string, (string File, string Entry)> computePsos = new(StringComparer.Ordinal);
    /// <summary>UAVs by descriptor handle: the resource.</summary>
    private readonly Dictionary<long, int> uavs = new();
    private readonly SortedDictionary<int, long> computeTables = new();
    private readonly SortedDictionary<int, ShaderValue> computeConstants = new();
    private readonly Dictionary<string, ShaderProgram?> computePrograms = new(StringComparer.Ordinal);

    private ShaderValue? ComputeCall(string name, IReadOnlyList<Expr> args)
    {
        switch (name)
        {
            case ".CreateComputePipelineState" when args.Count >= 3:
            {
                if (Eval(Strip(args[1])) is not { Fields: not null } desc || OutTarget(args[2]) is not { } target) return null;
                var handle = "cpso#" + (computePsos.Count + 1);
                if (Blob(desc.Fields.GetValueOrDefault("CS")?.Text) is { } blob) computePsos[handle] = (blob.File, blob.Entry);
                Set(target, ShaderValue.Str(handle));
                return ShaderValue.Str("S_OK");
            }
            case ".CreateUnorderedAccessView" when args.Count >= 5:
                if (ResourceOf(args[1]) is { } viewed) uavs[(long)Num(args[4])] = viewed.Id;
                return ShaderValue.Scalar(0);
            case ".SetComputeRootDescriptorTable" when args.Count >= 3:
                computeTables[(int)Num(args[1])] = (long)Num(args[2]);
                return ShaderValue.Scalar(0);
            case ".SetComputeRoot32BitConstants" when args.Count >= 4:
                if (Eval(Strip(args[3]))?.Clone() is { } constants) computeConstants[(int)Num(args[1])] = constants;
                return ShaderValue.Scalar(0);
            case ".SetComputeRoot32BitConstant" when args.Count >= 3:
                if (Eval(args[2]) is { } constant) computeConstants[(int)Num(args[1])] = constant;
                return ShaderValue.Scalar(0);
            case ".SetComputeRootSignature" or ".SetComputeRootConstantBufferView" or ".SetComputeRootShaderResourceView" or ".SetComputeRootUnorderedAccessView":
                return ShaderValue.Scalar(0);
            case ".Dispatch" when args.Count >= 4:
                Dispatch((int)Num(args[1]), (int)Num(args[2]), (int)Num(args[3]));
                return ShaderValue.Scalar(0);
        }
        return null;
    }

    private void Dispatch(int x, int y, int z)
    {
        if (boundPso is null || !computePsos.TryGetValue(boundPso, out var cs)) return;
        if (!computePrograms.TryGetValue(cs.File, out var program))
        {
            program = null;
            if (project.Find(cs.File) is { } text)
            {
                try
                {
                    program = ShaderParser.ParseProgram(text);
                }
                catch (ShaderSyntaxException)
                {
                }
            }
            computePrograms[cs.File] = program;
        }
        if (program is null) return;
        // The root constants: the struct's fields by name, and the cbuffers' fields in order.
        var uniforms = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
        var numbers = new List<double>();
        foreach (var value in computeConstants.Values)
        {
            if (value.Fields is { } fields) foreach (var (k, v) in fields) uniforms[k] = v;
            CppExec.Flatten(value, numbers);
        }
        int at = 0;
        foreach (var field in program.Globals.Where(g => g.Block is not null).SelectMany(g => g.Block!))
        {
            int n = Math.Max(1, ShaderRunner.ComponentCount(field.Type));
            if (at + n > numbers.Count) break;
            uniforms.TryAdd(field.Id, n == 1 ? ShaderValue.Scalar(numbers[at]) : ShaderValue.Vec(numbers.Skip(at).Take(n).ToArray()));
            at += n;
        }
        // The read-write textures: register uN through the first compute descriptor table that has a UAV there.
        var images = new Dictionary<string, Raster.StorageImage>(StringComparer.Ordinal);
        var written = new List<(Resource Resource, Raster.StorageImage Storage)>();
        foreach (var g in program.Globals.Where(g => g.Type.StartsWith("RWTexture", StringComparison.Ordinal)))
        {
            int register = g.Binding ?? 0;
            var resourceId = computeTables.Values.Select(start => uavs.TryGetValue(start + register, out var id) ? id : 0).FirstOrDefault(id => id > 0);
            if (ResourceAt(resourceId) is not { } res) continue;
            var storage = Raster.StorageImage.From(res.Images.FirstOrDefault(), res.Width, Math.Max(1, res.Height));
            images[g.Id] = storage;
            written.Add((res, storage));
        }
        var errors = Raster.Rasterizer.Dispatch(program, cs.Entry, true, uniforms, images, (x, y, z), exec!.Runner.Time);
        foreach (var e in errors) exec.Runner.Output?.Invoke("compute shader: " + e);
        foreach (var (res, storage) in written)
        {
            if (res.Images.Count == 0) res.Images.Add(null);
            res.Images[0] = storage.ToImage();
            res.Float = true;
        }
    }
}
