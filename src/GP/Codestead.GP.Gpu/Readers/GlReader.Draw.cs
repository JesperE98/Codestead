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
        };
        if (inLoop) scene.Draws.Add(draw);
        else setupDraws.Add(draw);
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
