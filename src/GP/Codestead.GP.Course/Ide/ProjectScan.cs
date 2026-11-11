using System.Security.Cryptography;
using System.Text;

namespace Codestead.GP.Course.Ide;

/// <summary>
/// One look at the learner's project folder: the newest source (compiled, and read when running), a fingerprint of
/// every source (path, size, time), and the executables anywhere under the folder (build folders included).
/// </summary>
public sealed record ProjectScan(
    bool FolderExists,
    DateTime? NewestCompiled,
    DateTime? NewestRuntime,
    string Fingerprint,
    IReadOnlyList<ExecutableFile> Executables)
{
    /// <summary>At most this many files and folders are looked at (a folder that is someone's whole disk stays cheap).</summary>
    public const int MaxEntries = 20000;

    /// <summary>How deep folders are looked into.</summary>
    public const int MaxDepth = 8;

    public static ProjectScan Empty { get; } = new(false, null, null, "", []);

    /// <summary>The newest executable, the program the learner built last (null: none found).</summary>
    public ExecutableFile? Newest => Executables.Count == 0 ? null : Executables.MaxBy(e => e.Modified);

    /// <summary>Scans a folder. Executables are recognised by their first bytes, read only for new or changed files.</summary>
    public static ProjectScan Of(string folder, ExecutableCache? cache = null)
    {
        if (!Directory.Exists(folder)) return Empty;
        cache ??= new ExecutableCache();
        DateTime? compiled = null, runtime = null;
        var sources = new List<(string Path, long Size, long Ticks)>();
        var executables = new List<ExecutableFile>();
        int entries = 0;
        var pending = new Stack<(string Dir, int Depth, bool InBuild)>();
        pending.Push((folder, 0, false));
        while (pending.Count > 0 && entries < MaxEntries)
        {
            var (dir, depth, inBuild) = pending.Pop();
            IEnumerable<FileSystemInfo> items;
            try
            {
                items = new DirectoryInfo(dir).EnumerateFileSystemInfos("*", new EnumerationOptions { IgnoreInaccessible = true, AttributesToSkip = FileAttributes.ReparsePoint });
                foreach (var item in items)
                {
                    if (++entries > MaxEntries) break;
                    if (item is DirectoryInfo d)
                    {
                        if (depth + 1 > MaxDepth || ProjectFiles.IsSkippedDir(d.Name)) continue;
                        pending.Push((d.FullName, depth + 1, inBuild || ProjectFiles.IsBuildDir(d.Name)));
                        continue;
                    }
                    var f = (FileInfo)item;
                    var modified = f.LastWriteTimeUtc;
                    if (!inBuild && ProjectFiles.IsSource(f.Name))
                    {
                        sources.Add((Path.GetRelativePath(folder, f.FullName).Replace('\\', '/'), f.Length, modified.Ticks));
                        if (ProjectFiles.IsCompiled(f.Name)) compiled = Max(compiled, modified);
                        else runtime = Max(runtime, modified);
                        continue;
                    }
                    if (cache.IsExecutable(f.FullName, f.Length, modified)) executables.Add(new ExecutableFile(f.FullName, modified, f.Length));
                }
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException or System.Security.SecurityException)
            {
                // A folder that went away or cannot be read while scanning: the rest still counts.
            }
        }
        sources.Sort((a, b) => string.CompareOrdinal(a.Path, b.Path));
        var text = new StringBuilder();
        foreach (var (path, size, ticks) in sources) text.Append(path).Append('|').Append(size).Append('|').Append(ticks).Append('\n');
        var fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text.ToString())));
        return new ProjectScan(true, compiled, runtime, fingerprint, executables);
    }

    private static DateTime Max(DateTime? a, DateTime b) => a is { } x && x > b ? x : b;
}
