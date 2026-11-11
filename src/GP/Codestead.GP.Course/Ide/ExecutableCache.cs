using System.Collections.Concurrent;

namespace Codestead.GP.Course.Ide;

/// <summary>Remembers which files are executables, by path, size and time, so a scan reads only new or changed files.</summary>
public sealed class ExecutableCache
{
    private readonly ConcurrentDictionary<string, (long Size, DateTime Modified, bool Executable)> known = new(StringComparer.Ordinal);

    public bool IsExecutable(string path, long size, DateTime modified)
    {
        if (known.TryGetValue(path, out var k) && k.Size == size && k.Modified == modified) return k.Executable;
        bool executable = size >= 64 && ProjectFiles.IsExecutable(path);
        if (known.Count > 50000) known.Clear();
        known[path] = (size, modified, executable);
        return executable;
    }
}
