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
    public CompareFunc DepthFunc { get; init; } = CompareFunc.Less;
    /// <summary>The depth test writes the depth of the fragments that pass (glDepthMask(GL_TRUE)).</summary>
    public bool DepthWrite { get; init; } = true;
    /// <summary>The stencil test, or null when it is off.</summary>
    public StencilState? Stencil { get; init; }
    /// <summary>Blending, or null when it is off.</summary>
    public BlendState? Blend { get; init; }
    /// <summary>
    /// Blending per colour attachment when they differ (glBlendFunci, D3D12's IndependentBlendEnable): attachment i
    /// blends with element i (null: off); attachments past the list use <see cref="Blend"/>. Null: all use Blend.
    /// </summary>
    public IReadOnlyList<BlendState?>? AttachmentBlends { get; init; }
    /// <summary>The colour channels written (glColorMask): R, G, B, A.</summary>
    public bool[] ColorMask { get; init; } = [true, true, true, true];
    /// <summary>The render target drawn into (<see cref="Scene.Targets"/>), or null for the window.</summary>
    public string? Target { get; init; }
    /// <summary>The size of points in pixels (glPointSize) unless the vertex shader writes gl_PointSize.</summary>
    public double PointSize { get; init; } = 1;
    /// <summary>The vertex shader may set gl_PointSize (GL_PROGRAM_POINT_SIZE; always in Vulkan).</summary>
    public bool ProgramPointSize { get; init; }
    /// <summary>A geometry shader between the vertex and the fragment shader, or null.</summary>
    public ShaderProgram? GeometryShader { get; init; }
    public string GeometryEntry { get; init; } = "main";
    /// <summary>Per-instance attributes (glVertexAttribDivisor, VK_VERTEX_INPUT_RATE_INSTANCE, D3D12 per-instance data):
    /// the values for instance i are InstanceVertices[i / divisor], keyed like <see cref="Vertices"/>.</summary>
    public List<Dictionary<string, ShaderValue>>? InstanceVertices { get; init; }
    public int InstanceDivisor { get; init; } = 1;
    /// <summary>Textures for texture()/Sample(): (name, u, v) → RGBA.</summary>
    public Func<string, double, double, double[]>? Textures { get; init; }
    /// <summary>Cube maps: (name, direction x, y, z) → RGBA, or null when the name is not a cube map.</summary>
    public Func<string, double, double, double, double[]?>? CubeTextures { get; init; }
    /// <summary>Cube maps with mip levels read at a level (textureLod, SampleLevel): (name, direction, lod) → RGBA, or null.</summary>
    public Func<string, double, double, double, double, double[]?>? CubeTexturesLod { get; init; }

    /// <summary>The image of the texture a sampler reads, for its size in texels (textureSize, texelFetch), or null.</summary>
    public Func<string, Codestead.GP.Gpu.Textures.Image?>? TextureImages { get; init; }
}
