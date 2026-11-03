using Codestead.Learning.Game;
using static Codestead.Learning.Game.CommonAchievements;

namespace Codestead.Content.Game;

public static class AchievementsLib
{
    private static bool Cmd(AchievementContext c, Func<CommandInfo, bool> test) => c.Command is CommandInfo cmd && test(cmd);

    private static int Families(AchievementContext c) =>
        new[] { "@debian", "@arch", "@redhat" }.Count(f => c.Progress.Tasks.Any(t => t.EndsWith(f, StringComparison.Ordinal)));

    private static readonly System.Text.RegularExpressions.Regex SandwichRe = new(@"^(sudo\s+)?make\s+me\s+a\s+sandwich\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    private static readonly System.Text.RegularExpressions.Regex HelloRe = new(@"hello,?\s*world", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

    private static bool RmRoot(CommandInfo cmd) => cmd.Commands.Any(words =>
    {
        var w = words.SkipWhile(x => x == "sudo" || x.StartsWith('-') && words[0] == "sudo").ToList();
        if (w.Count == 0 || w[0] != "rm") return false;
        bool recursive = w.Skip(1).Any(a => a == "--recursive" || (a.StartsWith('-') && !a.StartsWith("--") && (a.Contains('r') || a.Contains('R'))));
        return recursive && w.Skip(1).Any(a => a is "/" or "/*");
    });

    public static IReadOnlyList<Achievement> All { get; } = new List<Achievement>
    {
        // Learning
        FirstTask,
        FirstChapter,
        Tasks(25, "🧩"),
        Tasks(100, "💯"),
        TasksAll,
        PartDone("grunder", "🧱"),
        PartDone("system", "⚙️"),
        PartDone("distro", "📦"),
        PartDone("admin", "🔧"),
        PartDone("natverk", "🌐"),
        PartDone("skript", "🤖"),
        PartDone("verktyg", "🧰"),
        Count("all-families", "🐧", AchievementCategory.Learning, Families, 3),
        Checkpoints(50, "🤔"),
        // Exams
        ExamFirst,
        ExamPerfect,
        ExamAll,
        ExamComeback,
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
        Unaided(10, "🎯"),
        Unaided(50, "🧭"),
        Streak(3, "🌱"),
        Streak(7, "🔥"),
        Streak(30, "🌋"),
        LevelMax,
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
