using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

// The OpenGL, GLFW and GLAD calls the simulator follows, and learnopengl.com's Shader class.
public sealed partial class GlReader
{
    private void Call(string name, IReadOnlyList<string> a, string? lhs, int line)
    {
        string A(int i) => i < a.Count ? a[i] : "";
        switch (name)
        {
            case "glfwInit":
                glfwInit = true;
                return;
            case "glfwCreateWindow":
                windowCreated = glfwInit;
                scene.Width = src.Int(A(0)) ?? 800;
                scene.Height = src.Int(A(1)) ?? 600;
                scene.WindowTitle = CppSource.StringArg(A(2)) ?? src.Evaluate(A(2))?.Text ?? "";
                return;
            case "gladLoadGLLoader" or "gladLoadGL":
                gladLoaded = true;
                return;
            case "glfwSwapBuffers":
                if (inLoop) scene.Presents = true;
                return;
        }
        if (!name.StartsWith("gl", StringComparison.Ordinal) || name.StartsWith("glfw", StringComparison.Ordinal)) return;
        if (!gladLoaded)
        {
            // Every OpenGL function is a null pointer until GLAD has loaded it: the program would crash here.
            if (!scene.Notes.Any(n => n.Key == "gladMissing")) scene.Notes.Add(SimNote.Error("gladMissing", ("call", name), ("line", line.ToString())));
            return;
        }
        switch (name)
        {
            case "glClearColor":
            {
                var v = a.Select(x => src.Evaluate(x)?.X ?? 0).ToArray();
                if (v.Length == 4)
                {
                    gl.ClearColor = v;
                    gl.ClearColorSet = true;
                }
                return;
            }
            case "glClear":
                if (A(0).Contains("GL_COLOR_BUFFER_BIT", StringComparison.Ordinal) && inLoop)
                {
                    scene.ClearColor = gl.ClearColor.ToArray();
                    scene.Draws.Clear();
                }
                return;
            case "glCreateShader":
                if (lhs is not null) gl.ShaderObjects[lhs] = new GlState.ShaderObject { Stage = A(0).Contains("FRAGMENT", StringComparison.Ordinal) ? "fragment" : A(0).Contains("VERTEX", StringComparison.Ordinal) ? "vertex" : "other" };
                return;
            case "glShaderSource":
                if (gl.ShaderObjects.TryGetValue(Obj(A(0)), out var so))
                    so.Source = src.Evaluate(Obj(A(2)))?.Text;
                return;
            case "glCompileShader":
                if (gl.ShaderObjects.TryGetValue(Obj(A(0)), out var cs)) cs.Compiled = true;
                return;
            case "glCreateProgram":
                if (lhs is not null) gl.Programs[lhs] = new GlState.ProgramObject();
                return;
            case "glAttachShader":
                if (gl.Programs.TryGetValue(Obj(A(0)), out var ap)) ap.Shaders.Add(Obj(A(1)));
                return;
            case "glLinkProgram":
                if (gl.Programs.TryGetValue(Obj(A(0)), out var lp)) Link(lp, line);
                return;
            case "glUseProgram":
                gl.CurrentProgram = Obj(A(0)) is "0" ? null : Obj(A(0));
                return;
            case "glGenVertexArrays" or "glGenBuffers":
                foreach (var n in Names(A(0), A(1)))
                {
                    if (name == "glGenVertexArrays") gl.VertexArrays[n] = new GlState.VertexArray();
                    else gl.Buffers[n] = null;
                }
                return;
            case "glBindVertexArray":
                gl.CurrentVertexArray = Obj(A(0)) is "0" ? null : Obj(A(0));
                return;
            case "glBindBuffer":
            {
                var b = Obj(A(1)) is "0" ? null : Obj(A(1));
                if (A(0).Contains("GL_ARRAY_BUFFER", StringComparison.Ordinal)) gl.ArrayBuffer = b;
                else if (A(0).Contains("GL_ELEMENT_ARRAY_BUFFER", StringComparison.Ordinal) && Vao is { } vao) vao.ElementBuffer = b;
                return;
            }
            case "glBufferData":
            {
                var target = A(0).Contains("GL_ELEMENT_ARRAY_BUFFER", StringComparison.Ordinal) ? Vao?.ElementBuffer : gl.ArrayBuffer;
                if (target is null)
                {
                    scene.Notes.Add(SimNote.Warning("noBufferBound", ("line", line.ToString())));
                    return;
                }
                gl.Buffers[target] = src.Numbers(DataName(A(2)));
                return;
            }
            case "glVertexAttribPointer":
            {
                if (Vao is not { } vao)
                {
                    scene.Notes.Add(SimNote.Error("noVaoBound", ("call", name), ("line", line.ToString())));
                    return;
                }
                int loc = src.Int(A(0)) ?? 0;
                if (!vao.Attributes.TryGetValue(loc, out var attr)) vao.Attributes[loc] = attr = new GlState.Attribute();
                attr.Buffer = gl.ArrayBuffer;
                attr.Size = src.Int(A(1)) ?? 4;
                attr.StrideBytes = src.Int(A(4)) ?? 0;
                attr.OffsetBytes = src.Int(A(5)) ?? 0;
                return;
            }
            case "glEnableVertexAttribArray" or "glDisableVertexAttribArray":
            {
                if (Vao is not { } vao) return;
                int loc = src.Int(A(0)) ?? 0;
                if (!vao.Attributes.TryGetValue(loc, out var attr)) vao.Attributes[loc] = attr = new GlState.Attribute();
                attr.Enabled = name == "glEnableVertexAttribArray";
                return;
            }
            case "glGetUniformLocation":
                if (lhs is not null && CppSource.StringArg(A(1)) is { } uname) gl.Locations[lhs] = uname;
                return;
            case "glPolygonMode":
                gl.Wireframe = A(1).Contains("GL_LINE", StringComparison.Ordinal);
                return;
            case "glEnable" or "glDisable":
            {
                bool on = name == "glEnable";
                if (A(0).Contains("GL_CULL_FACE", StringComparison.Ordinal)) gl.CullFace = on;
                if (A(0).Contains("GL_DEPTH_TEST", StringComparison.Ordinal)) gl.DepthTest = on;
                return;
            }
            case "glCullFace":
                gl.CullFaceMode = A(0).Trim();
                return;
            case "glFrontFace":
                gl.FrontCcw = !A(0).Contains("GL_CW", StringComparison.Ordinal) || A(0).Contains("GL_CCW", StringComparison.Ordinal);
                return;
            case "glDrawArrays":
                Draw(A(0), null, src.Int(A(1)) ?? 0, src.Int(A(2)) ?? 0, name, line);
                return;
            case "glDrawElements":
                Draw(A(0), A(2), src.Int(A(3)) ?? 0, src.Int(A(1)) ?? 0, name, line);
                return;
        }
        if (name.StartsWith("glUniform", StringComparison.Ordinal)) Uniform(name, a, line);
    }

