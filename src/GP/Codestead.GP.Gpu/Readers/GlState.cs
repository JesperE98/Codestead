using Codestead.GP.Gpu.Shading;
using Codestead.GP.Gpu.Textures;

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
        public ShaderProgram? Geometry;
        public string? GeometryFile;
        /// <summary>glUniformBlockBinding: block name → binding point.</summary>
        public Dictionary<string, int> BlockBindings = new(StringComparer.Ordinal);
    }

    public sealed class Attribute
    {
        public string? Buffer;
        public int Size = 4;
        public int StrideBytes;
        public int OffsetBytes;
        public bool Enabled;
        /// <summary>glVertexAttribDivisor: 0 = per vertex, n = a new value every n instances.</summary>
        public int Divisor;
    }

    public sealed class VertexArray
    {
        public Dictionary<int, Attribute> Attributes = new();
        public string? ElementBuffer;
    }

    public sealed class TextureObject
    {
        public Image? Image;
        public int Components = 4;
        public Wrap WrapS = Wrap.Repeat;
        public Wrap WrapT = Wrap.Repeat;
        /// <summary>OpenGL's default minification filter uses mipmaps: without glGenerateMipmap the texture is incomplete.</summary>
        public string MinFilter = "GL_NEAREST_MIPMAP_LINEAR";
        public string MagFilter = "GL_LINEAR";
        public bool Mipmaps;
        public double[]? Border;
        /// <summary>An sRGB internal format (GL_SRGB, GL_SRGB_ALPHA …): sampling decodes to linear.</summary>
        public bool Srgb;
        /// <summary>A cube map (GL_TEXTURE_CUBE_MAP): its six faces.</summary>
        public bool IsCube;
        public Image?[] Faces = new Image?[6];
        /// <summary>Size and format from glTexImage2D with no data (a render target), and where it is attached.</summary>
        public int Width, Height;
        public bool Float, IsDepth;
        public int Samples = 1;
        public string? Framebuffer;
        public int Attachment;
        /// <summary>
        /// Mip levels drawn into one by one (a pre-filtered environment map) or made from level 0 after drawing
        /// (glGenerateMipmap on a captured cube map): the render targets "tex:name~level" hold them.
        /// </summary>
        public int TargetLevels = 1;

        public bool Complete => (Image is not null || IsCube || Framebuffer is not null) && (Mipmaps || !MinFilter.Contains("MIPMAP", StringComparison.Ordinal));
    }

    /// <summary>A framebuffer object: its colour textures by attachment, its depth (texture or renderbuffer).</summary>
    public sealed class FramebufferObject
    {
        public Dictionary<int, TextureObject> Colors = new();
        public bool Depth, Stencil;
        public int Samples = 1;
        public int Width, Height;
        /// <summary>Layers: a whole cube map attached with glFramebufferTexture is drawn into face by face (gl_Layer).</summary>
        public int Layers = 1;
        /// <summary>
        /// The colour attachment changes between draws (glFramebufferTexture2D with a cube map's face or a mip level:
        /// learnopengl's captureFBO): each draw goes to the texture, face and level attached then.
        /// </summary>
        public bool PerTexture;
        public string? TargetTexture;
        public int TargetFace = -1, TargetLevel;
    }

    public sealed class Renderbuffer
    {
        public string Format = "";
        public int Samples = 1;
        public int Width, Height;
    }

    public Dictionary<string, FramebufferObject> Framebuffers { get; } = new(StringComparer.Ordinal);
    public Dictionary<string, Renderbuffer> Renderbuffers { get; } = new(StringComparer.Ordinal);
    public string? DrawFramebuffer, ReadFramebuffer, CurrentRenderbuffer;

    /// <summary>Uniform buffers: binding point → (buffer, offset); writes into a buffer by byte offset.</summary>
    public Dictionary<int, (string Buffer, int Offset)> UniformBindings { get; } = new();
    public Dictionary<string, SortedDictionary<int, ShaderValue>> BufferWrites { get; } = new(StringComparer.Ordinal);
    public string? UniformBuffer;
    /// <summary>A variable holding a uniform block index → the block's name.</summary>
    public Dictionary<string, string> BlockIndices { get; } = new(StringComparer.Ordinal);
    /// <summary>A variable holding a mapped buffer pointer (glMapBuffer) → the buffer.</summary>
    public Dictionary<string, string> Mapped { get; } = new(StringComparer.Ordinal);
    public string? CopyReadBuffer, CopyWriteBuffer;

    public Dictionary<string, TextureObject> TextureObjects { get; } = new(StringComparer.Ordinal);
    /// <summary>Texture unit → the texture bound to it.</summary>
    public Dictionary<int, string> Units { get; } = new();
    /// <summary>
    /// A unit has a binding per kind of texture: the 2D texture and the cube map bound to it (a sampler2D reads the
    /// first, a samplerCube the second) – <see cref="Units"/> is the one bound last.
    /// </summary>
    public Dictionary<int, string> Units2D { get; } = new();
    public Dictionary<int, string> UnitsCube { get; } = new();
    public int ActiveUnit;

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
    public Scene.CompareFunc DepthFunc = Scene.CompareFunc.Less;
    public bool DepthMask = true;
    public bool StencilTest;
    public Scene.StencilState Stencil = new();
    public bool Blend;
    public Scene.BlendState BlendState = new();
    public bool[] ColorMask = [true, true, true, true];
    public double PointSize = 1;
    public bool ProgramPointSize;
}
