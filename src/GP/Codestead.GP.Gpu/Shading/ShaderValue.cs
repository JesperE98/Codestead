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
    public ShaderValue[]? Items
    {
        get
        {
            // A packed vector of numbers read element by element as values: it becomes an array of them now.
            if (packed is { } numbers)
            {
                var made = new ShaderValue[numbers.Length];
                for (int i = 0; i < numbers.Length; i++) made[i] = PackedInt ? Integer(numbers[i]) : Scalar(numbers[i]);
                items = made;
                packed = null;
                return made;
            }
            // Elements appended since the last read (push_back in a loop of 65,536 pixels) become the array now.
            if (grow is { } g)
            {
                var arr = g.ToArray();
                items = arr;
                grow = null;
                return arr;
            }
            return items;
        }
        init => items = value;
    }

    private ShaderValue[]? items;
    private List<ShaderValue>? grow;
    private double[]? packed;

    /// <summary>
    /// A large std::vector of numbers (std::vector&lt;float&gt; pixels(800 * 600 * 4)) kept as plain numbers: read and
    /// written element by element (and flattened) without a value per element. Null once it was read as
    /// <see cref="Items"/>.
    /// </summary>
    public double[]? Packed => packed;
    public bool PackedInt { get; init; }

    public static ShaderValue PackedArray(double[] numbers, bool integers = false) => new() { packed = numbers, PackedInt = integers };

    /// <summary>An array (a std::vector), without making its elements an array first.</summary>
    public bool IsArray => items is not null || grow is not null || packed is not null;

    /// <summary>The number of elements of an array, without making them an array first.</summary>
    public int Count => packed?.Length ?? grow?.Count ?? items?.Length ?? 0;

    /// <summary>
    /// std::vector::push_back: the element is added to this array in place, in amortised constant time (the array the
    /// other readers see is made when it is next read).
    /// </summary>
    public void Append(ShaderValue item)
    {
        if (packed is not null) _ = Items;
        if (grow is null)
        {
            grow = new List<ShaderValue>(Math.Max(16, (items?.Length ?? 0) * 2));
            if (items is not null) grow.AddRange(items);
            items = null;
        }
        grow.Add(item);
    }
    public Dictionary<string, ShaderValue>? Fields { get; init; }
    public string? Text { get; init; }
    /// <summary>A pointer into the bytes a handle names (data + (j + width * i) * bytePerPixel): bytes past its start.</summary>
    public long Offset { get; init; }
    /// <summary>A C++ std::map with number keys (learnopengl sorts its windows by distance with one).</summary>
    public SortedDictionary<double, ShaderValue>? Map { get; init; }
    /// <summary>An iterator into a std::map: begin()/rbegin() …, ++it, it->first / it->second.</summary>
    public MapIterator? Iterator { get; init; }

    /// <summary>
    /// A scalar of an integer type (int, uint; an integer literal): dividing two of them gives a whole number, as in
    /// GLSL, HLSL and C++. Vectors and matrices never carry it.
    /// </summary>
    public bool Int { get; init; }

    public static ShaderValue Scalar(double x) => new() { V = [x] };

    // std::map keys are numbers in the runner (SortedDictionary<double, …>); a string key (std::map<std::string, Shader>)
    // gets a number of its own, far below any key a program uses, so it can be turned back into its text (it->first).
    private const double TextKeyBase = -1e15;
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, double> TextKeys = new(StringComparer.Ordinal);
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<double, string> KeyTexts = new();

    /// <summary>A value as a std::map key: its number, or a string's own key.</summary>
    public static double MapKey(ShaderValue key)
    {
        if (key.Text is not { } text) return key.X;
        return TextKeys.GetOrAdd(text, t =>
        {
            lock (KeyTexts)
            {
                double k = TextKeyBase - KeyTexts.Count;
                KeyTexts[k] = t;
                return k;
            }
        });
    }

    /// <summary>A std::map key back as a value (it->first): a string key's text, else the number.</summary>
    public static ShaderValue FromMapKey(double key) => KeyTexts.TryGetValue(key, out var text) ? Str(text) : Scalar(key);

    public static ShaderValue Integer(double x) => new() { V = [x], Int = true };

    /// <summary>True for the names of the integer types of GLSL, HLSL and the C++ the simulator reads.</summary>
    public static bool IsIntType(string type) => type is "int" or "uint" or "INT" or "UINT" or "GLint" or "GLuint" or "GLsizei" or "unsigned" or "uint32_t" or "int32_t"
        or "uint16_t" or "uint64_t" or "int64_t" or "size_t" or "dword" or "DWORD" or "long" or "short" or "unsignedint" or "UINT32" or "UINT64" or "UINT16"
        or "char" or "uchar" or "uint8_t" or "int8_t" or "BYTE" or "UINT8" or "INT8" or "stbi_uc" or "GLubyte" or "GLchar" or "GLenum" or "GLbitfield";

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

    /// <summary>
    /// An object the API owns that the program only reads (learnopengl's Model: its meshes and vertices): a copy of a
    /// struct that points at it (Entity's Model* pModel) points at the same one, it is not copied.
    /// </summary>
    public bool Shared { get; init; }

    public ShaderValue Clone() => Shared ? this : packed is not null ? PackedArray(packed.ToArray(), PackedInt) : new()
    {
        V = V?.ToArray(),
        Int = Int,
        Cols = Cols,
        Items = Items?.Select(i => i.Clone()).ToArray(),
        Fields = Fields?.ToDictionary(kv => kv.Key, kv => kv.Value.Clone()),
        Text = Text,
        Offset = Offset,
        Map = Map is null ? null : new SortedDictionary<double, ShaderValue>(Map),
        Iterator = Iterator,
    };

    public override string ToString() =>
        Text ?? (V is not null ? (V.Length == 1 ? Num(V[0]) : $"({string.Join(", ", V.Select(Num))})")
        : Items is not null ? $"[{string.Join(", ", Items.Select(i => i.ToString()))}]"
        : Fields is not null ? "{" + string.Join(", ", Fields.Select(kv => $"{kv.Key}: {kv.Value}")) + "}" : "?");

    private static string Num(double d) => d.ToString("0.###", CultureInfo.InvariantCulture);
}
