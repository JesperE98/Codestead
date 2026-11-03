namespace Codestead.Content.Game;

public enum AchievementCategory { Learning, Exams, Terminal, Habits, Hidden }

/// <summary>Everything an achievement can look at when it is checked.</summary>
/// <param name="Command">The command just run, if the check comes from a command.</param>
/// <param name="SolvedNow">Tasks solved by that command.</param>
/// <param name="Now">Local time.</param>
public sealed record AchievementContext(GameState Game, ProgressView Progress, CommandInfo? Command, IReadOnlyList<string> SolvedNow, DateTime Now)
{
    public int Level => Levels.LevelOf(XpRules.Total(Game, Progress));
}

/// <summary>
/// An achievement. Title and description are the UI strings ach.&lt;id&gt;.title and ach.&lt;id&gt;.desc. Hidden ones
/// are shown as "???" until found. <see cref="Counter"/> gives the progress ("62 / 100") of counting ones.
/// </summary>
public sealed record Achievement(string Id, string Icon, AchievementCategory Category, Func<AchievementContext, bool> Done,
    Func<AchievementContext, (int Current, int Target)>? Counter = null)
{
    public bool Hidden => Category == AchievementCategory.Hidden;
    public string TitleKey => $"ach.{Id}.title";
    public string DescKey => $"ach.{Id}.desc";
}

public static class AchievementsLib
{
    private static Achievement Count(string id, string icon, AchievementCategory cat, Func<AchievementContext, int> current, int target) =>
        new(id, icon, cat, c => current(c) >= target, c => (Math.Min(current(c), target), target));

    private static bool Cmd(AchievementContext c, Func<CommandInfo, bool> test) => c.Command is { } cmd && test(cmd);

    private static int Families(AchievementContext c) =>
        new[] { "@debian", "@arch", "@redhat" }.Count(f => c.Progress.Tasks.Any(t => t.EndsWith(f, StringComparison.Ordinal)));

    private static Achievement PartDone(string part, string icon) =>
        new($"part-{part}", icon, AchievementCategory.Learning, c => c.Game.CompletedParts.Contains(part),
            c =>
            {
                var lessons = ChaptersLib.LessonsIn(part).Select(l => l.Id).ToList();
                return (lessons.Count(c.Game.CompletedChapters.Contains), lessons.Count);
            });

