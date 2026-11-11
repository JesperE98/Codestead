using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

// The OpenGL, GLFW and GLAD calls the simulator follows, and learnopengl.com's Shader class.
public sealed partial class GlReader
{
    private void Call(string name, IReadOnlyList<string> a, string? lhs, int line)
    {
        string A(int i) => i < a.Count ? a[i] : "";
        if (DebugCall(name, a)) return;
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
            case "glfwSetWindowTitle":
                // The title a program sets while it runs (the frame's counts: "drawn: 37 / 101"): the window shows it.
                if (inLoop && (CppSource.StringArg(A(1)) ?? Eval(A(1))?.Text) is { } title) scene.WindowTitle = title;
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
                ClearBound(A(0).Contains("GL_COLOR_BUFFER_BIT", StringComparison.Ordinal) ? gl.ClearColor.ToArray() : null,
                    A(0).Contains("GL_DEPTH_BUFFER_BIT", StringComparison.Ordinal) ? 1.0 : null,
                    A(0).Contains("GL_STENCIL_BUFFER_BIT", StringComparison.Ordinal) ? 0 : null);
                return;
            case "glClearBufferfv" or "glClearBufferiv" or "glClearBufferuiv" or "glClearBufferfi":
            {
                // One buffer of the bound framebuffer with a value of its own: colour attachment i (GL_COLOR, i, rgba),
                // the depth (GL_DEPTH, 0, &depth), the stencil, or both (glClearBufferfi(GL_DEPTH_STENCIL, 0, d, s)).
                var values = name == "glClearBufferfi" ? null : Numbers(DataName(A(2)));
                if (A(0).Contains("GL_COLOR", StringComparison.Ordinal) && values is { Count: > 0 })
                    ClearBound(values.Take(4).Concat(Enumerable.Repeat(0.0, Math.Max(0, 4 - values.Count))).ToArray(), null, null, Int(A(1)) ?? 0);
                else if (A(0).Contains("GL_DEPTH_STENCIL", StringComparison.Ordinal)) ClearBound(null, Eval(A(2))?.X ?? 1, Int(A(3)) ?? 0);
                else if (A(0).Contains("GL_DEPTH", StringComparison.Ordinal) && values is { Count: > 0 }) ClearBound(null, values[0], null);
                else if (A(0).Contains("GL_STENCIL", StringComparison.Ordinal) && values is { Count: > 0 }) ClearBound(null, null, (int)values[0]);
                return;
            }
            case "glCreateShader":
                if (lhs is not null) gl.ShaderObjects[lhs] = new GlState.ShaderObject { Stage = A(0).Contains("FRAGMENT", StringComparison.Ordinal) ? "fragment" : A(0).Contains("VERTEX", StringComparison.Ordinal) ? "vertex" : A(0).Contains("GEOMETRY", StringComparison.Ordinal) ? "geometry" : "other" };
                if (lhs is not null) OwnName("shader", lhs, own => gl.ShaderObjects[own] = gl.ShaderObjects[lhs]);
                return;
            case "glShaderSource":
                if (gl.ShaderObjects.TryGetValue(ObjOf(A(0), gl.ShaderObjects.ContainsKey), out var so))
                    so.Source = Eval(Obj(A(2)))?.Text;
                return;
            case "glCompileShader":
                if (gl.ShaderObjects.TryGetValue(ObjOf(A(0), gl.ShaderObjects.ContainsKey), out var cs)) cs.Compiled = true;
                return;
            case "glCreateProgram":
                if (lhs is not null)
                {
                    gl.Programs[lhs] = new GlState.ProgramObject();
                    OwnName("program", lhs, own => gl.Programs[own] = gl.Programs[lhs]);
                }
                return;
            case "glAttachShader":
                if (gl.Programs.TryGetValue(ObjOf(A(0), gl.Programs.ContainsKey), out var ap)) ap.Shaders.Add(ObjOf(A(1), gl.ShaderObjects.ContainsKey));
                return;
            case "glLinkProgram":
                if (gl.Programs.TryGetValue(ObjOf(A(0), gl.Programs.ContainsKey), out var lp)) Link(lp, line);
                return;
            case "glUseProgram":
                gl.CurrentProgram = Obj(A(0)) is "0" ? null : ObjOf(A(0), gl.Programs.ContainsKey);
                return;
            case "glGenVertexArrays" or "glGenBuffers":
            {
                var generated = Names(A(0), A(1)).ToList();
                foreach (var n in generated)
                {
                    if (name == "glGenVertexArrays") gl.VertexArrays[n] = new GlState.VertexArray();
                    else
                    {
                        // The same variable name again (a local `unsigned int VBO;` in two functions): the buffer made before
                        // keeps its data under a name of its own, and what refers to it (a VAO's attributes) follows.
                        if (gl.Buffers.ContainsKey(n)) RetireBuffer(n);
                        gl.Buffers[n] = null;
                    }
                }
                // A buffer's data is kept by name: its own name is an alias that later writes keep in step (see Alias).
                if (generated.Count <= 2 && name == "glGenVertexArrays") OwnName("vao", A(1), own => gl.VertexArrays[own] = gl.VertexArrays[generated[^1]]);
                else if (generated.Count <= 2) OwnName("buffer", A(1), own => bufferAliases[own] = generated[^1]);
                return;
            }
            case "glBindVertexArray":
                gl.CurrentVertexArray = Obj(A(0)) is "0" ? null : ObjOf(A(0), gl.VertexArrays.ContainsKey);
                return;
            case "glBindBuffer":
            {
                var b = Obj(A(1)) is "0" ? null : BufferName(A(1));
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
                if (A(0).Contains("GL_BLEND", StringComparison.Ordinal))
                {
                    gl.Blend = on;
                    // For every draw buffer: one switched off with glDisablei follows again.
                    foreach (var off in gl.BufferBlends.Where(kv => kv.Value is null).Select(kv => kv.Key).ToList()) gl.BufferBlends.Remove(off);
                }
                if (A(0).Contains("GL_PROGRAM_POINT_SIZE", StringComparison.Ordinal)) gl.ProgramPointSize = on;
                if (A(0).Contains("GL_FRAMEBUFFER_SRGB", StringComparison.Ordinal)) scene.WindowSrgb = on;
                return;
            }
            case "glCullFace":
                gl.CullFaceMode = A(0).Trim();
                return;
            case "glFrontFace":
                gl.FrontCcw = !A(0).Contains("GL_CW", StringComparison.Ordinal) || A(0).Contains("GL_CCW", StringComparison.Ordinal);
                return;
            case "glGenTextures":
            {
                var names = Names(A(0), A(1)).ToList();
                foreach (var n in names) gl.TextureObjects[n] = new GlState.TextureObject();
                if (names.Count <= 2) OwnName("texture", A(1), own => gl.TextureObjects[own] = gl.TextureObjects[names[^1]]);
                return;
            }
            case "glPixelStorei":
                if (A(0).Contains("UNPACK_ALIGNMENT", StringComparison.Ordinal)) gl.UnpackAlignment = Math.Max(1, Int(A(1)) ?? 4);
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
                    (A(0).Contains("GL_TEXTURE_CUBE_MAP", StringComparison.Ordinal) ? gl.UnitsCube : gl.Units2D)[gl.ActiveUnit] = gl.Units[gl.ActiveUnit];
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
            case "glTexImage3D" when BoundTexture is { } array && a.Count >= 10 && DataName(a[9]) is "NULL" or "nullptr" or "0":
                // A texture array with no data (glTexImage3D(GL_TEXTURE_2D_ARRAY, 0, GL_DEPTH_COMPONENT32F, w, h, layers, …)):
                // drawn into layer by layer (cascaded shadow maps).
                array.Width = Int(a[3]) ?? 0;
                array.Height = Int(a[4]) ?? 0;
                array.Layers = Math.Max(1, Int(a[5]) ?? 1);
                array.Float = IsFloatFormat(a[2]);
                array.IsDepth = a[2].Contains("DEPTH", StringComparison.Ordinal);
                array.Components = 4;
                return;
            case "glGenerateMipmap" when BoundTexture is not { } noBase || noBase.Image is null && !noBase.IsCube && noBase.Framebuffer is null && noBase.Width == 0:
                GlError(GlInvalidOperation, "GL_INVALID_OPERATION in glGenerateMipmap(zero size base image)");
                return;
            case "glGenerateMipmap":
                if (BoundTexture is { } mt)
                {
                    mt.Mipmaps = mt.Image is not null || mt.IsCube || mt.Framebuffer is not null;
                    GenerateTargetMips(mt);
                }
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
    /// Clears the bound framebuffer: a colour (all attachments, or only <paramref name="attachment"/>), the depth, the
    /// stencil.
    /// </summary>
    private void ClearBound(double[]? color, double? depth, int? stencil, int? attachment = null)
    {
        // Before the render loop only a framebuffer object's clears count (a capture pass drawn once).
        if (!inLoop && (gl.DrawFramebuffer is not { } setupFbo || !gl.Framebuffers.ContainsKey(setupFbo))) return;
        if (gl.DrawFramebuffer is { } fbo)
        {
            // A framebuffer object: cleared between the draws of the frame.
            var cleared = gl.Framebuffers.ContainsKey(fbo) ? DrawTarget() ?? fbo : fbo;
            scene.Ops.Add(new ClearOp(scene.Draws.Count, cleared, color, depth, stencil, attachment));
            return;
        }
        if (scene.Draws.Count > 0 && scene.Draws.Any(d => d.Target is not null))
        {
            // The window, after drawing into framebuffer objects (post-processing).
            scene.Ops.Add(new ClearOp(scene.Draws.Count, null, color, depth, stencil));
            return;
        }
        if (color is not null)
        {
            scene.ClearColor = color;
            scene.Draws.Clear();
            scene.Ops.Clear();
        }
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
        // cond ? a : b (learnopengl's first_iteration ? colorBuffers[1] : pingpongColorbuffers[!horizontal]): the branch the
        // condition picks now.
        var choice = System.Text.RegularExpressions.Regex.Match(arg.Trim(), @"^([^?]+)\?([^:]+):(.+)$");
        if (choice.Success && Eval(choice.Groups[1].Value.Trim()) is { V: { Length: > 0 } cond })
            return ObjOf(cond[0] != 0 ? choice.Groups[2].Value : choice.Groups[3].Value, known);
        // The object the variable holds (its own name, "program#3"), before the expression's text: the text
        // (shader.ID) names whichever object was made last through it, a copy of the struct holds its own.
        var held = Eval(arg.Trim())?.Text;
        if (held is not null && held.Contains('#') && known(held)) return held;
        var name = Obj(arg);
        if (known(name)) return name;
        return held is not null && known(held) ? held : name;
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
                ["indices"] = ShaderValue.Array(mesh.Indices.Select(i => ShaderValue.Integer(i)).ToArray()),
                // mesh.h's Vertex: what a program reads of the model's vertices (a bounding volume around them).
                ["vertices"] = ShaderValue.Array(Enumerable.Range(0, mesh.Positions.Count).Select(v => ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
                {
                    ["Position"] = ShaderValue.Vec(mesh.Positions[v].ToArray()),
                    ["Normal"] = ShaderValue.Vec(mesh.Normals[v].ToArray()),
                    ["TexCoords"] = ShaderValue.Vec(mesh.TexCoords[v][0], flipUv ? 1 - mesh.TexCoords[v][1] : mesh.TexCoords[v][1]),
                })).ToArray()),
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
        env.Runner.Globals[name] = new ShaderValue
        {
            Fields = new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
            {
                ["meshes"] = ShaderValue.Array(meshes.ToArray()),
                ["textures_loaded"] = ShaderValue.Array(textures.ToArray()),
                [ModelMark] = ShaderValue.Str(name),
            },
            Shared = true,
        };
    }

