using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

/// <summary>
/// Reads an OpenGL program the way a driver would see it: walks main() call by call (GLFW, GLAD, shaders, buffers,
/// vertex arrays, uniforms, clears and draws) and records one frame of the render loop. The calls are handled in
/// GlReader.Calls.cs, the draw calls in GlReader.Draw.cs.
/// </summary>
public sealed partial class GlReader
{
    private readonly GpuProject project;
    private readonly CppSource src;
    private readonly Scene.Scene scene = new() { Api = Apis.OpenGL };
    private readonly GlState gl = new();
    private bool inLoop, glfwInit, gladLoaded, windowCreated;
    private readonly List<DrawCall> setupDraws = new();

    private GlReader(GpuProject project)
    {
        this.project = project;
        var main = project.MainFile;
        src = new CppSource(main, project.Files.TryGetValue(main, out var t) ? t : "");
    }

    public static Scene.Scene Read(GpuProject project) => new GlReader(project).Run();

    private static readonly Regex CallStart = new(@"(?<![\w.>])(?<name>gl[A-Z]\w*|glfw[A-Z]\w*|gladLoadGL(?:Loader)?)\s*\(|(?<obj>[A-Za-z_]\w*)\s*\.\s*(?<method>use|setFloat|setInt|setBool|setVec2|setVec3|setVec4|setMat4)\s*\(", RegexOptions.CultureInvariant);
    private static readonly Regex AssignRe = new(@"^(?:[A-Za-z_][\w:<>]*\s*[*&]?\s+)*(?<lhs>[A-Za-z_]\w*(?:\[\d+\])?)\s*=\s*(?<rhs>[\s\S]+)$", RegexOptions.CultureInvariant);
    private static readonly Regex ShaderClassRe = new(@"^Shader\s+(?<name>\w+)\s*\(\s*""(?<vs>[^""]+)""\s*,\s*""(?<fs>[^""]+)""", RegexOptions.CultureInvariant);

    private Scene.Scene Run()
    {
        if (!src.Functions.ContainsKey("main"))
        {
            scene.Notes.Add(SimNote.Error("noMain"));
            return scene;
        }
        foreach (var st in CppStatements.Walk(src, "main"))
        {
            switch (st.Kind)
            {
                case "loop-start":
                    inLoop = true;
                    scene.RenderLoop = windowCreated;
                    continue;
                case "loop-end":
                    inLoop = false;
                    continue;
            }
            Statement(st);
            // Once the render loop is reached, the frame is what the loop does.
        }
        Finish();
        return scene;
    }

    private void Statement(CppStatement st)
    {
        var text = st.Text;
        var shaderClass = ShaderClassRe.Match(text);
        if (shaderClass.Success)
        {
            ShaderClass(shaderClass.Groups["name"].Value, shaderClass.Groups["vs"].Value, shaderClass.Groups["fs"].Value, src.LineAt(st.Offset));
            return;
        }
        string? lhs = null;
        var assign = AssignRe.Match(text);
        if (assign.Success && !text.StartsWith("return", StringComparison.Ordinal)) lhs = assign.Groups["lhs"].Value;
        foreach (Match m in CallStart.Matches(text))
        {
            int open = m.Index + m.Length - 1;
            int close = CppSource.MatchBracket(text, open);
            if (close < 0) continue;
            var args = CppSource.SplitArgs(text[(open + 1)..close]);
            int line = src.LineAt(st.Offset + m.Index);
            if (m.Groups["method"].Success) ShaderMethod(m.Groups["obj"].Value, m.Groups["method"].Value, args, line);
            else Call(m.Groups["name"].Value, args, lhs, line);
        }
    }

    private static string Obj(string arg) => Regex.Replace(arg.Trim().TrimStart('&'), @"\s+", "");

    /// <summary>The array or vector behind a data argument: vertices, &amp;vertices[0], vertices.data().</summary>
    private static string DataName(string arg)
    {
        var a = Obj(arg);
        a = Regex.Replace(a, @"\.data\(\)$|\[0\]$", "");
        return a;
    }

    private void Finish()
    {
        scene.WindowCreated = windowCreated;
        // Uniforms that read the clock make the frame change over time.
        foreach (var d in scene.Draws) d.Uniforms(1.0);
        if (src.UsedTime && scene.Draws.Count > 0) scene.Animated = true;
        if (!glfwInit && src.HasCall("glfwCreateWindow")) scene.Notes.Add(SimNote.Error("glfwInitMissing"));
        if (!windowCreated)
        {
            scene.Notes.Add(SimNote.Info("noWindow"));
            return;
        }
        if (!scene.RenderLoop)
        {
            scene.Notes.Add(SimNote.Warning("noLoop"));
            return;
        }
        if (!scene.Presents) scene.Notes.Add(SimNote.Warning("noPresent", ("call", "glfwSwapBuffers(window)")));
        if (!src.HasCall("glfwPollEvents")) scene.Notes.Add(SimNote.Warning("noPollEvents"));
        if (setupDraws.Count > 0 && scene.Draws.Count == 0) scene.Notes.Add(SimNote.Warning("drawOutsideLoop", ("call", "glDrawArrays")));
        if (scene.ClearColor is null && (gl.ClearColorSet || scene.Draws.Count > 0)) scene.Notes.Add(SimNote.Warning("noClear", ("call", "glClear(GL_COLOR_BUFFER_BIT)")));
    }
}
