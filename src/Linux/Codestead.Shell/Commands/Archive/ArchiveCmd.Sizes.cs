namespace Codestead.Shell.Commands;

// Pretend sizes of archives and their entries (an estimate of how well deflate compresses).

public static partial class ArchiveCmd
{
    /// <summary>The size of the content as programs see it (archives have a pretend size).</summary>
    private static long LogicalSize(string content) =>
        VfsLib.NodeSize(new FsNode { Type = "file", Mode = 0, Owner = "", Group = "", Mtime = 0, Content = content });

    /// <summary>
    /// Estimates how many bytes deflate (gzip/zip) compresses the text to: a simple LZ77 that
    /// looks for repetitions, where a repetition costs a few bytes and other characters a
    /// little under a byte each. Small files therefore do not get smaller.
    /// </summary>
    public static long DeflateSize(string text)
    {
        var b = Encoding.UTF8.GetBytes(text);
        int n = b.Length;
        if (n == 0) return 2;
        var last = new Dictionary<int, int>();
        int Key(int i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
        long literals = 0;
        long matches = 0;
        int i = 0;
        while (i < n)
        {
            if (i + 2 < n)
            {
                int k = Key(i);
                bool found = last.TryGetValue(k, out var j);
                last[k] = i;
                if (found && i - j <= 32768)
                {
                    int len = 3;
                    while (i + len < n && len < 258 && b[j + len] == b[i + len]) len++;
                    for (int p = i + 1; p < i + len && p + 2 < n; p++) last[Key(p)] = p;
                    matches++;
                    i += len;
                    continue;
                }
            }
            literals++;
            i++;
        }
        double fixedBits = literals * 8.5 + matches * 18;
        double dynamicBits = literals * 5 + matches * 22 + 500;
        return (long)Math.Ceiling(Math.Min(fixedBits, dynamicBits) / 8) + 2;
    }

    private static long EntrySize(ArchiveEntry e) => e.Type == "dir" ? 0 : e.Size ?? LogicalSize(e.Content ?? "");

    /// <summary>Roughly how many bytes deflate makes of the content.</summary>
    private static long PackedSize(string content, long? size = null)
    {
        if (size is long s) return (long)AwkCmd.JsRound(s * 0.45);
        var entries = ReadTar(content);
        // A tar archive is mostly zeros and headers, which compress to almost nothing.
        if (entries is not null) return 2 + entries.Sum(e => 24 + Js.Utf8Length(e.Path) + CompressedEntrySize(e));
        // Already compressed (.gz, .zip) does not get smaller – rather a little larger.
        if (content.StartsWith(GzMagic, StringComparison.Ordinal) || content.StartsWith(ZipMagic, StringComparison.Ordinal)) return LogicalSize(content) + 5;
        return DeflateSize(content);
    }

    /// <summary>Compressed size of a file in an archive. Never larger than the original (then it is stored uncompressed).</summary>
    private static long CompressedEntrySize(ArchiveEntry e)
    {
        if (e.Type == "dir") return 0;
        return Math.Min(PackedSize(e.Content ?? "", e.Size), EntrySize(e));
    }

    private static long CeilDiv(long a, long b) => (long)Math.Ceiling((double)a / b);

    /// <summary>A real tar archive: a 512 byte header per file, content in blocks of 512, in total a multiple of 10240.</summary>
    private static long TarSize(List<ArchiveEntry> entries)
    {
        long n = 1024;
        foreach (var e in entries) n += 512 + CeilDiv(EntrySize(e), 512) * 512;
        return CeilDiv(n, 10240) * 10240;
    }

    private static long GzSize(GzPayload p) =>
        18 + (!string.IsNullOrEmpty(p.N) ? Js.Utf8Length(p.N) + 1 : 0) + PackedSize(p.D, p.S);

    private static long ZipSize(List<ArchiveEntry> entries) =>
        entries.Aggregate(22L, (s, e) => s + 76 + 2 * Js.Utf8Length(EntryLabel(e)) + CompressedEntrySize(e));
}