    /// <summary>
    /// A member of a Model's value that names the model: a pointer to it kept in a struct (Model* pModel = &amp;ourModel)
    /// is a copy once the struct is copied (into a std::vector), and still says which model it draws.
    /// </summary>
    private const string ModelMark = "__model";

    /// <summary>
    /// A buffer an argument names: the variable it was generated into, also through a copy of its value
    /// (renderer.quadVBO after the renderer struct was copied).
    /// </summary>
    private int retiredBuffers;

    private void RetireBuffer(string name)
    {
        var retired = $"{name}@{++retiredBuffers}";
        gl.Buffers[retired] = gl.Buffers[name];
        string? Moved(string? b) => b == name ? retired : b;
        foreach (var vao in gl.VertexArrays.Values.Distinct())
        {
            vao.ElementBuffer = Moved(vao.ElementBuffer);
            foreach (var attribute in vao.Attributes.Values) attribute.Buffer = Moved(attribute.Buffer);
        }
        gl.UniformBuffer = Moved(gl.UniformBuffer);
        gl.CopyReadBuffer = Moved(gl.CopyReadBuffer);
        gl.CopyWriteBuffer = Moved(gl.CopyWriteBuffer);
        gl.ArrayBuffer = Moved(gl.ArrayBuffer);
        foreach (var own in bufferAliases.Where(kv => kv.Value == name).Select(kv => kv.Key).ToList()) bufferAliases[own] = retired;
    }

