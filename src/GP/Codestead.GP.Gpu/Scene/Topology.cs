namespace Codestead.GP.Gpu.Scene;

/// <summary>How vertices are put together into primitives.</summary>
public enum Topology
{
    Triangles,
    TriangleStrip,
    TriangleFan,
    Lines,
    LineStrip,
    Points,
    /// <summary>Patches of control points for the tessellation stages (GL_PATCHES, a patch list, an N_CONTROL_POINT_PATCHLIST).</summary>
    Patches,
}