    private GlState.VertexArray? Vao => gl.CurrentVertexArray is { } v && gl.VertexArrays.TryGetValue(v, out var vao) ? vao : null;

    /// <summary>glGenBuffers(1, &amp;VBO) → VBO; glGenBuffers(2, VBOs) → VBOs[0], VBOs[1].</summary>
    private IEnumerable<string> Names(string count, string target)
    {
        int n = src.Int(count) ?? 1;
        var t = Obj(target);
        if (n == 1 && !target.Trim().StartsWith('&') && !t.Contains('[')) return [t + "[0]", t];
        return n == 1 ? [t] : Enumerable.Range(0, n).Select(i => $"{t}[{i}]");
    }

    private void Uniform(string name, IReadOnlyList<string> a, int line)
    {
        if (gl.CurrentProgram is not { } cur || !gl.Programs.TryGetValue(cur, out var program))
        {
            scene.Notes.Add(SimNote.Warning("uniformWithoutProgram", ("call", name), ("line", line.ToString())));
            return;
        }
        var locArg = a.Count > 0 ? a[0] : "";
        string? uniform = gl.Locations.TryGetValue(Obj(locArg), out var u) ? u : null;
        if (uniform is null && locArg.Contains("glGetUniformLocation", StringComparison.Ordinal))
        {
            var m = System.Text.RegularExpressions.Regex.Match(locArg, "\"([^\"]+)\"");
            if (m.Success) uniform = m.Groups[1].Value;
        }
        if (uniform is null) return;
        var values = a.Skip(1).ToList();
        if (name.Contains("Matrix", StringComparison.Ordinal))
        {
            var expr = values.Count >= 3 ? values[2] : "";
            expr = System.Text.RegularExpressions.Regex.Replace(expr, @"^(?:glm::)?value_ptr\s*\((.*)\)$", "$1");
            program.Uniforms[uniform] = t => src.Evaluate(expr, t);
            return;
        }
        if (name.EndsWith('v') && values.Count >= 2)
        {
            var expr = DataName(values[1]);
            program.Uniforms[uniform] = t => src.Evaluate(expr, t);
            return;
        }
        program.Uniforms[uniform] = t =>
        {
            var nums = values.Select(v => src.Evaluate(v, t)?.X ?? 0).ToArray();
            return ShaderValue.Vec(nums);
        };
    }

