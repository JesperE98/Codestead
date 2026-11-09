using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

/// <summary>The OpenGL objects and state while the simulator walks the program (see <see cref="GlReader"/>).</summary>
internal sealed class GlState
{
    public sealed class ShaderObject
    {
        public string Stage = "";
        public string? Source;
        public bool Compiled;
    }

    public sealed class ProgramObject
    {
        public List<string> Shaders = new();
        public bool Linked;
        public ShaderProgram? Vertex;
        public ShaderProgram? Fragment;
        public string? VertexFile;
        public string? FragmentFile;
        /// <summary>Uniform name → a function of time giving its value.</summary>
        public Dictionary<string, Func<double, ShaderValue?>> Uniforms = new(StringComparer.Ordinal);
    }

    public sealed class Attribute
    {
        public string? Buffer;
        public int Size = 4;
        public int StrideBytes;
        public int OffsetBytes;
        public bool Enabled;
    }

    public sealed class VertexArray
    {
        public Dictionary<int, Attribute> Attributes = new();
        public string? ElementBuffer;
    }

    public Dictionary<string, ShaderObject> ShaderObjects { get; } = new(StringComparer.Ordinal);
    public Dictionary<string, ProgramObject> Programs { get; } = new(StringComparer.Ordinal);
    /// <summary>Buffer name → its data (numbers), or null while it has none.</summary>
    public Dictionary<string, List<double>?> Buffers { get; } = new(StringComparer.Ordinal);
    public Dictionary<string, VertexArray> VertexArrays { get; } = new(StringComparer.Ordinal);
    /// <summary>Variable that holds a uniform location → the uniform's name.</summary>
    public Dictionary<string, string> Locations { get; } = new(StringComparer.Ordinal);

    public string? CurrentProgram;
    public string? CurrentVertexArray;
    public string? ArrayBuffer;
    public double[] ClearColor = [0, 0, 0, 0];
    public bool ClearColorSet;
    public bool Wireframe;
    public bool CullFace;
    public string CullFaceMode = "GL_BACK";
    public bool FrontCcw = true;
    public bool DepthTest;
}
