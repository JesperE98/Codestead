using Codestead.Content.Game;
using Codestead.Learning;
using Codestead.Learning.Game;
using Codestead.Shell;
using Codestead.Shell.Commands;

namespace Codestead.Content.Tests;

public class GameTests
{
    private static readonly DateTime Noon = new(2026, 11, 3, 12, 0, 0);

    private static ProgressView P(
        IEnumerable<string>? tasks = null, int checkpoints = 0, Dictionary<string, int>? exams = null,
        IEnumerable<string>? complete = null, int? done = null, int total = 1000)
    {
        var t = (tasks ?? Array.Empty<string>()).ToList();
        return new ProgressView(t, checkpoints, exams ?? new(), (complete ?? Array.Empty<string>()).ToHashSet(), done ?? t.Count, total);
    }

    private static IEnumerable<string> Keys(int n, string suffix = "") => Enumerable.Range(0, n).Select(i => $"ch/t{i}{suffix}");

    private static GameEvents Run(GameState g, string line, string output = "", int exit = 0, ProgressView? p = null, DateTime? now = null,
        IReadOnlyList<SolvedTask>? solved = null) =>
        LinuxGame.Rules.OnCommand(g, p ?? P(), CommandInfo.Analyze(line, output, exit), "ch", solved ?? Array.Empty<SolvedTask>(), now ?? Noon);

    // ---------- XP and levels ----------

    [Fact]
    public void Xp_is_derived_from_progress()
    {
        var g = new GameState();
        g.Unaided.Add("ch/t0");
        g.CompletedChapters.Add("a");
        g.CompletedParts.Add("b");
        g.ExamsPassed.Add("c");
        g.ExamsPerfect.Add("c");
        var p = P(Keys(3), checkpoints: 4);
        Assert.Equal(3 * 10 + 5 + 4 * 2 + 25 + 50 + 100 + 50, XpRules.Total(g, p));
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(59, 1)]
    [InlineData(60, 2)]
    [InlineData(399, 3)]
    [InlineData(3699, 9)]
    [InlineData(3700, 10)]
    [InlineData(99999, 10)]
    public void Levels_follow_the_thresholds(int xp, int level)
    {
        Assert.Equal(level, Levels.LevelOf(xp));
        var (l, start, next) = Levels.Progress(xp);
        Assert.Equal(level, l);
        Assert.True(start <= xp);
        if (next is int n) Assert.True(xp < n);
        else Assert.Equal(Levels.Max, level);
    }

    [Fact]
    public void The_whole_course_reaches_the_top_level_without_bonuses()
    {
        // One distribution family, every hint used, no perfect exams: the least XP a finished course gives.
        var lessons = ChaptersLib.Chapters.Where(c => c.Kind == ChapterKinds.Lesson).ToList();
        int tasks = lessons.Sum(c => c.Tasks.Count);
        int checkpoints = lessons.Sum(c => Codestead.UI.Learning.Checkpoint.ParseAll(I18nLib.ChapterMarkdown(c, "en")).Count);
        int parts = ChaptersLib.Parts.Count(p => ChaptersLib.LessonsIn(p.Id).Count > 0);
        int exams = ChaptersLib.Chapters.Count(c => c.Kind == ChapterKinds.Exam);
        int min = XpRules.Task * tasks + XpRules.Checkpoint * checkpoints + XpRules.Chapter * lessons.Count + XpRules.Part * parts + XpRules.ExamPass * exams;
        Assert.True(min >= Levels.Thresholds[^1], $"The course gives at least {min} XP, the top level needs {Levels.Thresholds[^1]}");
    }

    // ---------- streak ----------

