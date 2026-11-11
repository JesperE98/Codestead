using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

/// <summary>One graphics pipeline (Vulkan) or pipeline state object (DirectX 12): its shaders and fixed-function state.</summary>
internal sealed record PipelineInfo(string Name, ShaderProgram Vs, ShaderProgram Fs, string VsEntry, string FsEntry,
    CullMode Cull, bool FrontCcw, bool Wireframe, bool DepthTest, Topology Topology, PipelineState.Fixed? State = null,
    ShaderProgram? Gs = null, string GsEntry = "main")
{
    /// <summary>The tessellation stages (Vulkan .tesc / .tese, D3D12 HS / DS) and the control points per patch.</summary>
    public ShaderProgram? Tcs { get; init; }
    public ShaderProgram? Tes { get; init; }
    public string TcsEntry { get; init; } = "main";
    public string TesEntry { get; init; } = "main";
    public int PatchPoints { get; init; } = 3;

    /// <summary>A program with the globals of several stages (for the samplers and blocks any of them reads).</summary>
    public static ShaderProgram Merged(ShaderProgram first, params ShaderProgram?[] more)
    {
        if (more.All(m => m is null)) return first;
        var merged = new ShaderProgram { Source = first.Source };
        merged.Globals.AddRange(first.Globals);
        merged.Structs.AddRange(first.Structs);
        foreach (var m in more)
            if (m is not null)
            {
                merged.Globals.AddRange(m.Globals);
                merged.Structs.AddRange(m.Structs);
            }
        return merged;
    }
}
