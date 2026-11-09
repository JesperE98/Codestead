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
                scene.Width = Int(A(0)) ?? 800;
                scene.Height = Int(A(1)) ?? 600;
                scene.WindowTitle = CppSource.StringArg(A(2)) ?? Eval(A(2))?.Text ?? "";
                return;
            case "gladLoadGLLoader" or "gladLoadGL":
                gladLoaded = true;
                return;
            case "glfwSwapBuffers":
                if (inLoop) scene.Presents = true;
                return;
        }
        if (name == "memcpy")
        {
            Memcpy(a);
            return;
        }
        if (name == "glfwWindowHint" && A(0).Contains("GLFW_SAMPLES", StringComparison.Ordinal))
        {
            scene.Samples = Int(A(1)) ?? 1;
            return;
        }
        if (!name.StartsWith("gl", StringComparison.Ordinal) || name.StartsWith("glfw", StringComparison.Ordinal)) return;
        if (!gladLoaded)
        {
            // Every OpenGL function is a null pointer until GLAD has loaded it: the program would crash here.
            if (!scene.Notes.Any(n => n.Key == "gladMissing")) scene.Notes.Add(SimNote.Error("gladMissing", ("call", name), ("line", line.ToString())));
            return;
        }
        if (AdvancedCall(name, a, lhs, line)) return;
        switch (name)
        {
            case "glClearColor":
            {
                var v = a.Select(x => Eval(x)?.X ?? 0).ToArray();
                if (v.Length == 4)
                {
                    gl.ClearColor = v;
                    gl.ClearColorSet = true;
                }
                return;
            }
            case "glClear":
            {
                if (!inLoop) return;
                bool color = A(0).Contains("GL_COLOR_BUFFER_BIT", StringComparison.Ordinal);
                double? depth = A(0).Contains("GL_DEPTH_BUFFER_BIT", StringComparison.Ordinal) ? 1.0 : null;
                int? stencil = A(0).Contains("GL_STENCIL_BUFFER_BIT", StringComparison.Ordinal) ? 0 : null;
                if (gl.DrawFramebuffer is { } fbo)
                {
                    // A framebuffer object: cleared between the draws of the frame.
                    if (gl.Framebuffers.ContainsKey(fbo)) DrawTarget();
                    scene.Ops.Add(new ClearOp(scene.Draws.Count, fbo, color ? gl.ClearColor.ToArray() : null, depth, stencil));
                    return;
                }
                if (scene.Draws.Count > 0 && scene.Draws.Any(d => d.Target is not null))
                {
                    // The window, after drawing into framebuffer objects (post-processing).
                    scene.Ops.Add(new ClearOp(scene.Draws.Count, null, color ? gl.ClearColor.ToArray() : null, depth, stencil));
                    return;
                }
                if (color)
                {
                    scene.ClearColor = gl.ClearColor.ToArray();
                    scene.Draws.Clear();
                    scene.Ops.Clear();
                }
                return;
            }
            case "glCreateShader":
                if (lhs is not null) gl.ShaderObjects[lhs] = new GlState.ShaderObject { Stage = A(0).Contains("FRAGMENT", StringComparison.Ordinal) ? "fragment" : A(0).Contains("VERTEX", StringComparison.Ordinal) ? "vertex" : A(0).Contains("GEOMETRY", StringComparison.Ordinal) ? "geometry" : "other" };
                return;
            case "glShaderSource":
                if (gl.ShaderObjects.TryGetValue(Obj(A(0)), out var so))
                    so.Source = Eval(Obj(A(2)))?.Text;
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
                gl.CurrentVertexArray = Obj(A(0)) is "0" ? null : ObjOf(A(0), gl.VertexArrays.ContainsKey);
                return;
            case "glBindBuffer":
            {
                var b = Obj(A(1)) is "0" ? null : Obj(A(1));
                if (A(0).Contains("GL_ELEMENT_ARRAY_BUFFER", StringComparison.Ordinal))
                {
                    if (Vao is { } vao) vao.ElementBuffer = b;
                }
                else if (A(0).Contains("GL_UNIFORM_BUFFER", StringComparison.Ordinal)) gl.UniformBuffer = b;
                else if (A(0).Contains("GL_COPY_READ_BUFFER", StringComparison.Ordinal)) gl.CopyReadBuffer = b;
                else if (A(0).Contains("GL_COPY_WRITE_BUFFER", StringComparison.Ordinal)) gl.CopyWriteBuffer = b;
                else if (A(0).Contains("GL_ARRAY_BUFFER", StringComparison.Ordinal)) gl.ArrayBuffer = b;
                return;
            }
            case "glBufferData":
            {
                var target = BufferOf(A(0));
                if (target is null)
                {
                    scene.Notes.Add(SimNote.Warning("noBufferBound", ("line", line.ToString())));
                    return;
                }
                if (A(0).Contains("GL_UNIFORM_BUFFER", StringComparison.Ordinal)) return;
                // glBufferData(…, size, NULL, …) only makes room: glBufferSubData / glMapBuffer fill it later.
                gl.Buffers[target] = A(2).Trim() is "NULL" or "nullptr" or "0"
                    ? Enumerable.Repeat(0.0, Math.Max(0, (Int(A(1)) ?? 0) / 4)).ToList()
                    : Numbers(DataName(A(2)));
                return;
            }
            case "glVertexAttribPointer":
            {
                if (Vao is not { } vao)
                {
                    scene.Notes.Add(SimNote.Error("noVaoBound", ("call", name), ("line", line.ToString())));
                    return;
                }
                int loc = Int(A(0)) ?? 0;
                if (!vao.Attributes.TryGetValue(loc, out var attr)) vao.Attributes[loc] = attr = new GlState.Attribute();
                attr.Buffer = gl.ArrayBuffer;
                attr.Size = Int(A(1)) ?? 4;
                attr.StrideBytes = Int(A(4)) ?? 0;
                attr.OffsetBytes = Int(A(5)) ?? 0;
                return;
            }
            case "glEnableVertexAttribArray" or "glDisableVertexAttribArray":
            {
                if (Vao is not { } vao) return;
                int loc = Int(A(0)) ?? 0;
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
                if (A(0).Contains("GL_STENCIL_TEST", StringComparison.Ordinal)) gl.StencilTest = on;
                if (A(0).Contains("GL_BLEND", StringComparison.Ordinal)) gl.Blend = on;
                if (A(0).Contains("GL_PROGRAM_POINT_SIZE", StringComparison.Ordinal)) gl.ProgramPointSize = on;
                return;
            }
            case "glCullFace":
                gl.CullFaceMode = A(0).Trim();
                return;
            case "glFrontFace":
                gl.FrontCcw = !A(0).Contains("GL_CW", StringComparison.Ordinal) || A(0).Contains("GL_CCW", StringComparison.Ordinal);
                return;
            case "glGenTextures":
                foreach (var n in Names(A(0), A(1))) gl.TextureObjects[n] = new GlState.TextureObject();
                return;
            case "glActiveTexture":
            {
                var m = System.Text.RegularExpressions.Regex.Match(A(0), @"GL_TEXTURE(\d+)(?:\s*\+\s*(\d+))?");
                gl.ActiveUnit = m.Success ? int.Parse(m.Groups[1].Value) + (m.Groups[2].Success ? int.Parse(m.Groups[2].Value) : 0) : 0;
                return;
            }
            case "glBindTexture":
                if (Obj(A(1)) is "0") gl.Units.Remove(gl.ActiveUnit);
                else
                {
                    gl.Units[gl.ActiveUnit] = ObjOf(A(1), gl.TextureObjects.ContainsKey);
                    if (A(0).Contains("GL_TEXTURE_CUBE_MAP", StringComparison.Ordinal) && BoundTexture is { } cube) cube.IsCube = true;
                }
                return;
            case "glTexParameteri" or "glTexParameterf" or "glTexParameterfv" or "glTexParameteriv":
            {
                if (BoundTexture is not { } tex) return;
                var param = A(1);
                var value = Choose(A(2), tex);
                if (param.Contains("WRAP_S", StringComparison.Ordinal)) tex.WrapS = StbImage.WrapOf(value);
                else if (param.Contains("WRAP_T", StringComparison.Ordinal)) tex.WrapT = StbImage.WrapOf(value);
                else if (param.Contains("MIN_FILTER", StringComparison.Ordinal)) tex.MinFilter = A(2).Trim();
                else if (param.Contains("MAG_FILTER", StringComparison.Ordinal)) tex.MagFilter = A(2).Trim();
                else if (param.Contains("BORDER_COLOR", StringComparison.Ordinal)) tex.Border = Numbers(DataName(A(2)))?.Take(4).ToArray();
                return;
            }
            case "glTexImage2D":
                TexImage(a, line);
                return;
            case "glGenerateMipmap":
                if (BoundTexture is { } mt) mt.Mipmaps = mt.Image is not null;
                return;
            case "glDrawArrays":
                Draw(A(0), null, Int(A(1)) ?? 0, Int(A(2)) ?? 0, name, line);
                return;
            case "glDrawElements":
                Draw(A(0), A(2), Int(A(3)) ?? 0, Int(A(1)) ?? 0, name, line);
                return;
        }
        if (name.StartsWith("glUniform", StringComparison.Ordinal)) Uniform(name, a, line);
    }

    /// <summary>
    /// A parameter written as a choice by the texture's format: learnopengl's
    /// <c>format == GL_RGBA ? GL_CLAMP_TO_EDGE : GL_REPEAT</c> (the format follows the loaded image's channels).
    /// </summary>
    private static string Choose(string value, GlState.TextureObject tex)
    {
        var m = System.Text.RegularExpressions.Regex.Match(value, @"^\s*\(?\s*\w+\s*(==|!=)\s*(GL_RGBA|GL_RGB|GL_RED)\s*\)?\s*\?\s*(\w+)\s*:\s*(\w+)\s*$");
        if (!m.Success) return value;
        int channels = tex.Image?.Channels ?? tex.Components;
        int wanted = m.Groups[2].Value switch { "GL_RGBA" => 4, "GL_RGB" => 3, _ => 1 };
        bool yes = (channels == wanted) == (m.Groups[1].Value == "==");
        return yes ? m.Groups[3].Value : m.Groups[4].Value;
    }

    /// <summary>
    /// The OpenGL object an argument names: the variable itself, or the object a variable or expression holds
    /// (unsigned int VAO = rock.meshes[i].VAO; glBindVertexArray(VAO)).
    /// </summary>
    private string ObjOf(string arg, Func<string, bool> known)
    {
        var name = Obj(arg);
        if (known(name)) return name;
        return Eval(arg.Trim())?.Text is { } held && known(held) ? held : name;
    }

    /// <summary>
    /// learnopengl's Model as the program sees it: model.meshes[i].VAO, .indices.size() and model.textures_loaded[i].id
    /// name objects with the mesh's vertex data (location 0 position, 1 normal, 2 texture coordinates) and textures –
    /// what the asteroid field binds to add its per-instance matrices.
    /// </summary>
    private void ModelObjects(string name, Models.ObjModel model, string path)
    {
        bool flipUv = Models.ModelFiles.FlipUVs(src, project);
        bool flipImages = System.Text.RegularExpressions.Regex.IsMatch(src.Code, @"stbi_set_flip_vertically_on_load\s*\(\s*(?:true|1)\s*\)");
        var meshes = new List<ShaderValue>();
        var textures = new List<ShaderValue>();
        var loaded = new Dictionary<string, string>(StringComparer.Ordinal);
        for (int i = 0; i < model.Meshes.Count; i++)
        {
            var mesh = model.Meshes[i];
            var vao = $"{name}.meshes[{i}].VAO";
            var vbo = $"{name}.meshes[{i}].VBO";
            var ebo = $"{name}.meshes[{i}].EBO";
            var data = new List<double>();
            for (int v = 0; v < mesh.Positions.Count; v++)
            {
                data.AddRange(mesh.Positions[v]);
                data.AddRange(mesh.Normals[v]);
                data.Add(mesh.TexCoords[v][0]);
                data.Add(flipUv ? 1 - mesh.TexCoords[v][1] : mesh.TexCoords[v][1]);
            }
            gl.Buffers[vbo] = data;
            gl.Buffers[ebo] = mesh.Indices.Select(x => (double)x).ToList();
            var array = new GlState.VertexArray { ElementBuffer = ebo };
            array.Attributes[0] = new GlState.Attribute { Buffer = vbo, Size = 3, StrideBytes = 32, OffsetBytes = 0, Enabled = true };
            array.Attributes[1] = new GlState.Attribute { Buffer = vbo, Size = 3, StrideBytes = 32, OffsetBytes = 12, Enabled = true };
            array.Attributes[2] = new GlState.Attribute { Buffer = vbo, Size = 2, StrideBytes = 32, OffsetBytes = 24, Enabled = true };
            gl.VertexArrays[vao] = array;
            meshes.Add(ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
            {
                ["VAO"] = ShaderValue.Str(vao),
                ["indices"] = ShaderValue.Array(mesh.Indices.Select(_ => ShaderValue.Scalar(0)).ToArray()),
            }));
            foreach (var file in new[] { mesh.Material?.DiffuseMap, mesh.Material?.SpecularMap, mesh.Material?.NormalMap })
            {
                if (file is null || loaded.ContainsKey(file)) continue;
                var texName = $"{name}.textures_loaded[{textures.Count}].id";
                var tex = Models.ModelFiles.Texture(project, path, file, flipImages);
                gl.TextureObjects[texName] = new GlState.TextureObject { Image = tex?.Image, Components = tex?.Components ?? 4, MinFilter = "GL_LINEAR_MIPMAP_LINEAR", Mipmaps = true };
                loaded[file] = texName;
                textures.Add(ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal) { ["id"] = ShaderValue.Str(texName) }));
            }
        }
        env.Runner.Globals[name] = ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
        {
            ["meshes"] = ShaderValue.Array(meshes.ToArray()),
            ["textures_loaded"] = ShaderValue.Array(textures.ToArray()),
        });
    }

    private GlState.TextureObject? BoundTexture =>
        gl.Units.TryGetValue(gl.ActiveUnit, out var name) && gl.TextureObjects.TryGetValue(name, out var t) ? t : null;

    /// <summary>
    /// glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data): the image stb_image loaded
    /// into <c>data</c>. A format with another number of channels than the data reads the bytes wrongly, as on a real GPU.
    /// </summary>
    private void TexImage(IReadOnlyList<string> a, int line)
    {
        if (BoundTexture is not { } tex || a.Count < 9)
        {
            scene.Notes.Add(SimNote.Warning("noTextureBound", ("line", line.ToString())));
            return;
        }
        // A cube map face: GL_TEXTURE_CUBE_MAP_POSITIVE_X + i.
        int face = -1;
        var faceMatch = System.Text.RegularExpressions.Regex.Match(a[0].Trim(), @"GL_TEXTURE_CUBE_MAP_(POSITIVE|NEGATIVE)_([XYZ])\s*(?:\+\s*(.+))?$");
        if (faceMatch.Success)
        {
            face = "XYZ".IndexOf(faceMatch.Groups[2].Value[0]) * 2 + (faceMatch.Groups[1].Value == "NEGATIVE" ? 1 : 0)
                + (faceMatch.Groups[3].Success ? Int(faceMatch.Groups[3].Value) ?? 0 : 0);
            tex.IsCube = true;
        }
        var data = DataName(a[8]);
        if (data is "NULL" or "nullptr" or "0")
        {
            // No data: the texture is drawn into (a framebuffer's colour or depth attachment).
            tex.Width = Int(a[3]) ?? 0;
            tex.Height = Int(a[4]) ?? 0;
            tex.Float = IsFloatFormat(a[2]);
            tex.IsDepth = a[2].Contains("DEPTH", StringComparison.Ordinal);
            tex.Components = 4;
            return;
        }
        var loaded = images.LastOrDefault(i => i.Variable == data && i.Offset < statementOffset);
        var image = loaded?.Image;
        if (loaded is not null && image is null && loaded.File == "" && Eval(loaded.Arg)?.Text is { } path)
        {
            // stbi_load(path, …) inside a helper: the path is the helper's argument.
            image = StbImage.Load(project, path, loaded.Flip, loaded.Wanted);
            if (image is null) scene.Notes.Add(SimNote.Error("textureFileMissing", ("file", path)));
            loaded = loaded with { File = path };
        }
        if (image is null) return;
        int components = Components(a[6]);
        // A format in a variable (learnopengl's loadTexture: GL_RED / GL_RGB / GL_RGBA by nrComponents) fits the image.
        tex.Components = components == 4 || (components == 0 && image.Channels == 4) ? 4 : 3;
        var uploaded = image.Channels == components || components == 0 ? image : Reinterpret(image, image.Channels, components);
        if (face >= 0)
        {
            if (face < 6) tex.Faces[face] = uploaded;
        }
        else tex.Image = uploaded;
        if (image.Channels != components && components != 0)
            scene.Notes.Add(SimNote.Warning("textureFormatMismatch", ("file", loaded!.File), ("channels", image.Channels.ToString()), ("format", a[6].Trim())));
        tex.Mipmaps = false;
    }

    private static int Components(string format) => format.Trim() switch
    {
        "GL_RGBA" or "GL_BGRA" => 4,
        "GL_RGB" or "GL_BGR" => 3,
        "GL_RG" => 2,
        "GL_RED" => 1,
        _ => 0,
    };

    /// <summary>The bytes of an image with <paramref name="actual"/> channels read as if it had <paramref name="assumed"/>.</summary>
    private static Textures.Image Reinterpret(Textures.Image image, int actual, int assumed)
    {
        int n = image.Width * image.Height;
        var packed = new byte[n * actual];
        for (int i = 0; i < n; i++)
            for (int k = 0; k < actual; k++) packed[i * actual + k] = image.Rgba[i * 4 + Math.Min(k, 3)];
        var rgba = new byte[n * 4];
        for (int i = 0; i < n; i++)
        {
            for (int k = 0; k < 4; k++)
            {
                int at = i * assumed + Math.Min(k, assumed - 1);
                rgba[i * 4 + k] = k < assumed ? (at < packed.Length ? packed[at] : (byte)0) : (k == 3 ? (byte)255 : rgba[i * 4]);
            }
        }
        return image with { Rgba = rgba, Channels = assumed };
    }

    private GlState.VertexArray? Vao => gl.CurrentVertexArray is { } v && gl.VertexArrays.TryGetValue(v, out var vao) ? vao : null;

    /// <summary>glGenBuffers(1, &amp;VBO) → VBO; glGenBuffers(2, VBOs) → VBOs[0], VBOs[1].</summary>
    private IEnumerable<string> Names(string count, string target)
    {
        int n = Int(count) ?? 1;
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
            var matrix = Eval(expr);
            program.Uniforms[uniform] = _ => matrix;
            return;
        }
        if (name.EndsWith('v') && values.Count >= 2)
        {
            var vector = Eval(DataName(values[1]));
            program.Uniforms[uniform] = _ => vector;
            return;
        }
        // Evaluated now: a uniform set inside a loop has the loop's value for the draw that follows.
        var nums = ShaderValue.Vec(values.Select(v => Eval(v)?.X ?? 0).ToArray());
        program.Uniforms[uniform] = _ => nums;
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
            else if (so.Stage == "geometry") program.Geometry = parsed;
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

    private void ShaderClass(string name, string vsFile, string fsFile, string? gsFile, int line)
    {
        var program = new GlState.ProgramObject();
        gl.Programs[name] = program;
        if (!gladLoaded)
        {
            scene.Notes.Add(SimNote.Error("gladMissing", ("call", "Shader"), ("line", line.ToString())));
            return;
        }
        var files = new List<(string, string)> { (vsFile, "vertex"), (fsFile, "fragment") };
        if (gsFile is not null) files.Add((gsFile, "geometry"));
        foreach (var (file, stage) in files)
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
            else if (stage == "geometry")
            {
                program.Geometry = parsed;
                program.GeometryFile = project.PathOf(file);
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
        if (method == "Draw" && models.TryGetValue(obj, out var model))
        {
            DrawModel(model.Model, model.Path, a.Count > 0 ? Obj(a[0]) : "", line);
            return;
        }
        if (!gl.Programs.TryGetValue(obj, out var program)) return;
        if (method == "use")
        {
            gl.CurrentProgram = obj;
            return;
        }
        if (a.Count < 2 || (CppSource.StringArg(a[0]) ?? Eval(a[0])?.Text) is not { } uniform) return;
        if (gl.CurrentProgram != obj)
        {
            // glUniform* works on the program in use; the Shader class's setters call glUniform* directly.
            scene.Notes.Add(SimNote.Warning("uniformWithoutProgram", ("call", $"{obj}.{method}"), ("line", line.ToString())));
            return;
        }
        var values = a.Skip(1).ToList();
        var value = values.Count == 1 ? Eval(values[0]) : ShaderValue.Vec(values.Select(v => Eval(v)?.X ?? 0).ToArray());
        program.Uniforms[uniform] = _ => value;
    }
}