    [Fact]
    public void Streak_counts_days_in_a_row()
    {
        var g = new GameState();
        var day = new DateTime(2026, 11, 1, 20, 0, 0);
        Assert.Equal(1, LinuxGame.Rules.OnCheckpoint(g, P(), day).StreakExtendedTo);
        Assert.Null(LinuxGame.Rules.OnCheckpoint(g, P(), day.AddHours(1)).StreakExtendedTo); // same day
        Assert.Equal(2, LinuxGame.Rules.OnCheckpoint(g, P(), day.AddDays(1)).StreakExtendedTo);
        Assert.Equal(3, LinuxGame.Rules.OnCheckpoint(g, P(), day.AddDays(2)).StreakExtendedTo);
        Assert.Null(LinuxGame.Rules.OnCheckpoint(g, P(), day.AddDays(1)).StreakExtendedTo); // clock went back
        Assert.Equal(3, g.Streak);
        Assert.Equal(1, LinuxGame.Rules.OnCheckpoint(g, P(), day.AddDays(5)).StreakExtendedTo); // a gap
        Assert.Equal(1, g.Streak);
        Assert.Equal(3, g.BestStreak);
    }

    [Fact]
    public void Streak_is_shown_until_a_day_is_missed()
    {
        var g = new GameState { LastActiveDay = "2026-11-02", Streak = 4 };
        Assert.Equal((4, true), GameRules.StreakAt(g, new DateOnly(2026, 11, 2)));
        Assert.Equal((4, false), GameRules.StreakAt(g, new DateOnly(2026, 11, 3)));
        Assert.Equal((0, false), GameRules.StreakAt(g, new DateOnly(2026, 11, 4)));
        Assert.Equal((0, false), GameRules.StreakAt(new GameState(), new DateOnly(2026, 11, 4)));
    }

    [Fact]
    public void Only_a_solved_task_counts_for_the_streak()
    {
        var g = new GameState();
        Assert.Null(Run(g, "ls").StreakExtendedTo);
        Assert.Equal(1, Run(g, "ls", p: P(Keys(1)), solved: new[] { new SolvedTask("ch/t0", false) }).StreakExtendedTo);
    }

    // ---------- sync and events ----------

    [Fact]
    public void Sync_gives_an_old_save_what_it_earned_and_is_idempotent()
    {
        var part = ChaptersLib.LessonsIn("grunder");
        var p = P(Keys(30), checkpoints: 10, exams: new() { ["grunder"] = 100 }, complete: part.Select(c => c.Id));
        var g = new GameState();
        var first = LinuxGame.Rules.Sync(g, p, Noon);
        Assert.True(first.Changed);
        Assert.Equal(GameState.CurrentVersion, g.Version);
        Assert.Contains("tasks-25", g.Achievements.Keys);
        Assert.Contains("part-grunder", g.Achievements.Keys);
        Assert.Contains("exam-perfect", g.Achievements.Keys);
        Assert.Equal(XpRules.Total(g, p), g.Xp);
        Assert.Empty(g.Unaided); // never backfilled

        var again = LinuxGame.Rules.Sync(g, p, Noon.AddDays(1));
        Assert.False(again.Changed);
        Assert.Equal(0, again.XpGained);
        Assert.Empty(again.Achievements);
    }

    [Fact]
    public void Completing_a_chapter_and_a_part_is_reported_once()
    {
        var lessons = ChaptersLib.LessonsIn("start");
        var g = new GameState();
        LinuxGame.Rules.Sync(g, P(), Noon);
        var ev = Run(g, "ls", p: P(Keys(1), complete: lessons.Select(c => c.Id)), solved: new[] { new SolvedTask("ch/t0", false) });
        Assert.True(ev.Celebrate);
        Assert.Equal(lessons.Select(c => c.Id), ev.ChaptersCompleted);
        Assert.Equal(new[] { "start" }, ev.PartsCompleted);
        Assert.Contains("first-task", ev.Achievements);
        Assert.Equal(10 + 5 + 25 * lessons.Count + 50, ev.XpGained);

        // Lost again (e.g. another distro) and back: nothing new.
        Run(g, "ls", p: P(Keys(1)));
        var back = Run(g, "ls", p: P(Keys(1), complete: lessons.Select(c => c.Id)));
        Assert.False(back.Celebrate);
        Assert.Equal(0, back.XpGained);
    }

