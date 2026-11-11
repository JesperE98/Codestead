using Codestead.GP.Gpu.Shading;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Readers;

// Compute: vkCreateComputePipelines, the compute bind point's pipeline and descriptor sets, push constants for the
// compute stage, and vkCmdDispatch – run when it is recorded, writing the storage images its descriptor set names (the
// frame's draws then sample what it wrote).
internal sealed partial class VulkanDevice
{
    /// <summary>Compute pipelines: handle → the SPIR-V file of their shader.</summary>
    private readonly Dictionary<string, string> computePipelines = new(StringComparer.Ordinal);
    private string? boundCompute;
    private readonly Dictionary<int, string> computeSets = new();
    private ShaderValue? computeConstants;
    private readonly Dictionary<string, ShaderProgram?> computePrograms = new(StringComparer.Ordinal);

    private static bool IsComputeBindPoint(ShaderValue? v) => (v?.Text ?? "").Contains("COMPUTE", StringComparison.Ordinal);

    private ShaderValue? ComputeCall(string name, IReadOnlyList<Expr> args)
    {
        switch (name)
        {
            case "vkCreateComputePipelines" when args.Count >= 6:
            {
                var handles = new List<ShaderValue>();
                foreach (var info in Items(Eval(Strip(args[3]))).Take((int)Math.Max(1, Num(args[2]))))
                {
                    var handle = New("pipe");
                    handles.Add(ShaderValue.Str(handle));
                    if (Text(Field(info, "stage"), "module") is { } module && moduleFiles.TryGetValue(module, out var file)) computePipelines[handle] = file;
                }
                if (handles.Count == 1) Set(args[5], handles[0]);
                else if (handles.Count > 1) Set(args[5], ShaderValue.Array(handles.ToArray()));
                return ShaderValue.Str("VK_SUCCESS");
            }
            case "vkCmdBindPipeline" when args.Count >= 3 && IsComputeBindPoint(Eval(args[1])):
                boundCompute = Handle(args[2]);
                return ShaderValue.Scalar(0);
            case "vkCmdBindDescriptorSets" when args.Count >= 6 && IsComputeBindPoint(Eval(args[1])):
            {
                int first = (int)Num(args[3]);
                var bound = Items(Eval(Strip(args[5])));
                for (int i = 0; i < bound.Length && i < Math.Max(1, (int)Num(args[4])); i++)
                    if (bound[i].Text is { } s) computeSets[first + i] = s;
                return ShaderValue.Scalar(0);
            }
            case "vkCmdPushConstants" when args.Count >= 6 && (Eval(args[2])?.Text ?? "").Contains("COMPUTE", StringComparison.Ordinal):
                computeConstants = Eval(Strip(args[5]))?.Clone();
                return ShaderValue.Scalar(0);
            case "vkCmdDispatch" when args.Count >= 4:
                Dispatch((int)Num(args[1]), (int)Num(args[2]), (int)Num(args[3]));
                return ShaderValue.Scalar(0);
        }
        return null;
    }

    private ShaderProgram? ComputeProgram(string spv)
    {
        if (computePrograms.TryGetValue(spv, out var known)) return known;
        var source = spv.EndsWith(".spv", StringComparison.Ordinal) ? spv[..^4] : spv;
        ShaderProgram? program = null;
        if (project.Find(source) is { } text)
        {
            try
            {
                program = ShaderParser.ParseProgram(text);
            }
            catch (ShaderSyntaxException)
            {
            }
        }
        return computePrograms[spv] = program;
    }

    private void Dispatch(int x, int y, int z)
    {
        if (boundCompute is null || !computePipelines.TryGetValue(boundCompute, out var file) || ComputeProgram(file) is not { } program) return;
        // The push constants: the struct's fields by name (and, for a block whose names differ, by order).
        var uniforms = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
        if (computeConstants?.Fields is { } fields)
        {
            foreach (var (k, v) in fields) uniforms[k] = v;
            var block = program.Globals.FirstOrDefault(g => g.PushConstant && g.Block is not null);
            if (block is not null)
                foreach (var (field, value) in block.Block!.Zip(fields.Values))
                    uniforms.TryAdd(field.Id, value);
        }
        // The storage images: binding b of the bound set 0 (or the set the layout names).
        var images = new Dictionary<string, Raster.StorageImage>(StringComparer.Ordinal);
        var written = new List<(ImageObject Image, Raster.StorageImage Storage)>();
        foreach (var g in program.Globals.Where(g => g.Storage == "uniform" && g.Type.StartsWith("image", StringComparison.Ordinal)))
        {
            if (!computeSets.TryGetValue(0, out var set) || !sets.TryGetValue(set, out var bindings) || !bindings.TryGetValue(g.Binding ?? 0, out var b)
                || b.View is null || !views.TryGetValue(b.View, out var view) || ImageOf(view.Image) is not { } img) continue;
            var storage = Raster.StorageImage.From(img.LayerImages.FirstOrDefault(), img.Width, img.Height);
            images[g.Id] = storage;
            written.Add((img, storage));
        }
        var errors = Raster.Rasterizer.Dispatch(program, "main", false, uniforms, images, (x, y, z), exec!.Runner.Time);
        foreach (var e in errors) exec.Runner.Output?.Invoke("compute shader: " + e);
        foreach (var (img, storage) in written)
        {
            if (img.LayerImages.Count == 0) img.LayerImages.Add(null);
            img.LayerImages[0] = storage.ToImage();
            img.Float = true;
        }
    }
}
