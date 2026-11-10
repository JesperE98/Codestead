using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

// glDrawArrays and glDrawElements: the vertex data comes from the bound vertex array object, as on a real GPU.
public sealed partial class GlReader
{
    private void Draw(string mode, string? indexType, int first, int count, string call, int line, int instances = 1)
    {
        // A frame before the one shown (a game's earlier frames): what it draws is not kept.
        if (discardDraws) return;
        var lineText = line.ToString();
        if (gl.CurrentProgram is not { } cur || !gl.Programs.TryGetValue(cur, out var program))
        {
            scene.Notes.Add(SimNote.Error("noProgram", ("call", call), ("line", lineText)));
            return;
        }
        if (!program.Linked || program.Vertex is null || program.Fragment is null) return;
        if (Vao is not { } vao)
        {
            scene.Notes.Add(SimNote.Error("noVaoBound", ("call", call), ("line", lineText)));
            return;
        }
        int[]? indices = null;
        if (indexType is not null)
        {
            if (vao.ElementBuffer is null || !gl.Buffers.TryGetValue(vao.ElementBuffer, out var data) || data is null)
            {
                scene.Notes.Add(SimNote.Error("noElementBuffer", ("line", lineText)));
                return;
            }
            int size = indexType.Contains("SHORT", StringComparison.Ordinal) ? 2 : indexType.Contains("BYTE", StringComparison.Ordinal) ? 1 : 4;
            int skip = first / size;
            if (skip + count > data.Count)
            {
                scene.Notes.Add(SimNote.Warning("tooManyIndices", ("count", count.ToString()), ("have", data.Count.ToString())));
                count = Math.Max(0, data.Count - skip);
            }
            indices = data.Skip(skip).Take(count).Select(d => (int)d).ToArray();
            first = 0;
        }
        int vertexCount = indices is null ? first + count : (indices.Length == 0 ? 0 : indices.Max() + 1);

        // The vertex shader's inputs, by location.
        var inputs = program.Vertex.Globals.Where(g => g.Storage == "in").ToList();
        var vertices = new List<Dictionary<string, ShaderValue>>();
        bool pastEnd = false;
        for (int v = 0; v < vertexCount; v++)
        {
            var dict = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
            foreach (var (loc, attr) in vao.Attributes)
            {
                if (attr.Divisor > 0 || !attr.Enabled || attr.Buffer is null || !gl.Buffers.TryGetValue(attr.Buffer, out var data) || data is null) continue;
                int stride = attr.StrideBytes == 0 ? attr.Size : attr.StrideBytes / 4;
                int start = attr.OffsetBytes / 4 + v * stride;
                var comps = new double[attr.Size];
                for (int k = 0; k < attr.Size; k++)
                {
                    if (start + k < data.Count) comps[k] = data[start + k];
                    else pastEnd = true;
                }
                dict[loc.ToString()] = ShaderValue.Vec(comps);
            }
            vertices.Add(dict);
        }
        if (pastEnd) scene.Notes.Add(SimNote.Warning("readsPastEnd", ("call", call), ("line", lineText)));
        foreach (var input in inputs)
        {
            int loc = input.Location ?? inputs.IndexOf(input);
            if (!vao.Attributes.TryGetValue(loc, out var a) || !a.Enabled)
                scene.Notes.Add(SimNote.Warning("attribDisabled", ("location", loc.ToString()), ("name", input.Id)));
        }

        // Per-instance attributes (glVertexAttribDivisor): one value per instance (per divisor instances).
        List<Dictionary<string, ShaderValue>>? perInstance = null;
        int divisor = 1;
        foreach (var (loc, attr) in vao.Attributes.Where(x => x.Value.Divisor > 0 && x.Value.Enabled))
        {
            if (attr.Buffer is null || !gl.Buffers.TryGetValue(attr.Buffer, out var data) || data is null) continue;
            divisor = attr.Divisor;
            int stride = attr.StrideBytes == 0 ? attr.Size : attr.StrideBytes / 4;
            int n = Math.Max(1, (instances + divisor - 1) / divisor);
            perInstance ??= Enumerable.Range(0, n).Select(_ => new Dictionary<string, ShaderValue>(StringComparer.Ordinal)).ToList();
            for (int i = 0; i < n && i < perInstance.Count; i++)
            {
                int start = attr.OffsetBytes / 4 + i * stride;
                perInstance[i][loc.ToString()] = ShaderValue.Vec(Enumerable.Range(0, attr.Size).Select(k => start + k < data.Count ? data[start + k] : 0).ToArray());
            }
        }

        var draw = MakeDraw(program, vertices, indices, indices is null ? first : 0, indices?.Length ?? count, TopologyOf(mode), instances, perInstance, divisor);
        // Before the render loop, what is drawn into a framebuffer object stays for every frame (a capture pass).
        if (inLoop || draw.Target is not null) scene.Draws.Add(draw);
        else setupDraws.Add(draw);
    }