    [Fact]
    public void A_task_solved_after_the_solution_was_shown_is_not_unaided()
    {
        var g = new GameState();
        GameRules.OnSolutionShown(g, "ch/t0");
        Run(g, "ls", p: P(Keys(2)), solved: new[] { new SolvedTask("ch/t0", false), new SolvedTask("ch/t1", false) });
        Assert.Equal(new[] { "ch/t1" }, g.Unaided);
        Run(g, "ls", p: P(Keys(3)), solved: new[] { new SolvedTask("ch/t2", true) });
        Assert.Equal(new[] { "ch/t1" }, g.Unaided);
    }

    [Fact]
    public void Exams_report_pass_and_perfect_the_first_time()
    {
        var g = new GameState();
        var failed = LinuxGame.Rules.OnExam(g, P(exams: new() { ["grunder"] = 60 }), "grunder", 60, Noon);
        Assert.Null(failed.ExamPassed);
        Assert.Contains("grunder", g.ExamsFailed);
        var passed = LinuxGame.Rules.OnExam(g, P(exams: new() { ["grunder"] = 90 }), "grunder", 90, Noon);
        Assert.Equal("grunder", passed.ExamPassed);
        Assert.False(passed.ExamPerfect);
        Assert.Contains("exam-comeback", passed.Achievements);
        Assert.True(passed.Celebrate);
        var perfect = LinuxGame.Rules.OnExam(g, P(exams: new() { ["grunder"] = 100 }), "grunder", 100, Noon);
        Assert.Null(perfect.ExamPassed);
        Assert.True(perfect.ExamPerfect);
        Assert.Equal(50, perfect.XpGained);
    }

    [Fact]
    public void Active_time_per_chapter_has_a_cap_between_commands()
    {
        var g = new GameState();
        LinuxGame.Rules.OnCommand(g, P(), CommandInfo.Analyze("ls", "", 0), "a", Array.Empty<SolvedTask>(), Noon);
        LinuxGame.Rules.OnCommand(g, P(), CommandInfo.Analyze("ls", "", 0), "a", Array.Empty<SolvedTask>(), Noon.AddSeconds(40));
        LinuxGame.Rules.OnCommand(g, P(), CommandInfo.Analyze("ls", "", 0), "a", Array.Empty<SolvedTask>(), Noon.AddHours(2));
        LinuxGame.Rules.OnCommand(g, P(), CommandInfo.Analyze("ls", "", 0), "b", Array.Empty<SolvedTask>(), Noon.AddHours(2).AddSeconds(30));
        Assert.Equal(40 + GameRules.MaxPauseSeconds, g.Stats.ChapterSeconds["a"]);
        Assert.False(g.Stats.ChapterSeconds.ContainsKey("b"));
        Assert.Equal(4, g.Stats.Commands);
    }

    [Fact]
    public void Chapter_commands_come_from_the_solutions()
    {
        var ch = ChaptersLib.Chapters.First(c => c.Kind == ChapterKinds.Lesson && c.Tasks.Count > 0);
        var sh = Shell.Shell.Create(ChaptersLib.DefaultDistro, "en");
        var names = LinuxGame.ChapterCommands(ch, sh.Distro, sh.World);
        Assert.NotEmpty(names);
        Assert.All(names, n => Assert.True(IndexCmd.Commands.ContainsKey(n), n));
        Assert.Equal(names.Distinct(), names);
    }

    // ---------- achievements ----------

    [Fact]
    public void Achievements_have_unique_ids_and_a_fresh_state_has_none()
    {
        Assert.Equal(AchievementsLib.All.Count, AchievementsLib.All.Select(a => a.Id).Distinct().Count());
        Assert.InRange(AchievementsLib.All.Count(a => a.Hidden), 8, 12);
        Assert.InRange(AchievementsLib.All.Count(a => !a.Hidden), 28, 36);
        var g = new GameState();
        LinuxGame.Rules.Sync(g, P(), Noon);
        Assert.Empty(g.Achievements);
        Run(g, "ls");
        Run(g, "echo hi");
        Assert.Empty(g.Achievements);
    }

