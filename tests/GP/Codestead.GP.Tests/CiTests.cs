using System.Text.RegularExpressions;
using Codestead.GP.Course;

namespace Codestead.GP.Tests;

/// <summary>
/// CI runs the TaskTests in parallel jobs, one per group of course parts (CODESTEAD_GP_PARTS in the workflows'
/// matrices). A part missing from a matrix would never be tested there – a new part must be added to both.
/// </summary>
public class CiTests
{
    [Theory(DisplayName = "CI:s parallella uppgiftsjobb täcker varje kursdel")]
    [InlineData(".github/workflows/ci.yml")]
    [InlineData(".github/workflows/release.yml")]
    public void TaskJobsCoverEveryPart(string workflow)
    {
        var text = File.ReadAllText(Path.Combine(Repo.Root, workflow));
        var listed = Regex.Matches(text, @"^\s*-\s*'([a-z-]+(?:,[a-z-]+)*)'\s*$", RegexOptions.Multiline).SelectMany(m => m.Groups[1].Value.Split(',', StringSplitOptions.TrimEntries)).ToList();
        var lessonParts = GpCourse.Parts.Where(p => GpCourse.LessonsIn(p).Count > 0).ToList();
        Assert.Empty(lessonParts.Except(listed));
        Assert.Empty(listed.Except(GpCourse.Parts));
        Assert.Equal(listed.Count, listed.Distinct().Count());
    }
}
