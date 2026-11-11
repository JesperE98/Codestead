using Codestead.GP.Gpu;

namespace Codestead.GP.Course.Ide;

/// <summary>Copies a chapter's start files (code, shaders and the course's images, models and fonts) into a folder.</summary>
public static class StartFiles
{
    /// <summary>The files of a project as (relative path, bytes).</summary>
    public static IEnumerable<(string Path, byte[] Bytes)> Of(GpuProject project) =>
        project.Files.Select(f => (f.Key, System.Text.Encoding.UTF8.GetBytes(f.Value)))
            .Concat(project.Assets.Select(a => (a.Key, a.Value)));

    /// <summary>The files that exist in the folder with other contents (they would be overwritten).</summary>
    public static IReadOnlyList<string> Conflicts(string folder, GpuProject project)
    {
        var list = new List<string>();
        foreach (var (path, bytes) in Of(project))
        {
            var target = Target(folder, path);
            try
            {
                if (File.Exists(target) && !Same(File.ReadAllBytes(target), bytes)) list.Add(path);
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException)
            {
                list.Add(path);
            }
        }
        return list;
    }

    /// <summary>Writes the files (overwriting); returns how many were written.</summary>
    public static int Copy(string folder, GpuProject project)
    {
        int n = 0;
        foreach (var (path, bytes) in Of(project))
        {
            var target = Target(folder, path);
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.WriteAllBytes(target, bytes);
            n++;
        }
        return n;
    }

    private static string Target(string folder, string path)
    {
        var full = Path.GetFullPath(Path.Combine(folder, path.Replace('/', Path.DirectorySeparatorChar)));
        var root = Path.GetFullPath(folder).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!full.StartsWith(root, OperatingSystem.IsLinux() ? StringComparison.Ordinal : StringComparison.OrdinalIgnoreCase))
            throw new IOException($"{path} is outside the project folder.");
        return full;
    }

    /// <summary>Text compares without line-ending differences (Git on Windows checks out CRLF).</summary>
    private static bool Same(byte[] a, byte[] b) =>
        a.AsSpan().SequenceEqual(b) || (a.Length < 4 * 1024 * 1024 && Normalize(a) == Normalize(b));

    private static string Normalize(byte[] bytes) => System.Text.Encoding.UTF8.GetString(bytes).Replace("\r\n", "\n");
}
