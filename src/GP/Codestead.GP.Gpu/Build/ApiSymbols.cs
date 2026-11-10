using System.Reflection;

namespace Codestead.GP.Gpu.Build;

/// <summary>The names each API declares (symbols/&lt;api&gt;.txt, from the real headers) and a "did you mean" for typos.</summary>
public static class ApiSymbols
{
    private static readonly Dictionary<string, HashSet<string>> Cache = new();

    public static HashSet<string> For(string list)
    {
        lock (Cache)
        {
            if (Cache.TryGetValue(list, out var set)) return set;
            set = new HashSet<string>(StringComparer.Ordinal);
            using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream($"symbols/{list}.txt");
            if (stream is not null)
            {
                using var reader = new StreamReader(stream);
                while (reader.ReadLine() is { } line)
                    if (line.Length > 0) set.Add(line);
            }
            Cache[list] = set;
            return set;
        }
    }

    /// <summary>The closest known name (edit distance ≤ 2, or the same ignoring case), or null.</summary>
    public static string? Suggest(string name, IEnumerable<string> known)
    {
        string? best = null;
        int bestDistance = int.MaxValue;
        foreach (var k in known)
        {
            if (Math.Abs(k.Length - name.Length) > 2) continue;
            if (string.Equals(k, name, StringComparison.OrdinalIgnoreCase)) return k;
            int d = Distance(name, k, bestDistance);
            if (d < bestDistance || (d == bestDistance && best is not null && string.CompareOrdinal(k, best) < 0))
            {
                bestDistance = d;
                best = k;
            }
        }
        return bestDistance <= 2 ? best : null;
    }

    private static int Distance(string a, string b, int limit)
    {
        var prev = new int[b.Length + 1];
        var cur = new int[b.Length + 1];
        for (int j = 0; j <= b.Length; j++) prev[j] = j;
        for (int i = 1; i <= a.Length; i++)
        {
            cur[0] = i;
            int rowMin = cur[0];
            for (int j = 1; j <= b.Length; j++)
            {
                int cost = a[i - 1] == b[j - 1] ? 0 : 1;
                cur[j] = Math.Min(Math.Min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
                rowMin = Math.Min(rowMin, cur[j]);
            }
            if (rowMin > Math.Min(limit, 3)) return int.MaxValue;
            (prev, cur) = (cur, prev);
        }
        return prev[b.Length];
    }
}