    /// <summary>A draw with the program's shaders and uniforms, its textures and the current fixed-function state.</summary>
    private DrawCall MakeDraw(GlState.ProgramObject program, List<Dictionary<string, ShaderValue>> vertices, int[]? indices, int first, int count,
        Topology topology, int instances = 1, List<Dictionary<string, ShaderValue>>? perInstance = null, int divisor = 1,
        Func<string, double, double, double[]>? textures = null)
    {
        var uniforms = program.Uniforms.ToList();
        var blocks = BlockUniforms(program);
        // A model brings its own textures (its materials): the texture units are not read then.
        var (samplers, cubes) = textures is null ? Samplers(program) : (null, null);
        var sizes = textures is null ? samplerSizes : null;
        var cubesLod = textures is null ? samplerCubeLod : null;
        return new DrawCall
        {
            VertexShader = program.Vertex!,
            FragmentShader = program.Fragment!,
            GeometryShader = program.Geometry,
            Vertices = vertices,
            Indices = indices,
            First = first,
            Count = count,
            Instances = Math.Max(1, instances),
            InstanceVertices = perInstance,
            InstanceDivisor = divisor,
            Topology = topology,
            Uniforms = t =>
            {
                var d = new Dictionary<string, ShaderValue>(blocks, StringComparer.Ordinal);
                foreach (var (name, f) in uniforms)
                    if (f(t) is { } value) d[name] = value;
                return d;
            },
            Cull = !gl.CullFace ? CullMode.None : gl.CullFaceMode switch { "GL_FRONT" => CullMode.Front, "GL_FRONT_AND_BACK" => CullMode.FrontAndBack, _ => CullMode.Back },
            FrontCcw = gl.FrontCcw,
            Wireframe = gl.Wireframe,
            DepthTest = gl.DepthTest,
            DepthFunc = gl.DepthFunc,
            DepthWrite = gl.DepthMask,
            Stencil = gl.StencilTest ? gl.Stencil : null,
            Blend = gl.Blend ? gl.BlendState : null,
            ColorMask = gl.ColorMask.ToArray(),
            PointSize = gl.PointSize,
            ProgramPointSize = gl.ProgramPointSize,
            Target = DrawTarget(),
            Textures = textures ?? samplers,
            CubeTextures = cubes,
            CubeTexturesLod = cubesLod,
            TextureSizes = sizes,
        };
    }

    /// <summary>
    /// The textures the shaders sample: each sampler2D uniform reads the texture unit its value names (0 unless set with
    /// glUniform1i / setInt), and the texture bound to that unit now. An incomplete texture reads black.
    /// </summary>
    /// <summary>The texture sizes of the samplers the last Samplers call bound.</summary>
    private Func<string, (int Width, int Height)?>? samplerSizes;
    /// <summary>The cube maps of the last Samplers call read at a mip level (textureLod).</summary>
    private Func<string, double, double, double, double, double[]?>? samplerCubeLod;