    private void Link(GlState.ProgramObject program, int line)
    {
        foreach (var s in program.Shaders)
        {
            if (!gl.ShaderObjects.TryGetValue(s, out var so) || so.Source is null) continue;
            if (!so.Compiled)
            {
                scene.Notes.Add(SimNote.Error("notCompiled", ("stage", so.Stage)));
                continue;
            }
            var parsed = ParseShader(so.Source, so.Stage, null);
            if (so.Stage == "vertex") program.Vertex = parsed;
            else if (so.Stage == "fragment") program.Fragment = parsed;
        }
        program.Linked = program.Vertex is not null && program.Fragment is not null;
        if (!program.Linked && program.Shaders.Count > 0 && !scene.Notes.Any(n => n.Key == "shaderSyntax"))
            scene.Notes.Add(SimNote.Error("notLinked", ("line", line.ToString())));
    }

    /// <summary>Parses a shader; a syntax error becomes the log line the learnopengl.com check would print, and a note.</summary>
    private ShaderProgram? ParseShader(string source, string stage, string? file)
    {
        try
        {
            return ShaderParser.ParseProgram(source);
        }
        catch (ShaderSyntaxException e)
        {
            scene.Log.Add($"ERROR::SHADER::{stage.ToUpperInvariant()}::COMPILATION_FAILED");
            scene.Log.Add($"0:{e.Line}: error: {e.Message}");
            scene.Notes.Add(SimNote.Error("shaderSyntax", ("stage", stage), ("file", file ?? stage), ("line", e.Line.ToString()), ("message", e.Message)));
            return null;
        }
    }

    // ---------- learnopengl.com's Shader class (shader_s.h / shader.h) ----------

    private void ShaderClass(string name, string vsFile, string fsFile, int line)
    {
        var program = new GlState.ProgramObject();
        gl.Programs[name] = program;
        if (!gladLoaded)
        {
            scene.Notes.Add(SimNote.Error("gladMissing", ("call", "Shader"), ("line", line.ToString())));
            return;
        }
        foreach (var (file, stage) in new[] { (vsFile, "vertex"), (fsFile, "fragment") })
        {
            var text = project.Find(file);
            if (text is null)
            {
                scene.Log.Add("ERROR::SHADER::FILE_NOT_SUCCESSFULLY_READ: " + file);
                scene.Notes.Add(SimNote.Error("shaderFileMissing", ("file", file)));
                continue;
            }
            var parsed = ParseShader(text, stage, project.PathOf(file));
            if (stage == "vertex")
            {
                program.Vertex = parsed;
                program.VertexFile = project.PathOf(file);
            }
            else
            {
                program.Fragment = parsed;
                program.FragmentFile = project.PathOf(file);
            }
        }
        program.Linked = program.Vertex is not null && program.Fragment is not null;
    }

    private void ShaderMethod(string obj, string method, IReadOnlyList<string> a, int line)
    {
        if (!gl.Programs.TryGetValue(obj, out var program)) return;
        if (method == "use")
        {
            gl.CurrentProgram = obj;
            return;
        }
        if (a.Count < 2 || CppSource.StringArg(a[0]) is not { } uniform) return;
        if (gl.CurrentProgram != obj)
        {
            // glUniform* works on the program in use; the Shader class's setters call glUniform* directly.
            scene.Notes.Add(SimNote.Warning("uniformWithoutProgram", ("call", $"{obj}.{method}"), ("line", line.ToString())));
            return;
        }
        var values = a.Skip(1).ToList();
        program.Uniforms[uniform] = values.Count == 1
            ? t => src.Evaluate(values[0], t)
            : t => ShaderValue.Vec(values.Select(v => src.Evaluate(v, t)?.X ?? 0).ToArray());
    }
}
