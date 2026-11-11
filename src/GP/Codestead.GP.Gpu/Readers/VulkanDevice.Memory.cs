using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;
using Codestead.GP.Gpu.Textures;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Readers;

// Memory: memcpy into mapped memory, the formats the program fills itself, copies between buffers and images, reads.
internal sealed partial class VulkanDevice
{
    private void Write(Expr dst, Expr from, Expr? size)
    {
        var address = Eval(dst) is { V: { Length: > 0 } v } ? v[0] : 0;
        if (address < AddressUnit) return;
        int m = (int)(address / AddressUnit) - 1;
        if (m < 0 || m >= memories.Count) return;
        long offset = (long)(address - (m + 1) * AddressUnit);
        var value = Eval(Strip(from));
        if (value is null) return;
        if (value.Text is { } key && loaded.ContainsKey(key))
        {
            memories[m].Images[offset] = key;
            return;
        }
        var numbers = new List<double>();
        CppExec.Flatten(value, numbers);
        // 16-bit indices (std::vector<uint16_t> indices) take 2 bytes each.
        // 16-bit indices take 2 bytes each, bytes (std::vector<unsigned char>: a glyph atlas) 1.
        int bytes = 4;
        if (SourceName(Strip(from)) is { } n && src.DeclaredType(n) is { } type)
        {
            if (System.Text.RegularExpressions.Regex.IsMatch(type, @"uint16|int16|short", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) bytes = 2;
            else if (System.Text.RegularExpressions.Regex.IsMatch(type, @"char\b|uint8|int8|\bBYTE\b|stbi_uc|GLubyte", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) bytes = 1;
        }
        long limit = size is null ? long.MaxValue : bytes == 1 ? (long)Num(size) : (long)Num(size) * bytes / 4;
        if (limit < (long)numbers.Count * bytes) numbers = numbers.Take((int)Math.Max(0, (limit + bytes - 1) / bytes)).ToList();
        memories[m].Write(offset, bytes, numbers);
    }

    /// <summary>The variable a memcpy source names: pixels, atlas.data(), &amp;atlas[0].</summary>
    private static string? SourceName(Expr e) => e switch
    {
        Name n => n.Id,
        Call { Function: ".data", Args: [var t] } => SourceName(t),
        IndexOf { Target: var t } => SourceName(t),
        Member m => m.Field,
        _ => null,
    };

    /// <summary>Bytes per texel of an 8-bit format the program fills itself (R8 … R8G8B8A8), or 0.</summary>
    private static int BytesPerTexel(string format) => format switch
    {
        _ when format.Contains("R8G8B8A8", StringComparison.Ordinal) || format.Contains("B8G8R8A8", StringComparison.Ordinal) => 4,
        _ when format.Contains("R8G8B8_", StringComparison.Ordinal) => 3,
        _ when format.Contains("R8G8_", StringComparison.Ordinal) => 2,
        _ when format.Contains("R8_", StringComparison.Ordinal) => 1,
        _ => 0,
    };

    /// <summary>Floats per texel of a 32-bit float format (R32G32B32A32_SFLOAT …), or 0.</summary>
    private static int FloatsPerTexel(string format) => format switch
    {
        _ when format.Contains("R32G32B32A32_SFLOAT", StringComparison.Ordinal) => 4,
        _ when format.Contains("R32G32B32_SFLOAT", StringComparison.Ordinal) => 3,
        _ when format.Contains("R32G32_SFLOAT", StringComparison.Ordinal) => 2,
        _ when format.Contains("R32_SFLOAT", StringComparison.Ordinal) => 1,
        _ => 0,
    };

    private void Copy(string? from, long fromOffset, string? to, long toOffset, long bytes)
    {
        if (from is null || to is null || !buffers.TryGetValue(from, out var s) || !buffers.TryGetValue(to, out var d) || s.Memory < 0 || d.Memory < 0) return;
        var src = memories[s.Memory];
        var dst = memories[d.Memory];
        long a = s.Offset + fromOffset, b = d.Offset + toOffset;
        // Runs stay runs (a texture's floats through a staging buffer).
        foreach (var r in src.Runs.Where(r => r.Start >= a && r.Start + (long)r.Values.Length * r.Step <= a + bytes).ToList()) dst.Write(r.Start - a + b, r.Step, r.Values);
        foreach (var (k, v) in src.Bytes.Where(kv => kv.Key >= a && kv.Key < a + bytes).ToList()) dst.Set(k - a + b, v);
        foreach (var (k, v) in src.Images.Where(kv => kv.Key >= a && kv.Key < a + bytes).ToList()) dst.Images[k - a + b] = v;
    }

    /// <summary>Numbers of a buffer at a byte offset (from where it is bound in its memory).</summary>
    public double[]? Read(string buffer, long byteOffset, int comps)
    {
        if (!buffers.TryGetValue(buffer, out var place) || place.Memory < 0) return null;
        var mem = memories[place.Memory];
        long at = place.Offset + byteOffset;
        if (!mem.TryGet(at, out _)) return null;
        var r = new double[comps];
        for (int k = 0; k < comps; k++) r[k] = mem.TryGet(at + k * 4, out var x) ? x : 0;
        return r;
    }

    public double? ReadIndex(string buffer, long byteOffset) =>
        buffers.TryGetValue(buffer, out var place) && place.Memory >= 0 && memories[place.Memory].TryGet(place.Offset + byteOffset, out var x) ? x : null;
}
