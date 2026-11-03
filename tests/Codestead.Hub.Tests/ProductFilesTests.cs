using System.Text.Json;
using System.Text.RegularExpressions;

namespace Codestead.Hub.Tests;

/// <summary>
/// packaging/products.json says which files belong to each product; a product only gets a new version when
/// they change. The hub leaves out parts of the shared src/Codestead.UI that only Codestead Linux uses – this
/// checks that the hub (and the parts of Codestead.UI it does use) really never touch them.
/// </summary>
public class ProductFilesTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Codestead.sln"))) dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Codestead.sln not found");
    }

    private static readonly Regex TypeRe = new(@"\b(?:class|record|struct|enum|interface)\s+([A-Z]\w*)", RegexOptions.CultureInvariant);

    [Fact(DisplayName = "hubben använder inget av det som products.json undantar för den")]
    public void HubDoesNotUseItsExcludedFiles()
    {
        var root = RepoRoot();
        using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(root, "packaging", "products.json")));
        var hub = doc.RootElement.EnumerateArray().Single(p => p.GetProperty("key").GetString() == "hub");
        var excluded = hub.GetProperty("exclude").EnumerateArray().Select(e => Path.Combine(root, e.GetString()!)).ToList();

        var excludedFiles = new List<string>();
        foreach (var e in excluded)
        {
            Assert.True(File.Exists(e) || Directory.Exists(e), $"products.json excludes {e}, which does not exist");
            excludedFiles.AddRange(Directory.Exists(e) ? Directory.GetFiles(e, "*.cs", SearchOption.AllDirectories) : [e]);
        }
        var types = excludedFiles.SelectMany(f => TypeRe.Matches(File.ReadAllText(f)).Select(m => m.Groups[1].Value)).ToHashSet();
        Assert.NotEmpty(types);

        static bool Built(string f) => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}") && !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}");
        var users = new[] { "src/Codestead.Hub", "src/Codestead.Hub.Core", "src/Codestead.UI" }
            .SelectMany(d => Directory.GetFiles(Path.Combine(root, d), "*.*", SearchOption.AllDirectories))
            .Where(f => (f.EndsWith(".cs") || f.EndsWith(".axaml")) && Built(f) && !excludedFiles.Contains(f));
        foreach (var file in users)
        {
            var text = File.ReadAllText(file);
            foreach (var type in types)
                Assert.False(Regex.IsMatch(text, $@"\b{type}\b"),
                    $"{Path.GetRelativePath(root, file)} uses {type}, which packaging/products.json excludes from the hub. Remove it from \"exclude\" there.");
        }
    }
}
