using System.Globalization;

namespace Codestead.GP.Gpu.Shading;

/// <summary>
/// A value in a running shader: a scalar or vector (<see cref="V"/>, 1–4 components), a square matrix (<see cref="V"/>
/// with <see cref="Cols"/> × <see cref="Cols"/> components, column by column), an array, a struct or a string.
/// </summary>
public sealed class ShaderValue
{
    public double[]? V { get; init; }
    /// <summary>0 for scalars and vectors; 2, 3 or 4 for a matrix.</summary>
    public int Cols { get; init; }
    public ShaderValue[]? Items { get; init; }
    public Dictionary<string, ShaderValue>? Fields { get; init; }
    public string? Text { get; init; }
    /// <summary>A C++ std::map with number keys (learnopengl sorts its windows by distance with one).</summary>
    public SortedDictionary<double, ShaderValue>? Map { get; init; }
    /// <summary>An iterator into a std::map: begin()/rbegin() …, ++it, it->first / it->second.</summary>
    public MapIterator? Iterator { get; init; }

    public static ShaderValue Scalar(double x) => new() { V = [x] };

    public static ShaderValue Vec(params double[] v) => new() { V = v };

    public static ShaderValue Str(string s) => new() { Text = s };

    public static ShaderValue Struct(Dictionary<string, ShaderValue> fields) => new() { Fields = fields };

    public static ShaderValue Array(ShaderValue[] items) => new() { Items = items };

    public static ShaderValue Matrix(int cols, double[] v) => new() { V = v, Cols = cols };

    public static ShaderValue Identity(int n)
    {
        var v = new double[n * n];
        for (int i = 0; i < n; i++) v[i * n + i] = 1;
        return Matrix(n, v);
    }

    public bool IsNumeric => V is not null;
    public bool IsMatrix => Cols > 0;
    public int Size => V?.Length ?? 0;
    public double X => V is { Length: > 0 } ? V[0] : 0;

    /// <summary>The first <paramref name="n"/> components, padded with <paramref name="pad"/> (and 1 for w).</summary>
    public double[] Padded(int n, double pad = 0)
    {
        var r = new double[n];
        for (int i = 0; i < n; i++) r[i] = V is not null && i < V.Length ? V[i] : (i == 3 ? 1 : pad);
        return r;
    }

    public ShaderValue Clone() => new()
    {
        V = V?.ToArray(),
        Cols = Cols,
        Items = Items?.Select(i => i.Clone()).ToArray(),
        Fields = Fields?.ToDictionary(kv => kv.Key, kv => kv.Value.Clone()),
        Text = Text,
        Map = Map is null ? null : new SortedDictionary<double, ShaderValue>(Map),
        Iterator = Iterator,
    };

    public override string ToString() =>
        Text ?? (V is not null ? (V.Length == 1 ? Num(V[0]) : $"({string.Join(", ", V.Select(Num))})")
        : Items is not null ? $"[{string.Join(", ", Items.Select(i => i.ToString()))}]"
        : Fields is not null ? "{" + string.Join(", ", Fields.Select(kv => $"{kv.Key}: {kv.Value}")) + "}" : "?");

    private static string Num(double d) => d.ToString("0.###", CultureInfo.InvariantCulture);
}
