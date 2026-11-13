using System.Text.RegularExpressions;
using Codestead.GP.Gpu;

namespace Codestead.GP.Course.Ide;

/// <summary>
/// Reads the learner's code into a project the checks can look at. The learner picks the chapter's main file (any
/// name, anywhere: they organise their code as they like); the chapter's other files (its start files and the files
/// its tasks create: shaders, headers) are found by their path in the course or by name in the main file's folder and
/// the folders below it, else in the folder above it ("src/main.cpp" with "shaders/" beside "src/"), outside the build
/// folders. The images, models and fonts come from there when they are there, else from the course. Library code kept
/// in the project (GLAD, GLM, stb_image …) is not read: it is not the learner's, and the checks look at the learner's code.
/// </summary>
public static partial class ProjectReader
{
    /// <summary>Larger text files are not the learner's code.</summary>
    public const long MaxTextSize = 2 * 1024 * 1024;

    /// <summary>How many files and folders a search looks at, and how deep: a folder like the home folder is not searched through.</summary>
    public const int MaxEntries = 20000;

    public const int MaxDepth = 8;

    [GeneratedRegex(@"\b(?:w?WinMain|main)\s*\(")]
    private static partial Regex MainFunction();

    /// <summary>The chapter's code from the main file the learner picked and the folders around it.</summary>
    public static ProjectRead ReadFrom(string mainFile, string chapterId, string api)
    {
        var folder = Path.GetDirectoryName(Path.GetFullPath(mainFile))!;
        var roots = new List<(string Root, List<string> Files)> { (folder, List(folder)) };
        if (Directory.GetParent(folder) is { } parent) roots.Add((parent.FullName, List(parent.FullName)));
        // A picked main file that is gone is missing: another main file nearby is not the learner's choice.
        return Read(roots, chapterId, api, File.Exists(mainFile) ? Path.GetFullPath(mainFile) : null, mainGiven: true);
    }

    /// <summary>The chapter's code from a folder: the main file is the course's, or the C++ file with main().</summary>
    public static ProjectRead Read(string folder, string chapterId, string api)
    {
        var files = List(folder);
        var main = FindMain(folder, files);
        return Read([(folder, files)], chapterId, api, main is null ? null : Path.Combine(folder, main), mainGiven: false);
    }

    private static ProjectRead Read(IReadOnlyList<(string Root, List<string> Files)> roots, string chapterId, string api, string? mainFile, bool mainGiven)
    {
        var start = GpCourse.StartProject(chapterId, api);
        var expected = start.Files.Keys.Concat(GpCourse.Tasks(chapterId, api).SelectMany(t => t.Edits).Select(e => e.File)).Distinct().ToList();
        var project = new GpuProject();
        var missing = new List<string>();
        foreach (var path in expected)
        {
            var found = path != start.MainFile ? Locate(roots, path) : mainFile ?? (mainGiven ? null : Locate(roots, path));
            if (found is null)
            {
                if (start.Files.ContainsKey(path)) missing.Add(path);
                continue;
            }
            if (ReadText(found) is { } text) project.Files[path] = text.Replace("\r\n", "\n");
        }
        foreach (var (path, bytes) in start.Assets)
        {
            byte[]? own = null;
            if (Locate(roots, path) is { } found)
            {
                try
                {
                    own = File.ReadAllBytes(found);
                }
                catch (Exception e) when (e is IOException or UnauthorizedAccessException)
                {
                }
            }
            project.Assets[path] = own ?? bytes;
        }
        return new ProjectRead(project, missing);
    }

    /// <summary>A course file in the first folder that has it (full path).</summary>
    private static string? Locate(IReadOnlyList<(string Root, List<string> Files)> roots, string coursePath)
    {
        foreach (var (root, files) in roots)
            if (Find(files, coursePath) is { } found) return Path.Combine(root, found);
        return null;
    }

    /// <summary>The files under the folder outside build, IDE and skipped folders (relative, with '/').</summary>
    public static List<string> List(string folder)
    {
        var list = new List<string>();
        if (!Directory.Exists(folder)) return list;
        var pending = new Stack<(string Dir, int Depth)>();
        pending.Push((folder, 0));
        int entries = 0;
        while (pending.Count > 0 && entries < MaxEntries)
        {
            var (dir, depth) = pending.Pop();
            try
            {
                foreach (var item in new DirectoryInfo(dir).EnumerateFileSystemInfos("*", new EnumerationOptions { IgnoreInaccessible = true, AttributesToSkip = FileAttributes.ReparsePoint }))
                {
                    if (++entries > MaxEntries) break;
                    if (item is DirectoryInfo d)
                    {
                        if (depth + 1 <= MaxDepth && !ProjectFiles.IsSkippedDir(d.Name) && !ProjectFiles.IsBuildDir(d.Name)) pending.Push((d.FullName, depth + 1));
                        continue;
                    }
                    list.Add(Path.GetRelativePath(folder, item.FullName).Replace('\\', '/'));
                }
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException or System.Security.SecurityException)
            {
            }
        }
        list.Sort(StringComparer.Ordinal);
        return list;
    }

    /// <summary>
    /// A file of the course's project in the folder: at its path, else the file with its name whose path ends like the
    /// course's ("src/shaders/shader.vert" for "shaders/shader.vert"), outside library folders, the shortest.
    /// </summary>
    public static string? Find(IReadOnlyList<string> files, string coursePath)
    {
        var exact = files.FirstOrDefault(f => string.Equals(f, coursePath, StringComparison.OrdinalIgnoreCase));
        if (exact is not null) return exact;
        var name = Path.GetFileName(coursePath);
        return files.Where(f => string.Equals(Path.GetFileName(f), name, StringComparison.OrdinalIgnoreCase))
            .OrderBy(f => f.EndsWith("/" + coursePath, StringComparison.OrdinalIgnoreCase) ? 0 : 1)
            .ThenBy(f => InLibrary(f) ? 1 : 0)
            .ThenBy(f => f.Count(c => c == '/'))
            .ThenBy(f => f, StringComparer.Ordinal)
            .FirstOrDefault();
    }

    private static bool InLibrary(string relative) => relative.Split('/')[..^1].Any(ProjectFiles.IsLibraryDir);

    /// <summary>The learner's C++ file with main() or WinMain(), outside library folders.</summary>
    private static string? FindMain(string folder, IReadOnlyList<string> files)
    {
        foreach (var f in files.Where(f => !InLibrary(f) && Path.GetExtension(f).ToLowerInvariant() is ".cpp" or ".cc" or ".cxx").OrderBy(f => f.Count(c => c == '/')))
            if (ReadText(Path.Combine(folder, f)) is { } text && MainFunction().IsMatch(Gpu.Readers.CppSource.BlankComments(text))) return f;
        return null;
    }

    private static string? ReadText(string path)
    {
        try
        {
            var info = new FileInfo(path);
            return info.Exists && info.Length <= MaxTextSize ? File.ReadAllText(path) : null;
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }
}
