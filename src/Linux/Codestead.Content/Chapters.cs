namespace Codestead.Content;

// Port of src/content/chapters.ts – all chapters and their tasks.
// The text is in src/content/chapters/<lang>/*.md; the tasks and their checks are here
// (the chapter definitions are in ChapterDefinitions.cs and Chapters/<part>/<id>.cs, the check helpers in Checks.cs).

public static partial class ChaptersLib
{
    // ---------- Parts and chapters ----------

    /// <summary>The distribution the terminal runs outside the "distro" main chapter.</summary>
    public const string DefaultDistro = "ubuntu";

    /// <summary>
    /// The main chapters in order. The fundamentals come first and are the same on every distribution;
    /// distributions and package managers get their own main chapter (the only one with a distro choice).
    /// </summary>
    public static List<Part> Parts { get; } = new()
    {
        new() { Id = "start", Title = "Kom igång" },
        new() { Id = "grunder", Title = "Grunderna" },
        new() { Id = "system", Title = "Systemet" },
        new() { Id = "distro", Title = "Distributioner och paket", DistroChoice = true },
        new() { Id = "admin", Title = "Systemadministration" },
        new() { Id = "natverk", Title = "Nätverk" },
        new() { Id = "skript", Title = "Skript och automatisering" },
        new() { Id = "verktyg", Title = "Fler verktyg" },
    };

    /// <summary>
    /// All chapters, shown in the same order as the parts in <see cref="Parts"/>
    /// (stable sort keeps the order within a part). Each main chapter ends with a summary and an exam
    /// when their texts exist (src/Linux/content/chapters/&lt;lang&gt;/&lt;part&gt;-summary.md and -exam.md).
    /// </summary>
    public static List<Chapter> Chapters { get; } = WithSummariesAndExams(DefineChapters())
        .OrderBy(ch => Parts.FindIndex(p => p.Id == ch.Part))
        .ToList();

    private static IEnumerable<Chapter> WithSummariesAndExams(IEnumerable<Chapter> lessons)
    {
        var list = lessons.ToList();
        foreach (var part in Parts)
        {
            int last = list.FindLastIndex(c => c.Part == part.Id);
            if (last < 0) continue;
            var extra = new List<Chapter>();
            foreach (var kind in new[] { ChapterKinds.Summary, ChapterKinds.Exam })
            {
                var id = $"{part.Id}-{kind}";
                if (Resources.Read($"chapters/en/{id}.md") is null) continue;
                extra.Add(new Chapter { Id = id, Part = part.Id, Kind = kind });
            }
            list.InsertRange(last + 1, extra);
        }
        return list;
    }

    public static Part PartOf(Chapter chapter) => Parts.First(p => p.Id == chapter.Part);

    /// <summary>
    /// The distribution a chapter runs on: outside the distro main chapter always <see cref="DefaultDistro"/>;
    /// inside it the student's choice – limited to the chapter's family for a family chapter
    /// (the family's first distribution if the choice belongs to another family).
    /// </summary>
    public static string DistroFor(Chapter chapter, string chosenDistroId)
    {
        if (!PartOf(chapter).DistroChoice) return DefaultDistro;
        var choices = DistrosFor(chapter);
        return choices.FirstOrDefault(d => d.Id == chosenDistroId)?.Id ?? choices[0].Id;
    }

    /// <summary>The distributions the student can choose between in a chapter (one = no choice).</summary>
    public static List<Distro> DistrosFor(Chapter chapter) =>
        !PartOf(chapter).DistroChoice ? new() { DistrosLib.GetDistro(DefaultDistro) }
        : chapter.Family is null ? DistrosLib.Distros.ToList()
        : DistrosLib.Distros.Where(d => d.Family == chapter.Family).ToList();

    /// <summary>The lesson chapters of a main chapter (not the summary and exam).</summary>
    public static List<Chapter> LessonsIn(string partId) =>
        Chapters.Where(c => c.Part == partId && c.Kind == ChapterKinds.Lesson).ToList();

    /// <summary>Planned chapters – shown in the menu as "coming soon".</summary>
    public static List<string> Upcoming { get; } = new();

    public static string TaskKey(string chapterId, string taskId, bool? perFamily, Family family) =>
        perFamily == true ? $"{chapterId}/{taskId}@{family}" : $"{chapterId}/{taskId}";
}
