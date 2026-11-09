using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

// glDrawArrays and glDrawElements: the vertex data comes from the bound vertex array object, as on a real GPU.
public sealed partial class GlReader
{
    private void Draw(string mode, string? indexType, int first, int count, string call, int line)
    {
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
                if (!attr.Enabled || attr.Buffer is null || !gl.Buffers.TryGetValue(attr.Buffer, out var data) || data is null) continue;
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

        var uniforms = program.Uniforms.ToList();
        var textures = Samplers(program);
        var draw = new DrawCall
        {
            VertexShader = program.Vertex,
            FragmentShader = program.Fragment,
            Vertices = vertices,
            Indices = indices,
            First = indices is null ? first : 0,
            Count = indices?.Length ?? count,
            Topology = TopologyOf(mode),
            Uniforms = t =>
            {
                var d = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
                foreach (var (name, f) in uniforms)
                    if (f(t) is { } value) d[name] = value;
                return d;
            },
            Cull = !gl.CullFace ? CullMode.None : gl.CullFaceMode switch { "GL_FRONT" => CullMode.Front, "GL_FRONT_AND_BACK" => CullMode.FrontAndBack, _ => CullMode.Back },
            FrontCcw = gl.FrontCcw,
            Wireframe = gl.Wireframe,
            DepthTest = gl.DepthTest,
            Textures = textures,
        };
        if (inLoop) scene.Draws.Add(draw);
        else setupDraws.Add(draw);
    }

    /// <summary>
    /// The textures the shaders sample: each sampler2D uniform reads the texture unit its value names (0 unless set with
    /// glUniform1i / setInt), and the texture bound to that unit now. An incomplete texture reads black.
    /// </summary>
    private Func<string, double, double, double[]>? Samplers(GlState.ProgramObject program)
    {
        var samplers = program.Vertex!.Globals.Concat(program.Fragment!.Globals).Where(g => g.Type.StartsWith("sampler", StringComparison.Ordinal)).Select(g => g.Id).Distinct().ToList();
        if (samplers.Count == 0) return null;
        var bound = new Dictionary<string, Textures.Texture?>(StringComparer.Ordinal);
        foreach (var name in samplers)
        {
            int unit = program.Uniforms.TryGetValue(name, out var f) && f(1.0) is { } v ? (int)v.X : 0;
            Textures.Texture? texture = null;
            if (gl.Units.TryGetValue(unit, out var texName) && gl.TextureObjects.TryGetValue(texName, out var t) && t.Image is not null)
            {
                if (!t.Complete) scene.Notes.Add(SimNote.Warning("textureIncomplete", ("name", name), ("filter", t.MinFilter)));
                else texture = new Textures.Texture(t.Image, new Textures.SamplerState(t.WrapS, t.WrapT, !t.MagFilter.Contains("NEAREST", StringComparison.Ordinal), t.Border)) { Components = t.Components };
            }
            else scene.Notes.Add(SimNote.Warning("noTextureOnUnit", ("name", name), ("unit", unit.ToString())));
            bound[name] = texture;
        }
        return (name, u, v) => bound.TryGetValue(name, out var t) && t is not null ? t.Sample(u, v) : [0, 0, 0, 1];
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
