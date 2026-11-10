using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Shading;

/// <summary>A parsed shader file: its structs, globals (inputs, outputs, uniforms, constants) and functions.</summary>
public sealed class ShaderProgram
{
    /// <summary>The text the program was parsed from.</summary>
    public string Source { get; set; } = "";

    public List<Struct> Structs { get; } = new();
    public List<Global> Globals { get; } = new();
    public List<Function> Functions { get; } = new();

    /// <summary>Every name the program's code reads or writes (gl_FragDepth, gl_Layer …).</summary>
    public HashSet<string> Names { get; } = new(StringComparer.Ordinal);
    /// <summary>A geometry shader's input primitive (points, lines, triangles), from layout (…) in;.</summary>
    public string? InputPrimitive { get; set; }
    /// <summary>A geometry shader's output (points, line_strip, triangle_strip) and its max_vertices.</summary>
    public string? OutputPrimitive { get; set; }
    public int MaxVertices { get; set; }

    // Looked up at every call of a running shader: by name, made again when the program has grown (while it is parsed).
    private Dictionary<string, Function>? functionsByName;
    private Dictionary<string, Struct>? structsByName;
    private int indexedFunctions = -1, indexedStructs = -1;

    /// <summary>The function of a name: its definition (the last one with a body), or its declaration.</summary>
    public Function? FindFunction(string id)
    {
        var index = functionsByName;
        if (index is null || indexedFunctions != Functions.Count)
        {
            index = new Dictionary<string, Function>(StringComparer.Ordinal);
            foreach (var f in Functions)
                if (f.Body.Count > 0 || !index.TryGetValue(f.Id, out var known) || known.Body.Count == 0) index[f.Id] = f;
            indexedFunctions = Functions.Count;
            functionsByName = index;
        }
        return index.GetValueOrDefault(id);
    }

    public Struct? FindStruct(string id)
    {
        var index = structsByName;
        if (index is null || indexedStructs != Structs.Count)
        {
            index = new Dictionary<string, Struct>(StringComparer.Ordinal);
            foreach (var s in Structs) index.TryAdd(s.Id, s);
            indexedStructs = Structs.Count;
            structsByName = index;
        }
        return index.GetValueOrDefault(id);
    }
}
