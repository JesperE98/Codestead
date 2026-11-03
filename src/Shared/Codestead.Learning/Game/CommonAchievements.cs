namespace Codestead.Learning.Game;

/// <summary>
/// Achievements every course can have – learning, exams and habits. A tool puts them in its own list (in the order
/// its gallery should show) next to achievements of its own.
/// </summary>
public static class CommonAchievements
{
    /// <summary>An achievement with a counter: done when <paramref name="current"/> reaches <paramref name="target"/>.</summary>
    public static Achievement Count(string id, string icon, AchievementCategory cat, Func<AchievementContext, int> current, int target) =>
        new(id, icon, cat, c => current(c) >= target, c => (Math.Min(current(c), target), target));

    public static Achievement FirstTask => Count("first-task", "👋", AchievementCategory.Learning, c => c.Progress.Tasks.Count, 1);
    public static Achievement FirstChapter => Count("first-chapter", "📗", AchievementCategory.Learning, c => c.Game.CompletedChapters.Count, 1);
    public static Achievement Tasks(int n, string icon) => Count($"tasks-{n}", icon, AchievementCategory.Learning, c => c.Progress.Tasks.Count, n);

    public static Achievement TasksAll => new("tasks-all", "🏁", AchievementCategory.Learning,
        c => c.Progress.TasksTotal > 0 && c.Progress.TasksDone >= c.Progress.TasksTotal, c => (c.Progress.TasksDone, c.Progress.TasksTotal));

    /// <summary>Every lesson of a part done.</summary>
    public static Achievement PartDone(string part, string icon) =>
        new($"part-{part}", icon, AchievementCategory.Learning, c => c.Game.CompletedParts.Contains(part),
            c =>
            {
                var lessons = c.Course.LessonsIn(part);
                return (lessons.Count(c.Game.CompletedChapters.Contains), lessons.Count);
            });

    public static Achievement Checkpoints(int n, string icon) => Count($"checkpoints-{n}", icon, AchievementCategory.Learning, c => c.Progress.Checkpoints, n);

    public static Achievement ExamFirst => Count("exam-first", "🎓", AchievementCategory.Exams, c => c.Game.ExamsPassed.Count, 1);
    public static Achievement ExamPerfect => Count("exam-perfect", "⭐", AchievementCategory.Exams, c => c.Game.ExamsPerfect.Count, 1);

    public static Achievement ExamAll => new("exam-all", "🏆", AchievementCategory.Exams,
        c => c.Game.ExamsPassed.Count >= c.Course.ExamCount, c => (c.Game.ExamsPassed.Count, c.Course.ExamCount));

    public static Achievement ExamComeback => new("exam-comeback", "💪", AchievementCategory.Exams, c => c.Game.ExamsPassed.Any(c.Game.ExamsFailed.Contains));

    public static Achievement Unaided(int n, string icon) => Count($"unaided-{n}", icon, AchievementCategory.Habits, c => c.Game.Unaided.Count, n);
    public static Achievement Streak(int days, string icon) => Count($"streak-{days}", icon, AchievementCategory.Habits, c => c.Game.BestStreak, days);

    public static Achievement LevelMax => new("level-max", "👑", AchievementCategory.Habits, c => c.Level >= Levels.Max,
        c => (Math.Min(XpRules.Total(c.Game, c.Progress), Levels.Thresholds[^1]), Levels.Thresholds[^1]));
}
