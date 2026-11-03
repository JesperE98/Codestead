using System.Text.RegularExpressions;

namespace Codestead.UI.Tests;

/// <summary>
/// Keeps the source easy to find your way in: one top-level type per file, and no file over
/// <see cref="MaxLines"/> lines. Split a growing class into partial files by responsibility instead.
/// </summary>
public class CodeLayoutTests
{
    public const int MaxLines = 800;

    /// <summary>Files allowed to be larger for now, with the reason. Remove an entry when the file is split.</summary>
    private static readonly Dictionary<string, string> LargeForNow = new();

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Codestead.sln"))) dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Codestead.sln not found");
    }

    /// <summary>A top-level type: declared at the start of a line (file-scoped namespaces, so no indentation).</summary>
    private static readonly Regex TopLevelType = new(
        @"^(?:(?:public|internal|file)\s+)?(?:(?:static|sealed|abstract|partial|readonly)\s+)*(?:class|record|struct|enum|interface)\s+(\w+)",
        RegexOptions.Multiline | RegexOptions.CultureInvariant);

    private static IEnumerable<string> SourceFiles()
    {
        var root = RepoRoot();
        var sep = Path.DirectorySeparatorChar;
        return Directory.GetFiles(Path.Combine(root, "src"), "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{sep}obj{sep}") && !f.Contains($"{sep}bin{sep}"))
            .Select(f => Path.GetRelativePath(root, f).Replace('\\', '/'))
            .Order(StringComparer.Ordinal);
    }

    [Fact(DisplayName = "en typ per fil")]
    public void OneTypePerFile()
    {
        var root = RepoRoot();
        var crowded = SourceFiles()
            .Select(f => (File: f, Types: TopLevelType.Matches(File.ReadAllText(Path.Combine(root, f))).Select(m => m.Groups[1].Value).Distinct().ToList()))
            .Where(x => x.Types.Count > 1)
            .Select(x => $"{x.File}: {string.Join(", ", x.Types)}")
            .ToList();
        Assert.True(crowded.Count == 0, "Put each type in its own file:\n" + string.Join("\n", crowded));
    }

    [Fact(DisplayName = $"inga filer över 800 rader")]
    public void NoHugeFiles()
    {
        var root = RepoRoot();
        var huge = SourceFiles()
            .Where(f => !LargeForNow.ContainsKey(f))
            .Select(f => (File: f, Lines: File.ReadAllLines(Path.Combine(root, f)).Length))
            .Where(x => x.Lines > MaxLines)
            .Select(x => $"{x.File}: {x.Lines} lines")
            .ToList();
        Assert.True(huge.Count == 0, $"Split these into partial files by responsibility (max {MaxLines} lines):\n" + string.Join("\n", huge));
        foreach (var file in LargeForNow.Keys)
            Assert.True(File.Exists(Path.Combine(root, file)), $"{file} no longer exists: remove it from LargeForNow");
    }

    [Fact(DisplayName = "varje app anropar Velopack i sin egen Main")]
    public void AppsCallVelopackInTheirOwnMain()
    {
        // `vpk pack` refuses to package an app whose own assembly does not call VelopackApp.Build().Run().
        var root = RepoRoot();
        var apps = Directory.GetFiles(Path.Combine(root, "src"), "Program.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}"))
            .ToList();
        Assert.NotEmpty(apps);
        foreach (var program in apps)
            Assert.True(File.ReadAllText(program).Contains("VelopackApp.Build().Run();"),
                $"{Path.GetRelativePath(root, program)}: call VelopackApp.Build().Run() first in Main");
    }
}
