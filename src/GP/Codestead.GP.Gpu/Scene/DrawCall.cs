using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Scene;

/// <summary>
/// One draw call as the simulated GPU runs it: the shaders, the vertex data (one dictionary per vertex, keyed by
/// attribute location "0", "1" … for GLSL or by semantic "POSITION0", "COLOR0" … for HLSL), the indices, the
/// uniforms at a point in time and the fixed-function state.
/// </summary>
public sealed class DrawCall
{
    public required ShaderProgram VertexShader { get; init; }
    public required ShaderProgram FragmentShader { get; init; }
    public string VertexEntry { get; init; } = "main";
    public string FragmentEntry { get; init; } = "main";
    /// <summary>HLSL shaders (entry points with semantics) rather than GLSL (main with in/out globals).</summary>
    public bool Hlsl { get; init; }
    /// <summary>Vulkan GLSL: varyings are matched by location, gl_VertexIndex is used.</summary>
    public bool MatchByLocation { get; init; }
    public List<Dictionary<string, ShaderValue>> Vertices { get; init; } = new();
    /// <summary>null: draw vertices First … First + Count - 1 in order.</summary>
    public int[]? Indices { get; init; }
    public int First { get; init; }
    public int Count { get; init; }
    public int Instances { get; init; } = 1;
    public Topology Topology { get; init; } = Topology.Triangles;
    /// <summary>Uniform values at a time in seconds: names of globals, or "instance.field" for blocks.</summary>
    public Func<double, Dictionary<string, ShaderValue>> Uniforms { get; init; } = _ => new();
    public CullMode Cull { get; init; }
    /// <summary>Counter-clockwise triangles are front faces (OpenGL's default; DirectX: FrontCounterClockwise).</summary>
    public bool FrontCcw { get; init; } = true;
    public bool Wireframe { get; init; }
    public bool DepthTest { get; init; }
    /// <summary>Textures for texture()/Sample(): (name, u, v) → RGBA.</summary>
    public Func<string, double, double, double[]>? Textures { get; init; }
}
