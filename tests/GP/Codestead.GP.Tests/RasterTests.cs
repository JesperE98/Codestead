using Codestead.GP.Gpu;
using Codestead.GP.Gpu.Raster;
using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;
using Codestead.GP.Gpu.Textures;

namespace Codestead.GP.Tests;

/// <summary>The simulated GPU's fixed-function stages and shader stages, with hand-made draws (no program to read).</summary>
public class RasterTests
{
    private const string PassVs = """
        #version 330 core
        layout (location = 0) in vec3 aPos;
        void main() { gl_Position = vec4(aPos, 1.0); }
        """;

    private static string ColorFs(string color) => $$"""
        #version 330 core
        out vec4 FragColor;
        void main() { FragColor = {{color}}; }
        """;

    /// <summary>A quad from (x0, y0) to (x1, y1) in normalized device coordinates, at depth z.</summary>
    private static List<Dictionary<string, ShaderValue>> Quad(double x0, double y0, double x1, double y1, double z = 0)
    {
        var corners = new[] { (x0, y0), (x1, y0), (x1, y1), (x0, y0), (x1, y1), (x0, y1) };
        return corners.Select(c => new Dictionary<string, ShaderValue> { ["0"] = ShaderValue.Vec(c.Item1, c.Item2, z) }).ToList();
    }

    private static DrawCall Draw(List<Dictionary<string, ShaderValue>> vertices, string fs, string vs = PassVs, Action<DrawCallInit>? init = null)
    {
        var o = new DrawCallInit();
        init?.Invoke(o);
        return new DrawCall
        {
            VertexShader = ShaderParser.ParseProgram(vs),
            FragmentShader = ShaderParser.ParseProgram(fs),
            GeometryShader = o.Geometry is null ? null : ShaderParser.ParseProgram(o.Geometry),
            Vertices = vertices,
            Count = vertices.Count,
            Topology = o.Topology,
            DepthTest = o.DepthTest,
            DepthFunc = o.DepthFunc,
            DepthWrite = o.DepthWrite,
            Stencil = o.Stencil,
            Blend = o.Blend,
            Target = o.Target,
            Textures = o.Textures,
            CubeTextures = o.Cubes,
            PointSize = o.PointSize,
            ProgramPointSize = o.ProgramPointSize,
        };
    }

    private sealed class DrawCallInit
    {
        public Topology Topology = Topology.Triangles;
        public bool DepthTest;
        public CompareFunc DepthFunc = CompareFunc.Less;
        public bool DepthWrite = true;
        public StencilState? Stencil;
        public BlendState? Blend;
        public string? Target;
        public string? Geometry;
        public Func<string, double, double, double[]>? Textures;
        public Func<string, double, double, double, double[]?>? Cubes;
        public double PointSize = 1;
        public bool ProgramPointSize;
    }

    private static Frame Render(params DrawCall[] draws) => Render(null, draws);

    private static Frame Render(Action<Scene>? setup, params DrawCall[] draws)
    {
        var scene = new Scene { Api = Apis.OpenGL, WindowCreated = true, RenderLoop = true, Presents = true, ClearColor = [0, 0, 0, 1], Width = 100, Height = 100 };
        setup?.Invoke(scene);
        scene.Draws.AddRange(draws);
        return Rasterizer.Render(scene, 100);
    }

