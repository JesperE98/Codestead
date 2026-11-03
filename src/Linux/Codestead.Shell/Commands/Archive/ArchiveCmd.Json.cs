using System.Text.Json;

namespace Codestead.Shell.Commands;

// The archive contents as JSON, exactly like JSON.stringify.

public static partial class ArchiveCmd
{
    private static void JsonString(StringBuilder sb, string s)
    {
        sb.Append('"');
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 0x20)
                    {
                        sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else if (char.IsHighSurrogate(c) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
                    {
                        sb.Append(c).Append(s[++i]);
                    }
                    else if (char.IsSurrogate(c))
                    {
                        // A lone surrogate (well-formed JSON.stringify).
                        sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else sb.Append(c);
                    break;
            }
        }
        sb.Append('"');
    }

    private static void EntryJson(StringBuilder sb, ArchiveEntry e)
    {
        sb.Append("{\"path\":");
        JsonString(sb, e.Path);
        sb.Append(",\"type\":");
        JsonString(sb, e.Type);
        sb.Append(",\"mode\":").Append(Js.Num(e.Mode));
        sb.Append(",\"owner\":");
        JsonString(sb, e.Owner);
        sb.Append(",\"group\":");
        JsonString(sb, e.Group);
        sb.Append(",\"mtime\":").Append(Js.Num(e.Mtime));
        if (e.Content is not null)
        {
            sb.Append(",\"content\":");
            JsonString(sb, e.Content);
        }
        if (e.Size is long size) sb.Append(",\"size\":").Append(Js.Num(size));
        sb.Append('}');
    }

    private static string EntriesJson(List<ArchiveEntry> entries)
    {
        var sb = new StringBuilder("{\"entries\":[");
        for (int i = 0; i < entries.Count; i++)
        {
            if (i > 0) sb.Append(',');
            EntryJson(sb, entries[i]);
        }
        return sb.Append("]}").ToString();
    }

    private static string GzJson(GzPayload p)
    {
        var sb = new StringBuilder("{\"d\":");
        JsonString(sb, p.D);
        if (p.N is not null)
        {
            sb.Append(",\"n\":");
            JsonString(sb, p.N);
        }
        if (p.S is long s) sb.Append(",\"s\":").Append(Js.Num(s));
        return sb.Append('}').ToString();
    }

    private static string? JStr(JsonElement o, string name) =>
        o.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static double? JNum(JsonElement o, string name) =>
        o.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : null;

    private static List<ArchiveEntry>? ReadEntries(string magic, string content)
    {
        var p = Unwrap(magic, content);
        if (p is not { ValueKind: JsonValueKind.Object } root) return null;
        if (!root.TryGetProperty("entries", out var arr) || arr.ValueKind != JsonValueKind.Array) return null;
        var list = new List<ArchiveEntry>();
        foreach (var el in arr.EnumerateArray())
        {
            if (el.ValueKind != JsonValueKind.Object) continue;
            var e = new ArchiveEntry
            {
                Path = JStr(el, "path") ?? "",
                Type = JStr(el, "type") ?? "file",
                Mode = (int)(JNum(el, "mode") ?? 0),
                Owner = JStr(el, "owner") ?? "",
                Group = JStr(el, "group") ?? "",
                Mtime = (long)(JNum(el, "mtime") ?? 0),
                Content = JStr(el, "content"),
            };
            if (JNum(el, "size") is double size) e.Size = (long)size;
            list.Add(e);
        }
        return list;
    }
}
