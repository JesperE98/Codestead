using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Raster;

/// <summary>Type helpers of the shader runner that the rasteriser needs.</summary>
internal static class ShaderRunnerTypes
{
    public static int Components(string type) => ShaderRunner.ComponentCount(type);
}
