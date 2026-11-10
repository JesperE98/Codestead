using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Shading;

// C++ mode: the parts of the C++ library and of FreeType the course's programs use – file and string streams (a game
// reads its levels with std::ifstream, std::getline and std::istringstream >> n) and FreeType's glyph loading (the text
// chapters), which the simulator answers from the glyphs FreeType makes of the course's font (Fonts/FreeTypeGlyphs).
public sealed partial class ShaderRunner
{
    /// <summary>C++ mode: the zero value of a std::vector's elements, from the variable's declaration (or null).</summary>
    public Func<Expr, ShaderValue?>? ElementDefault { get; set; }

    /// <summary>C++ mode: a text file of the project by its path (std::ifstream), or null when it does not exist.</summary>
    public Func<string, string?>? ReadText { get; set; }

    /// <summary>C++ mode: a file of the project as bytes (a font for FreeType), or null.</summary>
    public Func<string, byte[]?>? ReadBytes { get; set; }

    private const string StreamText = "__text", StreamPos = "__pos", StreamOk = "__ok", ConsoleMark = "__console";

    /// <summary>C++ mode: each line the program writes to std::cout / std::cerr.</summary>
    public Action<string>? Output { get; set; }

    private readonly System.Text.StringBuilder console = new();

    private static readonly ShaderValue Console = ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal) { [ConsoleMark] = ShaderValue.Scalar(1) });

    private static bool IsConsole(ShaderValue v) => v.Fields is { } f && f.ContainsKey(ConsoleMark);

    /// <summary>std::cout &lt;&lt; x: x as C++ prints it (a float with 6 significant digits); a finished line goes out.</summary>
    private ShaderValue ConsoleWrite(ShaderValue value)
    {
        string text = value.Text ?? (value.V is { Length: 1 } v
            ? value.Int || v[0] == Math.Floor(v[0]) && Math.Abs(v[0]) < 1e15 ? ((long)v[0]).ToString(System.Globalization.CultureInfo.InvariantCulture)
                : v[0].ToString("G6", System.Globalization.CultureInfo.InvariantCulture)
            : value.ToString());
        console.Append(text);
        var all = console.ToString();
        int nl;
        while ((nl = all.IndexOf('\n')) >= 0)
        {
            Output?.Invoke(all[..nl]);
            all = all[(nl + 1)..];
        }
        console.Clear().Append(all);
        return Console;
    }

    private static bool IsStream(ShaderValue v) => v.Fields is { } f && f.ContainsKey(StreamText);

    private static ShaderValue NewStream(string? text) => ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
    {
        [StreamText] = ShaderValue.Str(text ?? ""),
        [StreamPos] = ShaderValue.Scalar(0),
        [StreamOk] = ShaderValue.Scalar(text is null ? 0 : 1),
    });

    /// <summary>The C++ library and FreeType calls the runner answers itself, or null.</summary>
    private ShaderValue? CppLibrary(Call c, string name)
    {
        switch (name)
        {
            case "OutputDebugStringA" or "OutputDebugStringW" or "OutputDebugString" when c.Args.Count == 1:
                // Windows' debugger output (Visual Studio's Output window): the output pane, like std::cout.
                ConsoleWrite(Eval(c.Args[0]));
                return ShaderValue.Scalar(0);
            case "__assign" when c.Args.Count == 2:
            {
                var assigned = Eval(c.Args[1]);
                Store(c.Args[0], assigned);
                return assigned;
            }
            case "ifstream" or "fstream":
            {
                // std::ifstream file(path): the project's file (a stream that fails when it does not exist).
                var path = c.Args.Count > 0 ? Eval(c.Args[0]).Text : null;
                return NewStream(path is null ? null : ReadText?.Invoke(path));
            }
            case "istringstream" or "stringstream":
                return NewStream(c.Args.Count > 0 ? Eval(c.Args[0]).Text ?? Eval(c.Args[0]).ToString() : "");
            case "getline" when c.Args.Count >= 2 && Eval(c.Args[0]) is { } stream && IsStream(stream):
            {
                var text = stream.Fields![StreamText].Text ?? "";
                int pos = (int)stream.Fields[StreamPos].X;
                if (pos >= text.Length)
                {
                    stream.Fields[StreamOk] = ShaderValue.Scalar(0);
                    return ShaderValue.Scalar(0);
                }
                int end = text.IndexOf('\n', pos);
                if (end < 0) end = text.Length;
                Store(c.Args[1], ShaderValue.Str(text[pos..end].TrimEnd('\r')));
                stream.Fields[StreamPos] = ShaderValue.Scalar(end + 1);
                return ShaderValue.Scalar(1);
            }
            case "memcpy" when c.Args.Count == 3 && Pointer(c.Args[0]) is { Container.Items: { } into } dst:
            {
                // memcpy into an array of the program (a glyph's rows into an atlas vector): element by element – bytes,
                // or 4-byte numbers when the size is counted with sizeof(float).
                var (from, at) = Pointer(c.Args[1]);
                long bytes = (long)Eval(c.Args[2]).X;
                bool fours = ExprText(c.Args[2]).Contains("sizeof", StringComparison.Ordinal) && !ExprText(c.Args[2]).Contains("char", StringComparison.Ordinal);
                long count = fours ? bytes / 4 : bytes;
                for (long i = 0; i < count; i++)
                {
                    long s = at + i, d = dst.Offset + i;
                    if (d < 0 || d >= into.Length) break;
                    double? v = from?.V is { } fv ? (s < fv.Length ? fv[s] : null) : from?.Items is { } fi && s < fi.Length ? fi[s].X : null;
                    if (v is null) break;
                    into[d] = ShaderValue.Integer(v.Value);
                }
                return ShaderValue.Scalar(0);
            }
            case "FT_Init_FreeType" when c.Args.Count == 1:
                Store(c.Args[0], ShaderValue.Str("FT_Library"));
                return ShaderValue.Integer(0);
            case "FT_New_Face" when c.Args.Count >= 4:
            {
                // FT_New_Face(ft, path, 0, &face): 0 when the font loads (a font the simulator has glyphs for).
                var path = Eval(c.Args[1]).Text;
                var bytes = path is null ? null : ReadBytes?.Invoke(path);
                var font = bytes is null ? null : Fonts.FreeTypeGlyphs.Identify(bytes);
                if (font is null) return ShaderValue.Integer(1);
                Store(c.Args[3], ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
                {
                    ["__font"] = ShaderValue.Str(font),
                    ["__size"] = ShaderValue.Integer(0),
                    ["glyph"] = NewGlyph(null),
                }));
                return ShaderValue.Integer(0);
            }
            case "FT_Set_Pixel_Sizes" when c.Args.Count >= 3 && Eval(c.Args[0]) is { Fields: { } face } && face.ContainsKey("__font"):
            {
                int width = (int)Eval(c.Args[1]).X, height = (int)Eval(c.Args[2]).X;
                face["__size"] = ShaderValue.Integer(height == 0 ? width : height);
                return ShaderValue.Integer(0);
            }
            case "FT_Load_Char" when c.Args.Count >= 2 && Eval(c.Args[0]) is { Fields: { } face } && face.ContainsKey("__font"):
            {
                int code = (int)Eval(c.Args[1]).X;
                var font = face["__font"].Text ?? "";
                int size = (int)face["__size"].X;
                if (!Fonts.FreeTypeGlyphs.SizesOf(font).Contains(size)) return ShaderValue.Integer(1);
                // A character the font has no glyph for gets the empty glyph (FreeType loads glyph 0, .notdef).
                face["glyph"] = NewGlyph(Fonts.FreeTypeGlyphs.Get(font, size, code));
                return ShaderValue.Integer(0);
            }
            case "FT_Done_Face" or "FT_Done_FreeType":
                return ShaderValue.Integer(0);
        }
        return null;
    }

    /// <summary>What a C++ pointer argument points at: the array and the element (&amp;a[i], buffer + n, v.data()).</summary>
    private (ShaderValue? Container, long Offset) Pointer(Expr e)
    {
        try
        {
            switch (e)
            {
                case IndexOf ix:
                    return (Eval(ix.Target), (long)Eval(ix.At).X);
                case ShaderAst.Binary { Op: "+" } b:
                {
                    var (container, offset) = Pointer(b.Left);
                    return (container, offset + (long)Eval(b.Right).X);
                }
                case Call { Function: ".data", Args: [var t] }:
                    return Pointer(t);
                default:
                    return (Eval(e), 0);
            }
        }
        catch (ShaderRuntimeException)
        {
            return (null, 0);
        }
    }

    private static string ExprText(Expr e) => e switch
    {
        Call call => call.Function + "(" + string.Join(",", call.Args.Select(ExprText)) + ")",
        ShaderAst.Binary b => ExprText(b.Left) + b.Op + ExprText(b.Right),
        Name n => n.Id,
        Member m => ExprText(m.Target) + "." + m.Field,
        _ => "",
    };

    /// <summary>face->glyph: bitmap (width, rows, pitch, buffer), bitmap_left, bitmap_top, advance (x in 1/64 pixel).</summary>
    private static ShaderValue NewGlyph(Fonts.FreeTypeGlyphs.Glyph? g) => ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
    {
        ["bitmap"] = ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
        {
            ["width"] = ShaderValue.Integer(g?.Width ?? 0),
            ["rows"] = ShaderValue.Integer(g?.Rows ?? 0),
            ["pitch"] = ShaderValue.Integer(g?.Pitch ?? 0),
            // The coverage bytes, row by row from the top (what glTexImage2D receives as GL_UNSIGNED_BYTE data).
            ["buffer"] = g is null || g.Bitmap.Length == 0 ? ShaderValue.Str("nullptr") : ShaderValue.Vec(g.Bitmap.Select(b => (double)b).ToArray()),
        }),
        ["bitmap_left"] = ShaderValue.Integer(g?.Left ?? 0),
        ["bitmap_top"] = ShaderValue.Integer(g?.Top ?? 0),
        ["advance"] = ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
        {
            ["x"] = ShaderValue.Integer(g?.Advance ?? 0),
            ["y"] = ShaderValue.Integer(0),
        }),
    });

    /// <summary>stream &lt;&lt; x: appends x (another stream's rest – file.rdbuf() –, a string or a number).</summary>
    private ShaderValue StreamWrite(ShaderValue stream, ShaderValue value)
    {
        string text;
        if (IsStream(value))
        {
            var all = value.Fields![StreamText].Text ?? "";
            int at = Math.Min(all.Length, (int)value.Fields[StreamPos].X);
            text = all[at..];
            value.Fields[StreamPos] = ShaderValue.Scalar(all.Length);
        }
        else text = value.Text ?? value.ToString();
        stream.Fields![StreamText] = ShaderValue.Str((stream.Fields[StreamText].Text ?? "") + text);
        stream.Fields[StreamOk] = ShaderValue.Scalar(1);
        return stream;
    }

    /// <summary>A stream declared without arguments (std::stringstream ss; std::ifstream file; – opened later).</summary>
    internal static ShaderValue? EmptyStream(string type) => type switch
    {
        "stringstream" or "ostringstream" or "istringstream" => NewStream(""),
        "ifstream" or "fstream" => NewStream(null),
        _ => null,
    };

    /// <summary>stream &gt;&gt; x: the next whitespace-separated word into x (as a number when x holds one); 0 at the end.</summary>
    private ShaderValue StreamRead(ShaderValue stream, Expr target)
    {
        var text = stream.Fields![StreamText].Text ?? "";
        int pos = (int)stream.Fields[StreamPos].X;
        while (pos < text.Length && char.IsWhiteSpace(text[pos])) pos++;
        int start = pos;
        while (pos < text.Length && !char.IsWhiteSpace(text[pos])) pos++;
        stream.Fields[StreamPos] = ShaderValue.Scalar(pos);
        if (start == pos)
        {
            stream.Fields[StreamOk] = ShaderValue.Scalar(0);
            return ShaderValue.Scalar(0);
        }
        var word = text[start..pos];
        ShaderValue? old = null;
        try
        {
            old = Eval(target);
        }
        catch (ShaderRuntimeException)
        {
        }
        if (old?.Text is not null) Store(target, ShaderValue.Str(word));
        else if (double.TryParse(word, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var number))
            Store(target, old?.Int == true ? ShaderValue.Integer(Math.Truncate(number)) : ShaderValue.Scalar(number));
        else
        {
            stream.Fields[StreamOk] = ShaderValue.Scalar(0);
            return ShaderValue.Scalar(0);
        }
        return ShaderValue.Scalar(1);
    }
}
