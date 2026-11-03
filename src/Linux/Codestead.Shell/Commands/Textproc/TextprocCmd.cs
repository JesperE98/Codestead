namespace Codestead.Shell.Commands;

// Port of src/shell/commands/textproc.ts – text processing: tr, sed and awk.

public static partial class TextprocCmd
{
    private static void DimNote(CmdCtx ctx, string key, params (string Name, object? Value)[] args) =>
        ctx.Err($"{UtilCmd.Color.Dim}({ctx.Sh.Msg("textproc.simulator")}: {ctx.Sh.Msg(key, args)}){UtilCmd.Color.Reset}\n");

    /// <summary>[...s] – the code points of a string, each as a string.</summary>
    private static List<string> CodePoints(string s)
    {
        var list = new List<string>(s.Length);
        for (int i = 0; i < s.Length; i++)
        {
            if (char.IsHighSurrogate(s[i]) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
            {
                list.Add(s.Substring(i, 2));
                i++;
            }
            else list.Add(s[i].ToString());
        }
        return list;
    }

    private static int CodePointAt0(string c) =>
        c.Length >= 2 && char.IsSurrogatePair(c, 0) ? char.ConvertToUtf32(c, 0) : c[0];

    private static string FromCodePoint(int cp) =>
        cp is >= 0xD800 and <= 0xDFFF ? ((char)cp).ToString() : char.ConvertFromUtf32(cp);

    // =====================================================================
    // tr
    // =====================================================================

    private static readonly OrderedDictionary<string, string> TrClasses = BuildTrClasses();

    private static OrderedDictionary<string, string> BuildTrClasses()
    {
        var d = new OrderedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["upper"] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            ["lower"] = "abcdefghijklmnopqrstuvwxyz",
            ["digit"] = "0123456789",
            ["space"] = " \t\n\r\f\v",
            ["blank"] = " \t",
            ["punct"] = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
            ["xdigit"] = "0123456789ABCDEFabcdef",
        };
        d["alpha"] = d["upper"] + d["lower"];
        d["alnum"] = d["digit"] + d["alpha"];
        return d;
    }

    private sealed class TrError(string message) : Exception(message);

    private static readonly Dictionary<string, string> TrEscapes = new(StringComparer.Ordinal)
    {
        ["n"] = "\n", ["t"] = "\t", ["r"] = "\r", ["f"] = "\f", ["v"] = "\v", ["a"] = "\x07", ["b"] = "\b", ["\\"] = "\\",
    };

    /// <summary>Expands a tr set: ranges (a-z), classes ([:upper:]) and escapes (\n).</summary>
    public static List<string> ExpandTrSet(string spec)
    {
        var chars = CodePoints(spec);
        var o = new List<string>();
        int i = 0;
        string At(int k) => k < chars.Count ? chars[k] : "";
        string ReadChar()
        {
            var c = chars[i++];
            if (c != "\\" || i >= chars.Count) return c;
            var n = chars[i++];
            if (TrEscapes.TryGetValue(n, out var mapped)) return mapped;
            if (n.Length == 1 && n[0] is >= '0' and <= '7')
            {
                var oct = n;
                while (oct.Length < 3 && At(i) is [>= '0' and <= '7']) oct += chars[i++];
                return ((char)Convert.ToInt32(oct, 8)).ToString();
            }
            return n;
        }
        while (i < chars.Count)
        {
            if (chars[i] == "[" && At(i + 1) == ":")
            {
                var rest = string.Concat(chars.Skip(i));
                int end = rest.IndexOf(":]", StringComparison.Ordinal);
                if (end > 0)
                {
                    var name = rest.Slice(2, end);
                    var cls = TrClasses.Get(name);
                    if (cls is null) throw new TrError($"invalid character class '{name}'");
                    o.AddRange(CodePoints(cls));
                    i += CodePoints(rest.Slice(0, end + 2)).Count;
                    continue;
                }
            }
            var c = ReadChar();
            if (At(i) == "-" && i + 1 < chars.Count)
            {
                i++;
                var d = ReadChar();
                int from = CodePointAt0(c);
                int to = CodePointAt0(d);
                if (to < from) throw new TrError($"range-endpoints of '{c}-{d}' are in reverse collating sequence order");
                for (int cp = from; cp <= to; cp++) o.Add(FromCodePoint(cp));
                continue;
            }
            o.Add(c);
        }
        return o;
    }

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new() { Tr, Sed, Awk };
}