    /// <summary>For every achievement: something that unlocks it.</summary>
    private static readonly Dictionary<string, Action<GameState>> Witnesses = new()
    {
        ["first-task"] = g => LinuxGame.Rules.Sync(g, P(Keys(1)), Noon),
        ["first-chapter"] = g => LinuxGame.Rules.Sync(g, P(complete: new[] { ChaptersLib.LessonsIn("grunder")[0].Id }), Noon),
        ["tasks-25"] = g => LinuxGame.Rules.Sync(g, P(Keys(25)), Noon),
        ["tasks-100"] = g => LinuxGame.Rules.Sync(g, P(Keys(100)), Noon),
        ["tasks-all"] = g => LinuxGame.Rules.Sync(g, P(Keys(5), done: 5, total: 5), Noon),
        ["part-grunder"] = g => Part(g, "grunder"),
        ["part-system"] = g => Part(g, "system"),
        ["part-distro"] = g => Part(g, "distro"),
        ["part-admin"] = g => Part(g, "admin"),
        ["part-natverk"] = g => Part(g, "natverk"),
        ["part-skript"] = g => Part(g, "skript"),
        ["part-verktyg"] = g => Part(g, "verktyg"),
        ["all-families"] = g => LinuxGame.Rules.Sync(g, P(new[] { "a/x@debian", "b/x@arch", "c/x@redhat" }), Noon),
        ["checkpoints-50"] = g => LinuxGame.Rules.Sync(g, P(checkpoints: 50), Noon),
        ["exam-first"] = g => LinuxGame.Rules.OnExam(g, P(exams: new() { ["grunder"] = 80 }), "grunder", 80, Noon),
        ["exam-perfect"] = g => LinuxGame.Rules.OnExam(g, P(exams: new() { ["grunder"] = 100 }), "grunder", 100, Noon),
        ["exam-all"] = g => LinuxGame.Rules.Sync(g, P(exams: ChaptersLib.Chapters.Where(c => c.Kind == ChapterKinds.Exam).ToDictionary(c => c.Part, _ => 85)), Noon),
        ["exam-comeback"] = g =>
        {
            LinuxGame.Rules.OnExam(g, P(exams: new() { ["system"] = 10 }), "system", 10, Noon);
            LinuxGame.Rules.OnExam(g, P(exams: new() { ["system"] = 80 }), "system", 80, Noon);
        },
        ["sudo-first"] = g => Run(g, "sudo apt update"),
        ["pipe-first"] = g => Run(g, "ls | wc -l"),
        ["pipe-long"] = g => Run(g, "cat f | sort | uniq -c | sort -n"),
        ["redirect-first"] = g => Run(g, "echo hi > notes.txt"),
        ["loop-first"] = g => Run(g, "for i in 1 2 3; do echo $i; done"),
        ["script-first"] = g => Run(g, "./backup.sh"),
        ["commands-25"] = g =>
        {
            foreach (var name in IndexCmd.Commands.Keys.Take(25)) Run(g, name);
        },
        ["commands-500"] = g =>
        {
            for (int i = 0; i < 500; i++) Run(g, "pwd");
        },
        ["unaided-10"] = g => Run(g, "ls", p: P(Keys(10)), solved: Keys(10).Select(k => new SolvedTask(k, false)).ToList()),
        ["unaided-50"] = g => Run(g, "ls", p: P(Keys(50)), solved: Keys(50).Select(k => new SolvedTask(k, false)).ToList()),
        ["streak-3"] = g => Days(g, 3),
        ["streak-7"] = g => Days(g, 7),
        ["streak-30"] = g => Days(g, 30),
        ["level-max"] = g => LinuxGame.Rules.Sync(g, P(Keys(370)), Noon),
        ["rm-rf-root"] = g => Run(g, "sudo rm -rf /", exit: 1),
        ["cowsay"] = g => Run(g, "cowsay moo"),
        ["rtfm"] = g => Run(g, "man ls"),
        ["commands-50"] = g =>
        {
            foreach (var name in IndexCmd.Commands.Keys.Take(50)) Run(g, name);
        },
        ["sandwich"] = g => Run(g, "sudo make me a sandwich", exit: 127),
        ["vim-quit"] = g => Run(g, ":q", exit: 127),
        ["sl"] = g => Run(g, "sl", exit: 127),
        ["hello-world"] = g => Run(g, "echo 'Hello, World!'", "Hello, World!\n"),
        ["answer-42"] = g => Run(g, "echo $((6*7))", "42\n"),
        ["night-owl"] = g => Run(g, "ls", p: P(Keys(1)), now: new DateTime(2026, 11, 3, 2, 30, 0), solved: new[] { new SolvedTask("ch/t0", true) }),
    };