    private static void AssertColor(double[] expected, double[] actual, double tolerance = 0.02)
    {
        for (int i = 0; i < 3; i++) Assert.True(Math.Abs(expected[i] - actual[i]) <= tolerance, $"expected ({string.Join(", ", expected)}), got ({string.Join(", ", actual.Take(3).Select(v => v.ToString("0.###")))})");
    }

    [Fact(DisplayName = "djuptest: GL_ALWAYS ritar över, GL_LESS ritar inte bakom")]
    public void DepthFunc()
    {
        var near = Draw(Quad(-1, -1, 1, 1, -0.5), ColorFs("vec4(1.0, 0.0, 0.0, 1.0)"), init: o => o.DepthTest = true);
        var far = Draw(Quad(-1, -1, 1, 1, 0.5), ColorFs("vec4(0.0, 1.0, 0.0, 1.0)"), init: o => o.DepthTest = true);
        AssertColor([1, 0, 0], Render(near, far).At(50, 50));
        var farAlways = Draw(Quad(-1, -1, 1, 1, 0.5), ColorFs("vec4(0.0, 1.0, 0.0, 1.0)"), init: o => { o.DepthTest = true; o.DepthFunc = CompareFunc.Always; });
        AssertColor([0, 1, 0], Render(near, farAlways).At(50, 50));
        // glDepthMask(GL_FALSE): the near quad does not write depth, so the far one is still drawn.
        var nearNoWrite = Draw(Quad(-1, -1, 1, 1, -0.5), ColorFs("vec4(1.0, 0.0, 0.0, 1.0)"), init: o => { o.DepthTest = true; o.DepthWrite = false; });
        AssertColor([0, 1, 0], Render(nearNoWrite, far).At(50, 50));
    }

    [Fact(DisplayName = "stenciltest: en kontur ritas bara utanför det första objektet")]
    public void StencilOutline()
    {
        var write = new StencilState(CompareFunc.Always, 1, 0xFF, 0xFF, StencilOp.Keep, StencilOp.Keep, StencilOp.Replace);
        var test = new StencilState(CompareFunc.NotEqual, 1, 0xFF, 0x00, StencilOp.Keep, StencilOp.Keep, StencilOp.Replace);
        var obj = Draw(Quad(-0.5, -0.5, 0.5, 0.5), ColorFs("vec4(1.0, 1.0, 1.0, 1.0)"), init: o => o.Stencil = write);
        var outline = Draw(Quad(-0.6, -0.6, 0.6, 0.6), ColorFs("vec4(0.04, 0.28, 0.26, 1.0)"), init: o => o.Stencil = test);
        var frame = Render(obj, outline);
        AssertColor([1, 1, 1], frame.At(50, 50));
        AssertColor([0.04, 0.28, 0.26], frame.At(22, 50));
        AssertColor([0, 0, 0], frame.At(5, 50));
    }

    [Fact(DisplayName = "blandning: SRC_ALPHA, ONE_MINUS_SRC_ALPHA blandar halvgenomskinligt glas")]
    public void Blending()
    {
        var back = Draw(Quad(-1, -1, 1, 1), ColorFs("vec4(0.0, 0.0, 1.0, 1.0)"));
        var glass = Draw(Quad(-1, -1, 1, 1), ColorFs("vec4(1.0, 0.0, 0.0, 0.25)"),
            init: o => o.Blend = new BlendState(BlendFactor.SrcAlpha, BlendFactor.OneMinusSrcAlpha, BlendFactor.One, BlendFactor.Zero));
        AssertColor([0.25, 0, 0.75], Render(back, glass).At(50, 50));
    }

    [Fact(DisplayName = "discard lämnar pixeln orörd")]
    public void Discard()
    {
        var fs = """
            #version 330 core
            out vec4 FragColor;
            void main() { if (gl_FragCoord.x < 50.0) discard; FragColor = vec4(1.0); }
            """;
        var frame = Render(Draw(Quad(-1, -1, 1, 1), fs));
        AssertColor([0, 0, 0], frame.At(25, 50));
        AssertColor([1, 1, 1], frame.At(75, 50));
    }

    [Fact(DisplayName = "framebuffer: det som ritats i ett mål kan samplas som textur (efterbehandling)")]
    public void RenderTargetPostProcessing()
    {
        var scene = Draw(Quad(-1, -1, 0, 1), ColorFs("vec4(0.2, 0.4, 0.6, 1.0)"), init: o => o.Target = "fbo");
        var vs = """
            #version 330 core
            layout (location = 0) in vec3 aPos;
            out vec2 TexCoords;
            void main() { TexCoords = aPos.xy * 0.5 + 0.5; gl_Position = vec4(aPos, 1.0); }
            """;
        var fs = """
            #version 330 core
            in vec2 TexCoords;
            out vec4 FragColor;
            uniform sampler2D screenTexture;
            void main() { FragColor = vec4(vec3(1.0 - texture(screenTexture, TexCoords)), 1.0); }
            """;
        var tex = new Texture(() => Rasterizer.TargetImage("fbo"), SamplerState.Default);
        var quad = Draw(Quad(-1, -1, 1, 1), fs, vs, o => o.Textures = (_, u, v) => tex.Sample(u, v));
        var frame = Render(s =>
        {
            s.Targets["fbo"] = new RenderTarget("fbo");
            s.Ops.Add(new ClearOp(0, "fbo", [0.1, 0.1, 0.1, 1], 1, 0));
        }, scene, quad);
        AssertColor([0.8, 0.6, 0.4], frame.At(25, 50));   // inverted (0.2, 0.4, 0.6)
        AssertColor([0.9, 0.9, 0.9], frame.At(75, 50));   // inverted clear colour
    }

    [Fact(DisplayName = "multisampling: en kant får blandade färger, utan MSAA bara hela")]
    public void Multisampling()
    {
        // A triangle whose edge crosses pixels diagonally.
        var tri = new List<Dictionary<string, ShaderValue>>
        {
            new() { ["0"] = ShaderValue.Vec(-1, -1, 0) }, new() { ["0"] = ShaderValue.Vec(1, -1, 0) }, new() { ["0"] = ShaderValue.Vec(1, 1, 0) },
        };
        var draw = Draw(tri, ColorFs("vec4(1.0)"));
        var aliased = Render(draw);
        var smooth = Render(s => s.Samples = 4, draw);
        var greysAliased = Enumerable.Range(0, 100).Count(i => aliased.At(i, 99 - i)[0] is > 0.05 and < 0.95);
        var greysSmooth = Enumerable.Range(0, 100).Count(i => smooth.At(i, 99 - i)[0] is > 0.05 and < 0.95);
        Assert.Equal(0, greysAliased);
        Assert.True(greysSmooth > 50, $"only {greysSmooth} edge pixels are blended");
    }

    [Fact(DisplayName = "punkter och linjer rastreras")]
    public void PointsAndLines()
    {
        var vs = """
            #version 330 core
            layout (location = 0) in vec3 aPos;
            void main() { gl_Position = vec4(aPos, 1.0); gl_PointSize = 10.0; }
            """;
        var point = Draw([new() { ["0"] = ShaderValue.Vec(0, 0, 0) }], ColorFs("vec4(1.0)"), vs, o => { o.Topology = Topology.Points; o.ProgramPointSize = true; });
        var frame = Render(point);
        AssertColor([1, 1, 1], frame.At(53, 53));
        AssertColor([0, 0, 0], frame.At(58, 50));
        var line = Draw([new() { ["0"] = ShaderValue.Vec(-1, 0.01, 0) }, new() { ["0"] = ShaderValue.Vec(1, 0.01, 0) }], ColorFs("vec4(1.0)"), init: o => o.Topology = Topology.Lines);
        var lf = Render(line);
        Assert.True(Enumerable.Range(0, 100).Count(x => lf.At(x, 49)[0] > 0.5) > 95);
        Assert.True(Enumerable.Range(0, 100).Count(x => lf.At(x, 40)[0] > 0.5) == 0);
    }

    [Fact(DisplayName = "geometrishader: en punkt blir en kvadrat (triangle_strip) med interface-block")]
    public void GeometryShader()
    {
        var vs = """
            #version 330 core
            layout (location = 0) in vec3 aPos;
            out VS_OUT { vec3 color; } vs_out;
            void main() { gl_Position = vec4(aPos, 1.0); vs_out.color = vec3(0.0, 1.0, 0.0); }
            """;
        var gs = """
            #version 330 core
            layout (points) in;
            layout (triangle_strip, max_vertices = 4) out;
            in VS_OUT { vec3 color; } gs_in[];
            out vec3 fColor;
            void main() {
                fColor = gs_in[0].color;
                gl_Position = gl_in[0].gl_Position + vec4(-0.2, -0.2, 0.0, 0.0); EmitVertex();
                gl_Position = gl_in[0].gl_Position + vec4( 0.2, -0.2, 0.0, 0.0); EmitVertex();
                gl_Position = gl_in[0].gl_Position + vec4(-0.2,  0.2, 0.0, 0.0); EmitVertex();
                gl_Position = gl_in[0].gl_Position + vec4( 0.2,  0.2, 0.0, 0.0); EmitVertex();
                EndPrimitive();
            }
            """;
        var fs = """
            #version 330 core
            in vec3 fColor;
            out vec4 FragColor;
            void main() { FragColor = vec4(fColor, 1.0); }
            """;
        var draw = Draw([new() { ["0"] = ShaderValue.Vec(0.5, 0.5, 0) }], fs, vs, o => { o.Topology = Topology.Points; o.Geometry = gs; });
        var frame = Render(draw);
        AssertColor([0, 1, 0], frame.At(75, 25));
        AssertColor([0, 1, 0], frame.At(66, 34));
        AssertColor([0, 0, 0], frame.At(50, 50));
    }

    [Fact(DisplayName = "interface-block mellan vertex- och fragmentshader")]
    public void InterfaceBlock()
    {
        var vs = """
            #version 330 core
            layout (location = 0) in vec3 aPos;
            out VS_OUT { vec3 color; float strength; } vs_out;
            void main() { gl_Position = vec4(aPos, 1.0); vs_out.color = vec3(1.0, 0.5, 0.0); vs_out.strength = 0.5; }
            """;
        var fs = """
            #version 330 core
            in VS_OUT { vec3 color; float strength; } fs_in;
            out vec4 FragColor;
            void main() { FragColor = vec4(fs_in.color * fs_in.strength, 1.0); }
            """;
        AssertColor([0.5, 0.25, 0], Render(Draw(Quad(-1, -1, 1, 1), fs, vs)).At(50, 50));
    }

    [Fact(DisplayName = "kubkarta: riktningen väljer sida (+X, -Z …)")]
    public void CubeMap()
    {
        var colors = new[] { new byte[] { 255, 0, 0 }, [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255] };
        var cube = new CubeTexture(colors.Select(c => (Texture?)new Texture(new Image(1, 1, 4, [c[0], c[1], c[2], 255]), SamplerState.Default)).ToList());
        AssertColor([1, 0, 0], cube.Sample(1, 0.1, 0.2));
        AssertColor([0, 1, 0], cube.Sample(-1, 0.1, 0.2));
        AssertColor([0, 0, 1], cube.Sample(0.1, 1, 0.2));
        AssertColor([1, 0, 1], cube.Sample(0.1, 0.2, -1));
        var fs = """
            #version 330 core
            out vec4 FragColor;
            uniform samplerCube skybox;
            void main() { FragColor = texture(skybox, vec3(0.0, 0.0, -1.0)); }
            """;
        var frame = Render(Draw(Quad(-1, -1, 1, 1), fs, init: o => o.Cubes = (n, x, y, z) => n == "skybox" ? cube.Sample(x, y, z) : null));
        AssertColor([1, 0, 1], frame.At(50, 50));
    }

    [Fact(DisplayName = "sRGB: en sRGB-textur avkodas till linjära värden, ett sRGB-fönster kodar dem igen")]
    public void Srgb()
    {
        var image = new Image(1, 1, 4, [188, 128, 0, 255]);
        var linear = new Texture(image, SamplerState.Default).Sample(0.5, 0.5);
        var decoded = new Texture(image, SamplerState.Default) { Srgb = true }.Sample(0.5, 0.5);
        Assert.Equal(188 / 255.0, linear[0], 3);
        Assert.Equal(0.5029, decoded[0], 3);   // sRGB 188 is linear 0.503
        Assert.Equal(0.2158, decoded[1], 3);   // sRGB 128 is linear 0.216
        Assert.Equal(0.0, decoded[2], 6);
        var fs = """
            #version 330 core
            out vec4 FragColor;
            void main() { FragColor = vec4(0.5029, 0.2158, 0.0, 1.0); }
            """;
        AssertColor([188 / 255.0, 128 / 255.0, 0], Render(s => s.WindowSrgb = true, Draw(Quad(-1, -1, 1, 1), fs)).At(50, 50));
    }

    [Fact(DisplayName = "HDR: en Radiance-fil (.hdr) läses som flyttal, med värden över 1.0")]
    public void RadianceHdrImage()
    {
        var bytes = File.ReadAllBytes(Path.Combine(Repo.Content, "textures", "hdr", "environment.hdr"));
        Assert.True(RadianceHdr.IsHdr(bytes));
        var image = RadianceHdr.Decode(bytes)!;
        Assert.Equal((512, 256, 3), (image.Width, image.Height, image.Channels));
        Assert.NotNull(image.Floats);
        // The sun is far brighter than white; the zenith is a moderate blue.
        Assert.True(image.Floats!.Max() > 40);
        var zenith = new Texture(image, SamplerState.Default).Sample(0.1, 0.02);
        Assert.True(zenith[2] > zenith[0] && zenith[2] > 0.5 && zenith[2] < 3);
    }

    [Fact(DisplayName = "C++: std::map sorterar fönstren och reverse_iterator går bakifrån")]
    public void MapReverseIterator()
    {
        var runner = new ShaderRunner(new ShaderProgram()) { Lenient = true };
        runner.RunStatements(ShaderParser.ParseStatementsLenient("""
            {
                std::vector<glm::vec3> windows = { glm::vec3(0.0f, 0.0f, 0.7f), glm::vec3(0.0f, 0.0f, -2.3f), glm::vec3(1.5f, 0.0f, 0.51f) };
                glm::vec3 cameraPos = glm::vec3(0.0f, 0.0f, 3.0f);
                std::map<float, glm::vec3> sorted;
                for (unsigned int i = 0; i < windows.size(); i++)
                {
                    float distance = glm::length(cameraPos - windows[i]);
                    sorted[distance] = windows[i];
                }
                float order = 0.0f;
                for (std::map<float, glm::vec3>::reverse_iterator it = sorted.rbegin(); it != sorted.rend(); ++it)
                {
                    order = order * 10.0f + it->second.z;
                }
                result = order;
            }
            """));
        // Farthest first: z = -2.3, then 0.51, then 0.7.
        Assert.Equal(((-2.3 * 10) + 0.51) * 10 + 0.7, runner.Globals["result"].X, 6);
    }

    [Fact(DisplayName = "C++: rand() ger glibc:s tal, och strängar byggs med + och to_string")]
    public void RandAndStrings()
    {
        var runner = new ShaderRunner(new ShaderProgram()) { Lenient = true };
        runner.RunStatements(ShaderParser.ParseStatementsLenient("""
            {
                srand(42);
                int a = rand();
                int b = rand();
                int i = 7;
                std::string name = "offsets[" + std::to_string(i) + "]";
                glm::mat4* matrices;
                matrices = new glm::mat4[3];
            }
            """));
        Assert.Equal(71876166, runner.Globals["a"].X);
        Assert.Equal(708592740, runner.Globals["b"].X);
        Assert.Equal("offsets[7]", runner.Globals["name"].Text);
        Assert.Equal(3, runner.Globals["matrices"].Items!.Length);
    }
}
