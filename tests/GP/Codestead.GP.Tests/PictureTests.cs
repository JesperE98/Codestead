using System.Text.RegularExpressions;
using Codestead.GP.Course;

namespace Codestead.GP.Tests;

/// <summary>
/// The pictures of the chapters' texts: every one a chapter shows exists in its language (or shared), is embedded and
/// can be read; every picture in src/GP/content/images is used by some chapter.
/// </summary>
public class PictureTests
{
    private static readonly Regex Picture = new(@"!\[[^\]]*\]\((images/[^ )]+)", RegexOptions.CultureInvariant);

    private static IEnumerable<(string Lang, string Chapter, string Path)> Used() =>
        from lang in new[] { "en", "sv" }
        from file in Directory.GetFiles(Path.Combine(Repo.Content, "chapters", lang), "*.md")
        from Match m in Picture.Matches(File.ReadAllText(file))
        select (lang, Path.GetFileNameWithoutExtension(file), m.Groups[1].Value);

    [Fact(DisplayName = "varje bild i kapitlen finns på kapitlets språk och går att läsa")]
    public void EveryPictureExists()
    {
        var missing = Used().Where(u => GpCourse.Picture(u.Path, u.Lang) is not { Length: > 0 }).Select(u => $"{u.Lang}/{u.Chapter}: {u.Path}").ToList();
        Assert.Empty(missing);
    }

    [Fact(DisplayName = "varje bild i images/ används av något kapitel")]
    public void EveryPictureIsUsed()
    {
        var used = Used().Select(u => u.Path[("images/".Length)..]).ToHashSet(StringComparer.Ordinal);
        var root = Path.Combine(Repo.Content, "images");
        var unused = Directory.GetFiles(root, "*", SearchOption.AllDirectories)
            .Where(f => Path.GetExtension(f) is ".webp" or ".png" or ".gif" or ".jpg")
            .Select(f => Path.GetRelativePath(root, f).Replace('\\', '/'))
            .Select(rel => rel.StartsWith("en/", StringComparison.Ordinal) || rel.StartsWith("sv/", StringComparison.Ordinal) ? rel[3..] : rel)
            .Where(rel => !used.Contains(rel)).Distinct().ToList();
        Assert.Empty(unused);
    }
}
