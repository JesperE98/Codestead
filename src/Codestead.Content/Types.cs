namespace Codestead.Content;

// Port of src/content/types.ts.

/// <summary>What a task may look at after each command. (TS: CheckCtx)</summary>
public partial class CheckContext
{
    public required Shell.Shell Sh { get; init; }
    public required Distro Distro { get; init; }
    /// <summary>The command line that was run (without leading/trailing spaces).</summary>
    public string Line { get; init; } = "";
    /// <summary>Output without colour codes.</summary>
    public string Output { get; init; } = "";
    public int ExitCode { get; init; }
}

/// <summary>Text that differs between the families, e.g. in the translation files.</summary>
public partial class FamilyText
{
    public string? Debian { get; set; }
    public string? Arch { get; set; }
    public string? Redhat { get; set; }

    /// <summary>familyText[family]</summary>
    public string? Get(Family family) => family switch
    {
        "debian" => Debian,
        "arch" => Arch,
        "redhat" => Redhat,
        _ => null,
    };
}

/// <summary>
/// TS: <c>PerDistro&lt;T&gt; = T | ((d: Distro) =&gt; T)</c> – a value, or a function that picks the value for a distro.
/// Converts implicitly from both.
/// </summary>
public sealed partial class PerDistro<T>
{
    private readonly T? value;
    private readonly Func<Distro, T>? fn;

    public PerDistro(T value) => this.value = value;

    public PerDistro(Func<Distro, T> fn) => this.fn = fn;

    public static implicit operator PerDistro<T>(T value) => new(value);

    public static implicit operator PerDistro<T>(Func<Distro, T> fn) => new(fn);

    /// <summary>True when this is a function of the distro (rather than a plain value).</summary>
    public bool IsFunction => fn is not null;

    public T Resolve(Distro d) => fn is not null ? fn(d) : value!;

    /// <summary>JS truthiness of the raw value (a function is always truthy; a string must be non-empty).</summary>
    internal bool Truthy => fn is not null || (value is string s ? s.Length > 0 : value is not null);
}

/// <summary>A task in a chapter. (TS: Task – renamed because of System.Threading.Tasks.Task.)</summary>
public partial class ChapterTask
{
    public string Id { get; set; } = "";
    /// <summary>Task text (markdown, one line).</summary>
    public PerDistro<string> Text { get; set; } = "";
    public PerDistro<string>? Hint { get; set; }
    /// <summary>Commands that solve the task. Used for "Show solution" and in the tests.</summary>
    public PerDistro<List<string>> Solution { get; set; } = new List<string>();
    /// <summary>The task is counted separately for each distribution family.</summary>
    public bool? PerFamily { get; set; }
    public Func<CheckContext, bool> Check { get; set; } = _ => false;

    /// <summary>The solution for a distribution, with the student's world filled in (e.g. ~/{{documents}} → ~/documents).</summary>
    public List<string> SolutionFor(Distro d, World w) => Solution.Resolve(d).Select(w.Expand).ToList();
}

public partial class Chapter
{
    public string Id { get; set; } = "";
    public string Part { get; set; } = "";
    /// <summary>Title in Swedish. Other languages are in i18n/&lt;lang&gt;/&lt;id&gt;.json.</summary>
    public string Title { get; set; } = "";
    public List<ChapterTask> Tasks { get; set; } = new();
    /// <summary>
    /// "lesson" (text, checkpoints, tasks and terminal), "summary" (recap of a main chapter, text only)
    /// or "exam" (the test at the end of a main chapter).
    /// </summary>
    public string Kind { get; set; } = ChapterKinds.Lesson;
    /// <summary>
    /// A chapter about one distribution family ("debian", "arch", "redhat") runs on a distribution of
    /// that family; null means any (the student's choice in the distro main chapter, Ubuntu elsewhere).
    /// </summary>
    public string? Family { get; set; }
}

public static class ChapterKinds
{
    public const string Lesson = "lesson";
    public const string Summary = "summary";
    public const string Exam = "exam";
}

/// <summary>A main chapter ("part"), e.g. "The basics". Its sub-chapters are the <see cref="Chapter"/>s with this part id.</summary>
public partial class Part
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    /// <summary>
    /// The only main chapter where the student picks a distribution. Everywhere else the terminal runs
    /// <see cref="ChaptersLib.DefaultDistro"/>, so the basics are learnt without distribution differences.
    /// </summary>
    public bool DistroChoice { get; set; }
}

/// <summary>A link to an official source, shown at the end of a sub-chapter.</summary>
public partial class Reference
{
    public string Title { get; set; } = "";
    public string Url { get; set; } = "";
    public string Publisher { get; set; } = "";
}

/// <summary>Translation of a chapter: src/content/i18n/&lt;lang&gt;/&lt;chapter-id&gt;.json</summary>
public partial class ChapterStrings
{
    public string? Title { get; set; }
    public OrderedDictionary<string, ChapterTaskStrings>? Tasks { get; set; }
}

/// <summary>One task in <see cref="ChapterStrings"/>: text and hint, each a string or a <see cref="FamilyText"/>.</summary>
public partial class ChapterTaskStrings
{
    public PerDistro<string>? Text { get; set; }
    public PerDistro<string>? Hint { get; set; }
}

public static partial class TypesLib
{
    public static T Resolve<T>(PerDistro<T> v, Distro d) => v.Resolve(d);

    public static string? Resolve(FamilyText v, Distro d) => v.Get(d.Family);

    /// <summary>A PerDistro text from a FamilyText.</summary>
    public static PerDistro<string> FromFamilyText(FamilyText ft) => new(d => ft.Get(d.Family)!);
}