    private (Func<string, double, double, double[]>?, Func<string, double, double, double, double[]?>?) Samplers(GlState.ProgramObject program)
    {
        samplerSizes = null;
        samplerCubeLod = null;
        var cubeSamplers = new[] { program.Vertex!, program.Fragment! }.Concat(program.Geometry is { } pg ? [pg] : [])
            .SelectMany(s => s.Globals).Where(u => u.Storage == "uniform" && u.Type.StartsWith("samplerCube", StringComparison.Ordinal)).Select(u => u.Id).ToHashSet(StringComparer.Ordinal);
        var samplers = SamplerNames(program.Vertex!).Concat(SamplerNames(program.Fragment!))
            .Concat(program.Geometry is { } g ? SamplerNames(g) : []).Distinct().ToList();
        if (samplers.Count == 0) return (null, null);
        var bound = new Dictionary<string, Textures.Texture?>(StringComparer.Ordinal);
        var cubes = new Dictionary<string, Textures.CubeTexture>(StringComparer.Ordinal);
        foreach (var name in samplers)
        {
            int unit = program.Uniforms.TryGetValue(name, out var f) && f(1.0) is { } v ? (int)v.X : 0;
            Textures.Texture? texture = null;
            // The unit's binding of the sampler's kind (a cube map and a 2D texture can be bound to one unit).
            var ofKind = cubeSamplers.Contains(name) ? gl.UnitsCube : gl.Units2D;
            if ((ofKind.TryGetValue(unit, out var texName) || gl.Units.TryGetValue(unit, out texName)) && gl.TextureObjects.TryGetValue(texName, out var t) && (t.Image is not null || t.IsCube || t.Framebuffer is not null))
            {
                var sampler = new Textures.SamplerState(t.WrapS, t.WrapT, !t.MagFilter.Contains("NEAREST", StringComparison.Ordinal), t.Border);
                if (!t.Complete) scene.Notes.Add(SimNote.Warning("textureIncomplete", ("name", name), ("filter", t.MinFilter)));
                else if (t.IsCube && t.Framebuffer is { } cubeFbo)
                {
                    // A cube map a layered framebuffer draws into (point shadows): face i is layer i.
                    var (attachment, depth) = (t.Attachment, t.IsDepth);
                    List<Textures.Texture?> Level(string target) => Enumerable.Range(0, 6).Select(face =>
                        (Textures.Texture?)new Textures.Texture(() => Raster.Rasterizer.TargetImage(face == 0 ? target : target + "@" + face, attachment, depth), sampler) { Components = 4 }).ToList();
                    // Mip levels (drawn one by one or made by glGenerateMipmap) are read when the filter uses them.
                    bool mipmapped = t.TargetLevels > 1 && t.MinFilter.Contains("MIPMAP", StringComparison.Ordinal) && cubeFbo.StartsWith("tex:", StringComparison.Ordinal);
                    cubes[name] = new Textures.CubeTexture(Level(cubeFbo))
                    {
                        Mips = mipmapped ? Enumerable.Range(1, t.TargetLevels - 1).Select(level => (IReadOnlyList<Textures.Texture?>)Level($"{cubeFbo}~{level}")).ToList() : null,
                    };
                    continue;
                }
                else if (t.IsCube)
                {
                    cubes[name] = new Textures.CubeTexture(t.Faces.Select(f => f is null ? null : new Textures.Texture(f, sampler) { Components = t.Components }).ToList());
                    continue;
                }
                else if (t.Framebuffer is { } fbo)
                {
                    // A texture a framebuffer object draws into: what has been drawn so far in this frame.
                    var (attachment, depth) = (t.Attachment, t.IsDepth);
                    texture = new Textures.Texture(() => Raster.Rasterizer.TargetImage(fbo, attachment, depth), sampler) { Components = 4 };
                }
                else texture = new Textures.Texture(t.Image!, sampler)
                {
                    Components = t.Components,
                    Srgb = t.Srgb,
                    // glGenerateMipmap and a *_MIPMAP_* minification filter: a minified texture reads its smaller levels.
                    Mipmapped = t.Mipmaps && t.MinFilter.Contains("MIPMAP", StringComparison.Ordinal),
                    MipLinear = t.MinFilter.EndsWith("MIPMAP_LINEAR", StringComparison.Ordinal),
                };
            }
            else scene.Notes.Add(SimNote.Warning("noTextureOnUnit", ("name", name), ("unit", unit.ToString())));
            bound[name] = texture;
        }
        samplerSizes = name => bound.TryGetValue(name, out var t) && t is not null ? (t.Image.Width, t.Image.Height) : null;
        samplerCubeLod = cubes.Count == 0 ? null : (name, x, y, z, lod) => cubes.TryGetValue(name, out var c) ? c.Sample(x, y, z, lod) : null;
        return ((name, u, v) => bound.TryGetValue(name, out var t) && t is not null ? t.Sample(u, v) : [0, 0, 0, 1],
            cubes.Count == 0 ? null : (name, x, y, z) => cubes.TryGetValue(name, out var c) ? c.Sample(x, y, z) : null);
    }

