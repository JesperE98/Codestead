using Codestead.GP.Gpu;
using Codestead.Learning.Game;
using static Codestead.Learning.Game.CommonAchievements;

namespace Codestead.GP.Course.Game;

/// <summary>The achievements of Codestead GP, in gallery order. Texts: ach.&lt;id&gt;.title / .desc in the UI strings.</summary>
public static class GpAchievements
{
    private static bool Build(AchievementContext c, Func<BuildFacts, bool> test) => c.Command is BuildFacts b && test(b);

    /// <summary>The APIs in which the learner has solved at least one task.</summary>
    public static int ApisUsed(AchievementContext c) => Apis.All.Count(a => c.Progress.Tasks.Any(t => t.EndsWith("@" + a.Id, StringComparison.Ordinal)));

    public static IReadOnlyList<Achievement> All { get; } = new List<Achievement>
    {
        // Learning
        FirstTask,
        FirstChapter,
        Tasks(25, "🧩"),
        TasksAll,
        PartDone("start", "🚪"),
        PartDone("getting-started", "🔺"),
        PartDone("lighting", "💡"),
        PartDone("model-loading", "🪐"),
        PartDone("advanced-opengl", "🧪"),
        PartDone("advanced-lighting", "🌗"),
        PartDone("pbr", "💎"),
        PartDone("in-practice", "🎮"),
        Count("all-apis", "🌐", AchievementCategory.Learning, ApisUsed, 3),
        Checkpoints(25, "🤔"),
        // The workbench
        new("first-build", "🔨", AchievementCategory.Terminal, c => Build(c, b => b.Succeeded)),
        new("first-frame", "🪟", AchievementCategory.Terminal, c => Build(c, b => b.ShowsFrames)),
        new("first-draw", "🎨", AchievementCategory.Terminal, c => Build(c, b => b.Drew)),
        Count("builds-100", "⚙️", AchievementCategory.Terminal, c => c.Game.Stats.Commands, 100),
        Count("functions-25", "📚", AchievementCategory.Terminal, c => c.Game.Stats.CommandNames.Count, 25),
        // Habits
        Unaided(10, "🎯"),
        Streak(3, "🌱"),
        Streak(7, "🔥"),
        Streak(30, "🌋"),
        // Hidden – found by experimenting
        new("typo", "🔤", AchievementCategory.Hidden, c => Build(c, b => b.Typo)),
        new("magenta", "💖", AchievementCategory.Hidden, c => Build(c, b => b.ClearColor is { } cc && cc[0] > 0.99 && cc[1] < 0.01 && cc[2] > 0.99)),
        new("night-owl", "🦉", AchievementCategory.Hidden, c => c.SolvedNow.Count > 0 && c.Now.Hour < 4),
    };
}