    private static readonly System.Text.RegularExpressions.Regex SandwichRe = new(@"^(sudo\s+)?make\s+me\s+a\s+sandwich\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    private static readonly System.Text.RegularExpressions.Regex HelloRe = new(@"hello,?\s*world", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

    private static bool RmRoot(CommandInfo cmd) => cmd.Commands.Any(words =>
    {
        var w = words.SkipWhile(x => x == "sudo" || x.StartsWith('-') && words[0] == "sudo").ToList();
        if (w.Count == 0 || w[0] != "rm") return false;
        bool recursive = w.Skip(1).Any(a => a == "--recursive" || (a.StartsWith('-') && !a.StartsWith("--") && (a.Contains('r') || a.Contains('R'))));
        return recursive && w.Skip(1).Any(a => a is "/" or "/*");
    });

    /// <summary>The number of exams in the course.</summary>
    private static int ExamCount => ChaptersLib.Chapters.Count(c => c.Kind == ChapterKinds.Exam);

    public static IReadOnlyList<Achievement> All { get; } = new List<Achievement>
    {
        // Learning
        Count("first-task", "👋", AchievementCategory.Learning, c => c.Progress.Tasks.Count, 1),
        Count("first-chapter", "📗", AchievementCategory.Learning, c => c.Game.CompletedChapters.Count, 1),
        Count("tasks-25", "🧩", AchievementCategory.Learning, c => c.Progress.Tasks.Count, 25),
        Count("tasks-100", "💯", AchievementCategory.Learning, c => c.Progress.Tasks.Count, 100),
        new("tasks-all", "🏁", AchievementCategory.Learning, c => c.Progress.TasksTotal > 0 && c.Progress.TasksDone >= c.Progress.TasksTotal,
            c => (c.Progress.TasksDone, c.Progress.TasksTotal)),
        PartDone("grunder", "🧱"),
        PartDone("system", "⚙️"),
        PartDone("distro", "📦"),
        PartDone("admin", "🔧"),
        PartDone("natverk", "🌐"),
        PartDone("skript", "🤖"),
        PartDone("verktyg", "🧰"),
        Count("all-families", "🐧", AchievementCategory.Learning, Families, 3),
        Count("checkpoints-50", "🤔", AchievementCategory.Learning, c => c.Progress.Checkpoints, 50),
        // Exams
        Count("exam-first", "🎓", AchievementCategory.Exams, c => c.Game.ExamsPassed.Count, 1),
        Count("exam-perfect", "⭐", AchievementCategory.Exams, c => c.Game.ExamsPerfect.Count, 1),
        new("exam-all", "🏆", AchievementCategory.Exams, c => c.Game.ExamsPassed.Count >= ExamCount, c => (c.Game.ExamsPassed.Count, ExamCount)),
        new("exam-comeback", "💪", AchievementCategory.Exams, c => c.Game.ExamsPassed.Any(c.Game.ExamsFailed.Contains)),
        // Terminal
        Count("sudo-first", "🔑", AchievementCategory.Terminal, c => c.Game.Stats.Sudo, 1),
        Count("pipe-first", "🔗", AchievementCategory.Terminal, c => c.Game.Stats.LongestPipe >= 2 ? 1 : 0, 1),
        new("pipe-long", "🚰", AchievementCategory.Terminal, c => c.Game.Stats.LongestPipe >= 4),
        Count("redirect-first", "📝", AchievementCategory.Terminal, c => c.Game.Stats.Redirects, 1),
        Count("loop-first", "🔁", AchievementCategory.Terminal, c => c.Game.Stats.Loops, 1),
        Count("script-first", "📜", AchievementCategory.Terminal, c => c.Game.Stats.Scripts, 1),
        Count("commands-25", "📚", AchievementCategory.Terminal, c => c.Game.Stats.CommandNames.Count, 25),
        Count("commands-500", "⚡", AchievementCategory.Terminal, c => c.Game.Stats.Commands, 500),
        // Habits
        Count("unaided-10", "🎯", AchievementCategory.Habits, c => c.Game.Unaided.Count, 10),
        Count("unaided-50", "🧭", AchievementCategory.Habits, c => c.Game.Unaided.Count, 50),
        Count("streak-3", "🌱", AchievementCategory.Habits, c => c.Game.BestStreak, 3),
        Count("streak-7", "🔥", AchievementCategory.Habits, c => c.Game.BestStreak, 7),
        Count("streak-30", "🌋", AchievementCategory.Habits, c => c.Game.BestStreak, 30),
        new("level-max", "👑", AchievementCategory.Habits, c => c.Level >= Levels.Max,
            c => (Math.Min(XpRules.Total(c.Game, c.Progress), Levels.Thresholds[^1]), Levels.Thresholds[^1])),
        // Hidden – found by exploring the terminal
        new("rm-rf-root", "💥", AchievementCategory.Hidden, c => Cmd(c, RmRoot)),
        new("cowsay", "🐄", AchievementCategory.Hidden, c => Cmd(c, cmd => cmd.ExitCode == 0 && cmd.Names.Contains("cowsay"))),
        new("rtfm", "📖", AchievementCategory.Hidden, c => c.Game.Stats.ManPages.Count > 0),
        new("commands-50", "🧠", AchievementCategory.Hidden, c => c.Game.Stats.CommandNames.Count >= 50),
        new("sandwich", "🥪", AchievementCategory.Hidden, c => Cmd(c, cmd => SandwichRe.IsMatch(cmd.Line))),
        new("vim-quit", "🚪", AchievementCategory.Hidden, c => Cmd(c, cmd => cmd.Line is ":q" or ":q!" or ":wq" or ":x" or ":qa" or ":qa!")),
        new("sl", "🚂", AchievementCategory.Hidden, c => Cmd(c, cmd => cmd.FirstWords.Contains("sl"))),
        new("hello-world", "🌍", AchievementCategory.Hidden, c => Cmd(c, cmd => cmd.ExitCode == 0 &&
            cmd.Commands.Any(w => w.Count > 1 && w[0] is "echo" or "printf" && HelloRe.IsMatch(string.Join(" ", w.Skip(1)))))),
        new("answer-42", "🌌", AchievementCategory.Hidden, c => Cmd(c, cmd => cmd.Output.Trim() == "42")),
        new("night-owl", "🦉", AchievementCategory.Hidden, c => c.SolvedNow.Count > 0 && c.Now.Hour < 4),
    };

    public static Achievement? Find(string id) => All.FirstOrDefault(a => a.Id == id);
}