    private string BufferName(string arg)
    {
        var name = Obj(arg);
        if (gl.Buffers.ContainsKey(name)) return name;
        return Eval(arg.Trim())?.Text is { } held && bufferAliases.TryGetValue(held, out var original) ? original : name;
    }

    /// <summary>A buffer's own name (buffer#3) → the variable it was generated into, which holds its data.</summary>
    private readonly Dictionary<string, string> bufferAliases = new(StringComparer.Ordinal);

    private int objectCount;

    /// <summary>
    /// An object created into a variable (glGenTextures(1, &amp;texture), shader.ID = glCreateProgram()) also gets a
    /// name of its own, which the variable now holds: an object made in a loop (a glyph's texture per character) stays
    /// itself when the variable gets the next one, and a copy of the value (a struct field, a map entry, a function's
    /// return value) still names it.
    /// </summary>
    private void OwnName(string kind, string variable, Action<string> register)
    {
        var target = variable.Trim().TrimStart('&').Trim();
        if (!System.Text.RegularExpressions.Regex.IsMatch(target, @"^[A-Za-z_][\w.\[\]>-]*$")) return;
        var own = $"{kind}#{++objectCount}";
        register(own);
        try
        {
            env.Runner.Assign(ShaderParser.ParseExpression(CppSource.Prepare(target)), ShaderValue.Str(own));
        }
        catch (ShaderSyntaxException)
        {
        }
        catch (ShaderRuntimeException)
        {
        }
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
        // Not a texture target (glTexImage2D(GL_FRAMEBUFFER, …): learnopengl's debugging mistake): an error, no upload.
        var targetName = a[0].Trim();
        if (System.Text.RegularExpressions.Regex.IsMatch(targetName, @"^GL_[A-Z0-9_]+$") && !System.Text.RegularExpressions.Regex.IsMatch(targetName, @"^GL_(?:PROXY_)?TEXTURE_(?:2D|1D_ARRAY|RECTANGLE|CUBE_MAP)"))
        {
            GlError(GlInvalidEnum, $"GL_INVALID_ENUM in glTexImage2D(target={targetName})");
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
        if (data is "NULL" or "nullptr" or "0" || Eval(data)?.Text is "nullptr" or "NULL")
        {
            // No data: the texture is drawn into (a framebuffer's colour or depth attachment).
            tex.Width = Int(a[3]) ?? 0;
            tex.Height = Int(a[4]) ?? 0;
            tex.Float = IsFloatFormat(a[2]);
            tex.IsDepth = a[2].Contains("DEPTH", StringComparison.Ordinal);
            tex.Components = 4;
            // An empty image (a space's glyph: 0 × 0): a texture with nothing in it, which reads 0.
            if (tex.Width == 0 || tex.Height == 0) tex.Image = new Textures.Image(1, 1, 4, [0, 0, 0, 0], [0, 0, 0, 0]);
            return;
        }
        // The image the data names: one loaded while the program ran (its variable holds its name), or the last
        // stbi_load into a variable of that name before this call.
        var loaded = Eval(data)?.Text is { } held && loadedImages.TryGetValue(held, out var remembered) ? remembered
            : images.LastOrDefault(i => i.Variable == data && i.Offset < statementOffset);
        var image = loaded?.Image;
        if (loaded is not null && image is null && loaded.File == "" && Eval(loaded.Arg)?.Text is { } path)
        {
            // stbi_load(path, …) inside a helper: the path is the helper's argument.
            image = StbImage.Load(project, path, loaded.Flip, loaded.Wanted);
            if (image is null) scene.Notes.Add(SimNote.Error("textureFileMissing", ("file", path)));
            loaded = loaded with { File = path };
        }
        // Data computed by the program (the SSAO noise: std::vector<glm::vec3> ssaoNoise, &ssaoNoise[0]): its numbers,
        // GL_FLOAT values as they are, row by row from the bottom (OpenGL's first row is v = 0).
        if (image is null && loaded is null && Numbers(data) is { Count: > 0 } values && Int(a[3]) is int w && Int(a[4]) is int h && w > 0 && h > 0)
        {
            int per = Math.Max(1, Components(a[6]));
            // Bytes (GL_UNSIGNED_BYTE: a FreeType glyph's coverage) are 0–255; each row starts at a multiple of
            // GL_UNPACK_ALIGNMENT (4 unless glPixelStorei says otherwise) – learnopengl sets 1 for its glyphs.
            bool ofBytes = a[7].Contains("UNSIGNED_BYTE", StringComparison.Ordinal);
            int rowLength = ofBytes ? (w * per + gl.UnpackAlignment - 1) / gl.UnpackAlignment * gl.UnpackAlignment : w * per;
            var floats = new double[w * h * 4];
            var bytes = new byte[w * h * 4];
            for (int i = 0; i < w * h; i++)
                for (int k = 0; k < 4; k++)
                {
                    int at = i / w * rowLength + i % w * per + k;
                    double v = k < per ? (at < values.Count ? values[at] : 0) : (k == 3 ? 1 : 0);
                    if (ofBytes && k < per) v /= 255.0;
                    floats[i * 4 + k] = v;
                    bytes[i * 4 + k] = (byte)Math.Round(Math.Clamp(v, 0, 1) * 255);
                }
            tex.Components = per == 4 ? 4 : 3;
            tex.Float = IsFloatFormat(a[2]) || a[7].Contains("FLOAT", StringComparison.Ordinal);
            var computed = new Textures.Image(w, h, 4, bytes, floats);
            if (face >= 0) { if (face < 6) tex.Faces[face] = computed; }
            else tex.Image = computed;
            tex.Mipmaps = false;
            return;
        }
        if (image is null) return;
        // The internal format: GL_SRGB / GL_SRGB_ALPHA (also through a variable: learnopengl's loadTexture with gammaCorrection).
        tex.Srgb = a[2].Contains("SRGB", StringComparison.Ordinal) || (Eval(a[2])?.Text ?? "").Contains("SRGB", StringComparison.Ordinal);
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
            GlError(GlInvalidOperation, name.StartsWith("glUniformMatrix", StringComparison.Ordinal) ? "GL_INVALID_OPERATION in glUniformMatrix(program not linked)" : "GL_INVALID_OPERATION in glUniform(program not linked)");
            return;
        }
        var locArg = a.Count > 0 ? a[0] : "";
        string? uniform = gl.Locations.TryGetValue(Obj(locArg), out var u) ? u : null;
        if (uniform is null && locArg.Contains("glGetUniformLocation", StringComparison.Ordinal))
        {
            var m = System.Text.RegularExpressions.Regex.Match(locArg, "\"([^\"]+)\"");
            if (m.Success) uniform = m.Groups[1].Value;
            // The name in a variable (SetMatrix4(shader, const char* name, …): glGetUniformLocation(shader.ID, name)).
            else if (System.Text.RegularExpressions.Regex.Match(locArg, @"glGetUniformLocation\s*\((.*)\)\s*$") is { Success: true } call
                && CppSource.SplitArgs(call.Groups[1].Value) is { Count: 2 } locationArgs && Eval(locationArgs[1].Trim())?.Text is { Length: > 0 } named)
                uniform = named;
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
            // glUniform3fv(loc, 4, &lightPositions[0][0]): with a count above 1, the whole array.
            var data = DataName(values[1]);
            if ((Eval(values[0])?.X ?? 1) > 1) data = System.Text.RegularExpressions.Regex.Replace(data, @"(?:\s*\[\s*0\s*\])+$", "");
            var vector = Eval(data);
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
        obj = ResolveAlias(System.Text.RegularExpressions.Regex.Replace(obj, @"\s+", ""));
        if (!gl.Programs.ContainsKey(obj) && !models.ContainsKey(obj) && System.Text.RegularExpressions.Regex.IsMatch(obj, @"\.|->|\["))
        {
            // Through a member or a pointer (entity.pModel->Draw(shader), renderer.shader.use()): the model the value
            // is (a copy of a Model carries its name), else the object its last name is.
            obj = Eval(obj) is { Fields: { } fields } && fields.TryGetValue(ModelMark, out var mark) && mark.Text is { } modelName
                ? modelName : ResolveAlias(System.Text.RegularExpressions.Regex.Match(obj, @"(\w+)$").Groups[1].Value);
        }
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
            GlError(GlInvalidOperation, method.StartsWith("setMat", StringComparison.Ordinal) ? "GL_INVALID_OPERATION in glUniformMatrix(program not linked)" : "GL_INVALID_OPERATION in glUniform(program not linked)");
            return;
        }
        var values = a.Skip(1).ToList();
        var value = values.Count == 1 ? Eval(values[0]) : ShaderValue.Vec(values.Select(v => Eval(v)?.X ?? 0).ToArray());
        program.Uniforms[uniform] = _ => value;
    }
}
