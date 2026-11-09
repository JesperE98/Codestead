using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Raster;

/// <summary>
/// A vertex after the vertex (or geometry) shader: its clip-space position, its outputs (by name, by "@location" and
/// by "block:Type" for interface blocks) and the gl_PointSize it wrote.
/// </summary>
internal sealed record ShadedVertex(double[] Clip, Dictionary<string, ShaderValue> Outputs, double? PointSize = null);
