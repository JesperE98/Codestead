using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Shading;

// C++ mode: the parts of the C++ library and of FreeType the course's programs use – file and string streams (a game
// reads its levels with std::ifstream, std::getline and std::istringstream >> n) and FreeType's glyph loading (the text
// chapters), which the simulator answers from the glyphs FreeType makes of the course's font (Fonts/FreeTypeGlyphs).
public sealed partial class ShaderRunner
{
    /// <summary>C++ mode: a text file of the project by its path (std::ifstream), or null when it does not exist.</summary>
    public Func<string, string?>? ReadText { get; set; }

    /// <summary>C++ mode: a file of the project as bytes (a font for FreeType), or null.</summary>
    public Func<string, byte[]?>? ReadBytes { get; set; }

    private const string StreamText = "__text", StreamPos = "__pos", StreamOk = "__ok";

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
