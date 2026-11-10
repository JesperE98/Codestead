using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Shading;
using Codestead.GP.Gpu.Textures;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// Textures that change from draw to draw in the explicit APIs, followed through the program's helpers:
/// <list type="bullet">
/// <item>Vulkan: the descriptor set bound before a draw (vkCmdBindDescriptorSets) was written by a helper such as
/// <c>createDescriptorSet(cubeTextureImageView, textureSampler, cubeDescriptorSet)</c>; its image info names the view,
/// and the view was made by <c>loadTexture("textures/marble.png", image, memory, cubeTextureImageView)</c>.</item>
/// <item>DirectX 12: the descriptor table set before a draw (SetGraphicsRootDescriptorTable) starts at a heap slot
/// (<c>CD3DX12_GPU_DESCRIPTOR_HANDLE h(heapStart, 2, size)</c>); slot N holds the texture of
/// <c>LoadTexture("metal.png", texture, upload, 2)</c>, and register t<i>k</i> reads slot N + k.</item>
/// </list>
/// When a program does not follow such a pattern, the readers keep binding textures in load order.
/// </summary>
internal sealed class DrawTextures
{
    private readonly CppSource src;
    private readonly GpuProject project;
    /// <summary>Every argument of a helper call that loaded an image (the view, the image, the slot …) → the image.</summary>
    private readonly Dictionary<string, Image> imageByArg = new(StringComparer.Ordinal);
    /// <summary>D3D12: heap slot → image.</summary>
    private readonly Dictionary<int, Image> imageBySlot = new();

    public DrawTextures(CppSource src, GpuProject project)
    {
        this.src = src;
        this.project = project;
        foreach (var load in StbImage.All(src, project, new Scene.Scene { Api = "" }).Where(i => i.File == "" && i.Arg.Trim() != ""))
        {
            var fn = src.FunctionAt(load.Offset);
            if (fn is null) continue;
            var parameters = Parameters(fn);
            int pathIndex = parameters.IndexOf(Regex.Replace(load.Arg.Trim(), @"\.c_str\(\)$", ""));
            if (pathIndex < 0) continue;
            foreach (var call in CallsOf(fn))
            {
                var file = CppSource.StringArg(call.Arg(pathIndex));
                if (file is null || StbImage.Load(project, file, load.Flip, load.Wanted) is not { } image) continue;
                for (int i = 0; i < call.Args.Count; i++)
                {
                    if (i == pathIndex) continue;
                    var arg = Name(call.Arg(i));
                    if (arg is not null) imageByArg[arg] = image;
                    // A heap slot: the parameter that names a descriptor index (descriptorIndex, slot, heapIndex …).
                    if (i < parameters.Count && Regex.IsMatch(parameters[i], "(?i)index|slot|descriptor") && src.Int(call.Arg(i)) is int slot)
                        imageBySlot[slot] = image;
                }
            }
        }
    }

    public bool Any => imageByArg.Count > 0;

    /// <summary>The calls of a function (also as a method: obj.fn(…) / obj->fn(…)), in source order.</summary>
    private IEnumerable<CppCall> CallsOf(string fn) => src.Calls(fn).Concat(src.Calls("." + fn)).OrderBy(c => c.Offset);

    /// <summary>The parameter names of a function definition.</summary>
    private List<string> Parameters(string fn)
    {
        var m = Regex.Match(src.Code, @"(?<![\w.>])" + Regex.Escape(fn) + @"\s*\(([^()]*)\)\s*(?:const\s*)?\{");
        return m.Success ? CppSource.SplitArgs(m.Groups[1].Value).Select(p => Regex.Match(p, @"(\w+)\s*(?:=[^,]*)?$").Groups[1].Value).ToList() : [];
    }

    private static string? Name(string arg)
    {
        var a = Regex.Replace(arg.Trim().TrimStart('&').Trim(), @"\.Get\(\)$|\[[^\]]*\]$", "");
        return Regex.IsMatch(a, @"^[A-Za-z_]\w*$") ? a : null;
    }

    // ---------- Vulkan ----------

    /// <summary>
    /// The textures of a descriptor set, by binding, with their samplers: from the helper calls that write sets
    /// (dstSet = a parameter) – null when the set was not written that way.
    /// </summary>
    public Dictionary<int, (Image Image, SamplerState Sampler)>? VulkanSet(string setText, Func<string, SamplerState?> samplerByName)
    {
        var set = Name(setText);
        if (set is null) return null;
        foreach (var fn in src.Functions.Keys)
        {
            var body = src.FunctionBody(fn)!;
            if (!body.Contains("pImageInfo", StringComparison.Ordinal)) continue;
            var parameters = Parameters(fn);
            if (parameters.Count == 0) continue;
            var (start, end) = src.Functions[fn];
            string? FieldIn(string target, string field) =>
                src.FieldAssignments(field).Where(a => a.Offset >= start && a.Offset < end && a.Target == target).Select(a => a.Value).LastOrDefault();
            var writes = src.FieldAssignments("pImageInfo").Where(a => a.Offset >= start && a.Offset < end).ToList();
            foreach (var call in CallsOf(fn))
            {
                string Sub(string x) => parameters.IndexOf(x.Trim()) is int i and >= 0 ? call.Arg(i).Trim() : x.Trim();
                var result = new Dictionary<int, (Image, SamplerState)>();
                bool ours = false;
                foreach (var w in writes)
                {
                    var dst = FieldIn(w.Target, "dstSet");
                    if (dst is null || Name(Sub(dst)) != set) continue;
                    ours = true;
                    var info = w.Value.Trim().TrimStart('&').Trim();
                    var view = FieldIn(info, "imageView");
                    var sampler = FieldIn(info, "sampler");
                    int binding = src.Int(FieldIn(w.Target, "dstBinding") ?? "0") ?? 0;
                    if (view is null || Name(Sub(view)) is not { } viewName || !imageByArg.TryGetValue(viewName, out var image)) continue;
                    var state = sampler is not null && Name(Sub(sampler)) is { } sn ? samplerByName(sn) : null;
                    result[binding] = (image, state ?? SamplerState.Default);
                }
                if (ours && result.Count > 0) return result;
            }
        }
        return null;
    }

    // ---------- DirectX 12 ----------

    /// <summary>The heap slot a descriptor table starts at, from the handle bound (null when it cannot tell).</summary>
    public int? D3D12Slot(string handleText)
    {
        var text = handleText.Trim();
        if (text.EndsWith("GetGPUDescriptorHandleForHeapStart()", StringComparison.Ordinal)) return 0;
        string? args = null;
        var call = Regex.Match(text, @"^CD3DX12_GPU_DESCRIPTOR_HANDLE\((.*)\)$");
        if (call.Success) args = call.Groups[1].Value;
        else if (Name(text) is { } name)
        {
            var decl = Regex.Match(src.Code, @"CD3DX12_GPU_DESCRIPTOR_HANDLE\s+" + Regex.Escape(name) + @"\s*\(([^;]*)\)\s*;");
            if (decl.Success) args = decl.Groups[1].Value;
        }
        if (args is null) return null;
        var parts = CppSource.SplitArgs(args);
        return parts.Count >= 2 ? src.Int(parts[1]) : 0;
    }

    /// <summary>The image in a heap slot (loaded by a helper called with that slot), or null.</summary>
    public Image? SlotImage(int slot) => imageBySlot.GetValueOrDefault(slot);

    public bool HasSlots => imageBySlot.Count > 0;
}
