namespace Codestead.Content;

// One task in a chapter: text, hint, solution and check.

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
