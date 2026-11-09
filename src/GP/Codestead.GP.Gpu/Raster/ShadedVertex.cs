using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Raster;

/// <summary>A vertex after the vertex shader: its clip-space position and its outputs (by name and by "@location").</summary>
internal sealed record ShadedVertex(double[] Clip, Dictionary<string, ShaderValue> Outputs);
