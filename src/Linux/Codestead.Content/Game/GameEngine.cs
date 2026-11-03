using System.Globalization;
using Codestead.Shell;

namespace Codestead.Content.Game;

/// <summary>
/// Updates the <see cref="GameState"/> after something happened (a command, a question, an exam) and says
/// what changed. Pure functions of the state and a <see cref="ProgressView"/> – the app shows the result.
/// </summary>
public static class GameEngine
{
    /// <summary>An exam is passed at this percentage.</summary>
    public const int ExamPassPercent = 80;

    /// <summary>The longest pause between two commands that still counts as time spent in a chapter.</summary>
    public const int MaxPauseSeconds = 300;

    private static string Day(DateOnly d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static string Stamp(DateTime t) => t.ToString("yyyy-MM-ddTHH:mm", CultureInfo.InvariantCulture);

    /// <summary>
    /// Brings the state up to date with the progress, e.g. when the app starts. An old save (from before the
    /// gamification) gets the XP and achievements its progress already earned. Nothing here is celebrated.
    /// </summary>
    public static GameEvents Sync(GameState g, ProgressView p, DateTime now)
    {
        var ev = Evaluate(g, p, null, Array.Empty<string>(), now);
        if (g.Version != GameState.CurrentVersion)
        {
            g.Version = GameState.CurrentVersion;
            ev.Changed = true;
        }
        return ev;
    }

    /// <summary>After a command in the main terminal. <paramref name="solved"/>: the tasks it solved.</summary>
    public static GameEvents OnCommand(GameState g, ProgressView p, CommandInfo? cmd, string chapterId, IReadOnlyList<SolvedTask> solved, DateTime now)
    {
        if (cmd is not null) Count(g.Stats, cmd, chapterId, now);
        foreach (var task in solved)
            if (!task.Aided && !g.SolutionSeen.Contains(task.Key) && !g.Unaided.Contains(task.Key)) g.Unaided.Add(task.Key);
        int? streak = solved.Count > 0 ? Touch(g, DateOnly.FromDateTime(now)) : null;
        var ev = Evaluate(g, p, cmd, solved.Select(s => s.Key).ToList(), now);
        ev.StreakExtendedTo = streak;
        ev.Changed |= cmd is not null || solved.Count > 0;
        return ev;
    }

    /// <summary>After a question in a lesson was answered correctly (it counts for the streak too).</summary>
    public static GameEvents OnCheckpoint(GameState g, ProgressView p, DateTime now)
    {
        int? streak = Touch(g, DateOnly.FromDateTime(now));
        var ev = Evaluate(g, p, null, Array.Empty<string>(), now);
        ev.StreakExtendedTo = streak;
        ev.Changed = true;
        return ev;
    }

    /// <summary>After an exam was handed in. <paramref name="p"/> already holds the new best result.</summary>
    public static GameEvents OnExam(GameState g, ProgressView p, string part, int percent, DateTime now)
    {
        if (percent < ExamPassPercent && !g.ExamsFailed.Contains(part)) g.ExamsFailed.Add(part);
        bool passedBefore = g.ExamsPassed.Contains(part), perfectBefore = g.ExamsPerfect.Contains(part);
        var ev = Evaluate(g, p, null, Array.Empty<string>(), now);
        if (!passedBefore && g.ExamsPassed.Contains(part)) ev.ExamPassed = part;
        ev.ExamPerfect = !perfectBefore && g.ExamsPerfect.Contains(part);
        ev.Changed = true;
        return ev;
    }

    /// <summary>The solution of a task was shown: solving it no longer counts as "without help".</summary>
    public static void OnSolutionShown(GameState g, string taskKey)
    {
        if (!g.SolutionSeen.Contains(taskKey)) g.SolutionSeen.Add(taskKey);
    }

    /// <summary>
    /// The streak as it should be shown today: it stays while yesterday was active (today not yet), and is
    /// 0 after a gap. <c>Today</c>: today already counts.
    /// </summary>
    public static (int Shown, bool Today) StreakAt(GameState g, DateOnly today)
    {
        if (g.LastActiveDay is null || !DateOnly.TryParseExact(g.LastActiveDay, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var last))
            return (0, false);
        if (last >= today) return (g.Streak, true);
        if (last == today.AddDays(-1)) return (g.Streak, false);
        return (0, false);
    }

    /// <summary>The commands practised in a chapter: the ones in its tasks' solutions, in order.</summary>
    public static IReadOnlyList<string> ChapterCommands(Chapter ch, Distro d, World w)
    {
        var names = new List<string>();
        foreach (var task in ch.Tasks)
        {
            List<string> lines;
            try
            {
                lines = task.SolutionFor(d, w);
            }
            catch
            {
                continue;
            }
            foreach (var line in lines)
                foreach (var name in CommandInfo.Analyze(line, "", 0).Names)
                    if (!names.Contains(name)) names.Add(name);
        }
        return names;
    }

    /// <summary>Counts a solve or a question for today. Returns the streak when this was the first of a new day.</summary>
    private static int? Touch(GameState g, DateOnly today)
    {
        DateOnly? last = g.LastActiveDay is not null && DateOnly.TryParseExact(g.LastActiveDay, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var l) ? l : null;
        if (last is DateOnly d && d >= today) return null; // the same day, or the clock went back
        g.Streak = last is DateOnly y && y == today.AddDays(-1) ? g.Streak + 1 : 1;
        g.LastActiveDay = Day(today);
        g.BestStreak = Math.Max(g.BestStreak, g.Streak);
        return g.Streak;
    }

    private static void Count(GameStats s, CommandInfo cmd, string chapterId, DateTime now)
    {
        if (cmd.Line.Length == 0) return;
        s.Commands++;
        foreach (var name in cmd.Names)
            if (!s.CommandNames.Contains(name)) s.CommandNames.Add(name);
        if (cmd.ManPage is { } page && !s.ManPages.Contains(page)) s.ManPages.Add(page);
        if (cmd.MaxPipeline > 1) s.Pipes++;
        s.LongestPipe = Math.Max(s.LongestPipe, cmd.MaxPipeline);
        if (cmd.HasRedirect) s.Redirects++;
        if (cmd.HasLoop) s.Loops++;
        if (cmd.IsScriptRun) s.Scripts++;
        if (cmd.UsesSudo) s.Sudo++;

        long ms = new DateTimeOffset(now).ToUnixTimeMilliseconds();
        if (s.LastCommandChapter == chapterId && s.LastCommandAt > 0 && ms > s.LastCommandAt)
        {
            int seconds = (int)Math.Min((ms - s.LastCommandAt) / 1000, MaxPauseSeconds);
            s.ChapterSeconds[chapterId] = s.ChapterSeconds.GetValueOrDefault(chapterId) + seconds;
        }
        s.LastCommandAt = ms;
        s.LastCommandChapter = chapterId;
    }

    private static void AddNew(List<string> into, IEnumerable<string> items, List<string>? added = null)
    {
        foreach (var item in items)
            if (!into.Contains(item))
            {
                into.Add(item);
                added?.Add(item);
            }
    }

    /// <summary>Updates the sticky sets from the progress, recomputes XP and unlocks achievements.</summary>
    private static GameEvents Evaluate(GameState g, ProgressView p, CommandInfo? cmd, IReadOnlyList<string> solvedNow, DateTime now)
    {
        var ev = new GameEvents { XpBefore = g.Xp, LevelBefore = Levels.LevelOf(g.Xp) };
        AddNew(g.CompletedChapters, ChaptersLib.Chapters.Where(c => p.CompleteLessons.Contains(c.Id)).Select(c => c.Id), ev.ChaptersCompleted);
        AddNew(g.CompletedParts, ChaptersLib.Parts
            .Select(part => (part.Id, Lessons: ChaptersLib.LessonsIn(part.Id)))
            .Where(x => x.Lessons.Count > 0 && x.Lessons.All(l => g.CompletedChapters.Contains(l.Id)))
            .Select(x => x.Id), ev.PartsCompleted);
        AddNew(g.ExamsPassed, p.Exams.Where(e => e.Value >= ExamPassPercent).Select(e => e.Key));
        AddNew(g.ExamsPerfect, p.Exams.Where(e => e.Value >= 100).Select(e => e.Key));

        // Achievements can depend on the level, and the level on nothing but XP, so one pass is enough.
        var ctx = new AchievementContext(g, p, cmd, solvedNow, now);
        foreach (var a in AchievementsLib.All)
        {
            if (g.Achievements.ContainsKey(a.Id)) continue;
            bool done;
            try
            {
                done = a.Done(ctx);
            }
            catch
            {
                done = false;
            }
            if (!done) continue;
            g.Achievements[a.Id] = Stamp(now);
            ev.Achievements.Add(a.Id);
        }

        g.Xp = XpRules.Total(g, p);
        ev.XpAfter = g.Xp;
        ev.LevelAfter = Levels.LevelOf(g.Xp);
        ev.Changed = ev.XpGained != 0 || ev.Achievements.Count > 0 || ev.ChaptersCompleted.Count > 0 || ev.PartsCompleted.Count > 0;
        return ev;
    }
}