    /// <summary>
    /// Model::Draw(shader) of learnopengl.com: each mesh drawn with its vertices (location 0 position, 1 normal, 2
    /// texture coordinates) and its material's textures as texture_diffuse1, texture_specular1, texture_normal1.
    /// </summary>
    private void DrawModel(Models.ObjModel model, string path, string shader, int line)
    {
        if (!gl.Programs.TryGetValue(shader, out var program) || !program.Linked || program.Vertex is null || program.Fragment is null)
        {
            scene.Notes.Add(SimNote.Error("noProgram", ("call", "Draw"), ("line", line.ToString())));
            return;
        }
        bool flipUv = Models.ModelFiles.FlipUVs(src, project);
        bool flipImages = System.Text.RegularExpressions.Regex.IsMatch(src.Code, @"stbi_set_flip_vertically_on_load\s*\(\s*(?:true|1)\s*\)");
        var uniforms = program.Uniforms.ToList();
        foreach (var mesh in model.Meshes)
        {
            var vertices = mesh.Positions.Select((p, i) => new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
            {
                ["0"] = ShaderValue.Vec(p),
                ["1"] = ShaderValue.Vec(mesh.Normals[i]),
                ["2"] = ShaderValue.Vec(mesh.TexCoords[i][0], flipUv ? 1 - mesh.TexCoords[i][1] : mesh.TexCoords[i][1]),
            }).ToList();
            var maps = new Dictionary<string, Textures.Texture?>(StringComparer.Ordinal)
            {
                ["texture_diffuse1"] = Models.ModelFiles.Texture(project, path, mesh.Material?.DiffuseMap, flipImages),
                ["texture_specular1"] = Models.ModelFiles.Texture(project, path, mesh.Material?.SpecularMap, flipImages),
                ["texture_normal1"] = Models.ModelFiles.Texture(project, path, mesh.Material?.NormalMap, flipImages),
            };
            var draw = MakeDraw(program, vertices, mesh.Indices.ToArray(), 0, mesh.Indices.Count, Topology.Triangles,
                textures: (name, u, v) => maps.TryGetValue(name, out var t) && t is not null ? t.Sample(u, v) : [0, 0, 0, 1]);
            if (inLoop) scene.Draws.Add(draw);
            else setupDraws.Add(draw);
        }
    }

    /// <summary>The sampler uniforms of a shader, with struct fields ("material.diffuse") and array elements ("maps[1]").</summary>
    private static IEnumerable<string> SamplerNames(ShaderProgram shader)
    {
        IEnumerable<string> Of(string type, string path, int arraySize)
        {
            var paths = arraySize > 0 ? Enumerable.Range(0, arraySize).Select(i => $"{path}[{i}]") : [path];
            if (type.StartsWith("sampler", StringComparison.Ordinal)) return paths;
            if (shader.FindStruct(type) is { } st)
                return paths.SelectMany(p => st.Fields.SelectMany(f => Of(f.Type, p + "." + f.Id, f.ArraySize)));
            return [];
        }
        return shader.Globals.Where(g => g.Storage == "uniform" && g.Block is null).SelectMany(g => Of(g.Type, g.Id, g.ArraySize));
    }

    internal static Topology TopologyOf(string mode) => mode switch
    {
        _ when mode.Contains("TRIANGLE_STRIP", StringComparison.Ordinal) => Topology.TriangleStrip,
        _ when mode.Contains("TRIANGLE_FAN", StringComparison.Ordinal) => Topology.TriangleFan,
        _ when mode.Contains("TRIANGLE", StringComparison.Ordinal) => Topology.Triangles,
        _ when mode.Contains("LINE_STRIP", StringComparison.Ordinal) || mode.Contains("LINE_LOOP", StringComparison.Ordinal) => Topology.LineStrip,
        _ when mode.Contains("LINE", StringComparison.Ordinal) => Topology.Lines,
        _ when mode.Contains("POINT", StringComparison.Ordinal) => Topology.Points,
        _ => Topology.Triangles,
    };
}