    private static void Part(GameState g, string part) =>
        LinuxGame.Rules.Sync(g, P(complete: ChaptersLib.LessonsIn(part).Select(c => c.Id)), Noon);

    private static void Days(GameState g, int n)
    {
        for (int i = 0; i < n; i++) LinuxGame.Rules.OnCheckpoint(g, P(), Noon.AddDays(i));
    }

    public static TheoryData<string> AchievementIds() => new(AchievementsLib.All.Select(a => a.Id));

    [Theory]
    [MemberData(nameof(AchievementIds))]
    public void Every_achievement_can_be_unlocked(string id)
    {
        Assert.True(Witnesses.TryGetValue(id, out var witness), $"No witness for {id}");
        var g = new GameState();
        witness(g);
        Assert.True(g.Achievements.ContainsKey(id), $"{id} was not unlocked; got: {string.Join(", ", g.Achievements.Keys)}");
        var a = AchievementsLib.Find(id)!;
        if (a.Counter is not null)
        {
            var (current, target) = a.Counter(new AchievementContext(LinuxGame.Outline, new GameState(), P(), null, Array.Empty<string>(), Noon));
            Assert.True(current < target || target == 0, $"{id} counter on a fresh state: {current}/{target}");
        }
    }

    [Theory]
    [InlineData("rm -rf /tmp/x")]
    [InlineData("rm /")]
    [InlineData("echo rm -rf /")]
    public void Rm_root_needs_the_real_thing(string line)
    {
        var g = new GameState();
        Run(g, line);
        Assert.False(g.Achievements.ContainsKey("rm-rf-root"));
    }

    // ---------- command analysis ----------

    [Fact]
    public void Command_analysis_finds_names_through_wrappers()
    {
        var c = CommandInfo.Analyze("sudo -u root env A=1 nohup ls -l | xargs -n1 wc -l > out.txt", "", 0);
        Assert.Equal(new[] { "sudo", "env", "nohup", "ls", "xargs", "wc" }, c.Names);
        Assert.True(c.UsesSudo);
        Assert.True(c.HasRedirect);
        Assert.Equal(2, c.MaxPipeline);
        Assert.False(c.HasLoop);
    }

    [Fact]
    public void Command_analysis_sees_loops_scripts_man_and_assignments()
    {
        Assert.True(CommandInfo.Analyze("while true; do date; done", "", 0).HasLoop);
        Assert.True(CommandInfo.Analyze("bash deploy.sh", "", 0).IsScriptRun);
        Assert.Equal("grep", CommandInfo.Analyze("man 1 grep", "", 0).ManPage);
        var a = CommandInfo.Analyze("LANG=C sort file", "", 0);
        Assert.Equal(new[] { "sort" }, a.Names);
        Assert.Equal("x", CommandInfo.Analyze("echo x", "\u001b[1mx\u001b[0m", 0).Output);
    }

    [Fact]
    public void Command_analysis_survives_lines_that_do_not_parse()
    {
        var c = CommandInfo.Analyze("echo 'unterminated", "", 2);
        Assert.Equal("echo", Assert.Single(c.FirstWords));
        var empty = CommandInfo.Analyze("   ", "", 0);
        Assert.Empty(empty.Names);
    }
}
