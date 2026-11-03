using Codestead.Learning.Game;
using static Codestead.Learning.Game.CommonAchievements;

namespace Codestead.Learning.Tests;

/// <summary>
/// The learning engine on a made-up course with nothing of Linux in it: a tool such as a future Codestead C++
/// gets XP, levels, the streak and the common achievements just by describing its course.
/// </summary>
public class GameRulesTests
{
    private static readonly DateTime Noon = new(2026, 11, 3, 12, 0, 0);

    /// <summary>Two parts: "basics" (two lessons, an exam) and "pointers" (one lesson, no exam).</summary>
    private static readonly CourseOutline Course = new([
        new OutlinePart("basics", ["hello", "variables"], HasExam: true),
        new OutlinePart("pointers", ["addresses"], HasExam: false),
    ]);

    /// <summary>A tool's own command facts: counts compiler runs in the statistics.</summary>
    private sealed class CompileFacts : CommandFacts
    {
        public override void CountInto(GameStats stats) => stats.Scripts++;
    }

    private static GameRules Rules() => new(Course,
    [
        FirstTask, FirstChapter, TasksAll, PartDone("basics", "🧱"), PartDone("pointers", "📍"),
        ExamFirst, ExamPerfect, ExamAll, ExamComeback, Streak(3, "🌱"), LevelMax,
        new Achievement("first-compile", "⚙️", AchievementCategory.Terminal, c => c.Command is CompileFacts),
    ]);

    private static ProgressView P(IEnumerable<string>? tasks = null, IEnumerable<string>? complete = null, Dictionary<string, int>? exams = null, int total = 10)
    {
        var t = (tasks ?? []).ToList();
        return new ProgressView(t, 0, exams ?? new(), (complete ?? []).ToHashSet(), t.Count, total);
    }

    [Fact(DisplayName = "lektioner och delar räknas från kursens disposition")]
    public void LessonsAndParts()
    {
        var rules = Rules();
        var g = new GameState();
        var ev = rules.Sync(g, P(["hello/t1"], complete: ["hello", "variables"]), Noon);
        Assert.Equal(["hello", "variables"], ev.ChaptersCompleted);
        Assert.Equal(["basics"], ev.PartsCompleted);
        Assert.Contains("part-basics", ev.Achievements);
        Assert.DoesNotContain("part-pointers", ev.Achievements);
        Assert.Equal(XpRules.Task + XpRules.Unaided * 0 + 2 * XpRules.Chapter + XpRules.Part, ev.XpGained);
        Assert.False(rules.Sync(g, P(["hello/t1"], complete: ["hello", "variables"]), Noon).Changed);
    }

    [Fact(DisplayName = "proven: alla prov enligt dispositionen, comeback efter underkänt")]
    public void Exams()
    {
        var rules = Rules();
        var g = new GameState();
        rules.OnExam(g, P(exams: new() { ["basics"] = 40 }), "basics", 40, Noon);
        var passed = rules.OnExam(g, P(exams: new() { ["basics"] = 100 }), "basics", 100, Noon);
        Assert.Equal("basics", passed.ExamPassed);
        Assert.True(passed.ExamPerfect);
        // One exam in the whole course, so passing it is all of them.
        Assert.Contains("exam-all", passed.Achievements);
        Assert.Contains("exam-comeback", passed.Achievements);
    }

    [Fact(DisplayName = "verktygets egna kommandofakta räknas och kan ge utmärkelser")]
    public void ToolCommandFacts()
    {
        var rules = Rules();
        var g = new GameState();
        var facts = new CompileFacts { Line = "g++ main.cpp" };
        facts.Names.Add("g++");
        var ev = rules.OnCommand(g, P(["hello/t1"]), facts, "hello", [new SolvedTask("hello/t1", false)], Noon);
        Assert.Equal(1, g.Stats.Commands);
        Assert.Equal(["g++"], g.Stats.CommandNames);
        Assert.Equal(1, g.Stats.Scripts);
        Assert.Contains("first-compile", ev.Achievements);
        Assert.Contains("first-task", ev.Achievements);
        Assert.Equal(1, ev.StreakExtendedTo);
    }

    [Fact(DisplayName = "dagar i rad och hela kursens uppgifter")]
    public void StreakAndAllTasks()
    {
        var rules = Rules();
        var g = new GameState();
        for (int day = 0; day < 3; day++) rules.OnCheckpoint(g, P(), Noon.AddDays(day));
        Assert.Contains("streak-3", g.Achievements.Keys);
        Assert.Equal((3, false), GameRules.StreakAt(g, DateOnly.FromDateTime(Noon.AddDays(3))));
        rules.Sync(g, P(["a", "b"], total: 2), Noon);
        Assert.Contains("tasks-all", g.Achievements.Keys);
        Assert.NotNull(rules.Find("first-compile"));
    }
}
