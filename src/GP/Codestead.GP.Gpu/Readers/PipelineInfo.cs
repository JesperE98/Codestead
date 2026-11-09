using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

/// <summary>One graphics pipeline (Vulkan) or pipeline state object (DirectX 12): its shaders and fixed-function state.</summary>
internal sealed record PipelineInfo(string Name, ShaderProgram Vs, ShaderProgram Fs, string VsEntry, string FsEntry,
    CullMode Cull, bool FrontCcw, bool Wireframe, bool DepthTest, Topology Topology, PipelineState.Fixed? State = null,
    ShaderProgram? Gs = null, string GsEntry = "main");
