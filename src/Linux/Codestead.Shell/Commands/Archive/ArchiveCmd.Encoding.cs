using System.Text.Json;

namespace Codestead.Shell.Commands;

// How archives are stored as strings: base64 with a scrambled alphabet behind a marker.

public static partial class ArchiveCmd
{
    private const string B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    // 64 characters from Latin-1 (¡ ... á, except the soft hyphen) – looks like binary data.
    private static readonly string Scrambled = BuildScrambled();
    private static readonly Dictionary<char, char> ToScrambled = new();
    private static readonly Dictionary<char, char> FromScrambled = BuildMaps();

    private static string BuildScrambled()
    {
        var s = new StringBuilder();
        for (int c = 0xa1; s.Length < 64; c++)
            if (c != 0xad) s.Append((char)c);
        return s.ToString();
    }

    private static Dictionary<char, char> BuildMaps()
    {
        var from = new Dictionary<char, char>();
        for (int i = 0; i < 64; i++)
        {
            ToScrambled[B64[i]] = Scrambled[i];
            from[Scrambled[i]] = B64[i];
        }
        return from;
    }

    private static string Encode(string text)
    {
        var b64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(text));
        var o = new StringBuilder(b64.Length);
        foreach (var ch in b64)
            if (ch != '=') o.Append(ToScrambled[ch]);
        return o.ToString();
    }

    private static readonly UTF8Encoding StrictUtf8 = new(false, true);

    private static string? Decode(string data)
    {
        try
        {
            var b64 = new StringBuilder(data.Length + 3);
            foreach (var ch in data)
            {
                if (!FromScrambled.TryGetValue(ch, out var m)) return null;
                b64.Append(m);
            }
            b64.Append('=', (4 - b64.Length % 4) % 4);
            var bytes = Convert.FromBase64String(b64.ToString());
            var text = StrictUtf8.GetString(bytes);
            // TextDecoder drops a leading byte order mark.
            return text.StartsWith('﻿') ? text[1..] : text;
        }
        catch (Exception e) when (e is FormatException or ArgumentException)
        {
            return null;
        }
    }

    private static string Wrap(string magic, long size, string json) => $"{magic}\u0000{Js.Num(size)}\u0000{Encode(json)}";

    /// <summary>The JSON inside an archive, or null.</summary>
    private static JsonElement? Unwrap(string magic, string content)
    {
        if (!content.StartsWith(magic + "\u0000", StringComparison.Ordinal)) return null;
        var rest = content[(magic.Length + 1)..];
        int nul = rest.IndexOf('\u0000');
        if (nul < 0) return null;
        var json = Decode(rest[(nul + 1)..]);
        if (json is null) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (Exception e) when (e is JsonException or ArgumentException or InvalidOperationException)
        {
            return null;
        }
    }
}
