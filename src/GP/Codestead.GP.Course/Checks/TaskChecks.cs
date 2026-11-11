namespace Codestead.GP.Course.Checks;

/// <summary>
/// Every task's check, by chapter and task id. A check may look at the API (c.Api) when the APIs differ. The
/// checks of each chapter are in their own file (TaskChecks.&lt;Chapter&gt;.cs).
/// </summary>
public static partial class TaskChecks
{
    private static readonly Lazy<Dictionary<string, TaskCheck>> All = new(() =>
    {
        var d = new Dictionary<string, TaskCheck>(StringComparer.Ordinal);
        void Add(string chapter, IReadOnlyDictionary<string, TaskCheck> checks)
        {
            foreach (var (task, check) in checks) d[$"{chapter}/{task}"] = check;
        }
        Add("introduction", Introduction);
        Add("creating-a-window", CreatingAWindow);
        Add("hello-window", HelloWindow);
        Add("hello-triangle", HelloTriangle);
        Add("shaders", Shaders);
        Add("textures", Textures);
        Add("transformations", Transformations);
        Add("coordinate-systems", CoordinateSystems);
        Add("camera", Camera);
        foreach (var (chapter, checks) in Lighting) Add(chapter, checks);
        foreach (var (chapter, checks) in ModelLoading) Add(chapter, checks);
        foreach (var (chapter, checks) in AdvancedOpenGL) Add(chapter, checks);
        foreach (var (chapter, checks) in AdvancedOpenGL3) Add(chapter, checks);
        foreach (var (chapter, checks) in AdvancedLighting) Add(chapter, checks);
        foreach (var (chapter, checks) in AdvancedLighting2) Add(chapter, checks);
        foreach (var (chapter, checks) in AdvancedLighting3) Add(chapter, checks);
        foreach (var (chapter, checks) in AdvancedLighting4) Add(chapter, checks);
        foreach (var (chapter, checks) in Pbr) Add(chapter, checks);
        foreach (var (chapter, checks) in InPractice) Add(chapter, checks);
        foreach (var (chapter, checks) in InPractice2) Add(chapter, checks);
        foreach (var (chapter, checks) in InPractice3) Add(chapter, checks);
        foreach (var (chapter, checks) in GuestArticles) Add(chapter, checks);
        foreach (var (chapter, checks) in GuestArticles2) Add(chapter, checks);
        return d;
    });

    public static TaskCheck? For(string chapterId, string taskId) => All.Value.GetValueOrDefault($"{chapterId}/{taskId}");
}
