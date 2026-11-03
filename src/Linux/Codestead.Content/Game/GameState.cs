namespace Codestead.Content.Game;

// The gamification: XP and levels, achievements, a day streak and some lifetime counters.
// Everything is saved in the app's state (AppState.Game); see GameEngine for how it changes.

/// <summary>XP, achievements, streak and lifetime counters. Saved inside the app state.</summary>
public sealed class GameState
{
    public const int CurrentVersion = 1;

    /// <summary>0 = saved by a version without gamification: <see cref="GameEngine.Sync"/> brings it up to date quietly.</summary>
    public int Version { get; set; }

    /// <summary>The XP last computed (to show "+n XP"). XP itself is always derived, see <see cref="XpRules"/>.</summary>
    public int Xp { get; set; }

    /// <summary>Unlocked achievements: id → when (local time, "yyyy-MM-ddTHH:mm").</summary>
    public OrderedDictionary<string, string> Achievements { get; set; } = new(StringComparer.Ordinal);

    // Things that count once and stay counted (a chapter done, then undone by a distro switch, is not paid twice).
    public List<string> CompletedChapters { get; set; } = new();
    public List<string> CompletedParts { get; set; } = new();
    public List<string> ExamsPassed { get; set; } = new();
    public List<string> ExamsPerfect { get; set; } = new();
    public List<string> ExamsFailed { get; set; } = new();
    /// <summary>Tasks solved without a hint or the solution.</summary>
    public List<string> Unaided { get; set; } = new();
    /// <summary>Tasks whose solution was shown before they were solved.</summary>
    public List<string> SolutionSeen { get; set; } = new();

    // The streak: local calendar days ("yyyy-MM-dd") with at least one solved task or question.
    public string? LastActiveDay { get; set; }
    public int Streak { get; set; }
    public int BestStreak { get; set; }

    public GameStats Stats { get; set; } = new();
}

/// <summary>Counters over everything the learner has typed in the main terminal.</summary>
public sealed class GameStats
{
    public int Commands { get; set; }
    /// <summary>Different command names (only ones the simulator knows).</summary>
    public List<string> CommandNames { get; set; } = new();
    public List<string> ManPages { get; set; } = new();
    public int Pipes { get; set; }
    public int LongestPipe { get; set; }
    public int Redirects { get; set; }
    public int Loops { get; set; }
    public int Scripts { get; set; }
    public int Sudo { get; set; }
    /// <summary>Active seconds per chapter (time between commands, at most five minutes each).</summary>
    public OrderedDictionary<string, int> ChapterSeconds { get; set; } = new(StringComparer.Ordinal);
    /// <summary>When the previous command ran (ms since 1970) and in which chapter.</summary>
    public long LastCommandAt { get; set; }
    public string? LastCommandChapter { get; set; }
}

/// <summary>The learner's progress as the app sees it (built by the app; tests build it directly).</summary>
/// <param name="Tasks">Done task keys, every family.</param>
/// <param name="Checkpoints">Questions answered in the lessons.</param>
/// <param name="Exams">Best percentage per main chapter.</param>
/// <param name="CompleteLessons">Lessons that are complete (all tasks done and the chapter unlocked).</param>
/// <param name="TasksDone">Tasks done as the progress meter counts them.</param>
/// <param name="TasksTotal">All tasks as the progress meter counts them.</param>
public sealed record ProgressView(
    IReadOnlyCollection<string> Tasks,
    int Checkpoints,
    IReadOnlyDictionary<string, int> Exams,
    IReadOnlySet<string> CompleteLessons,
    int TasksDone,
    int TasksTotal);

/// <summary>A task solved by a command. <paramref name="Aided"/>: a hint or the solution had been shown.</summary>
public sealed record SolvedTask(string Key, bool Aided);

/// <summary>What changed – the app turns it into notices and celebrations.</summary>
public sealed class GameEvents
{
    public int XpBefore { get; set; }
    public int XpAfter { get; set; }
    public int XpGained => XpAfter - XpBefore;
    public int LevelBefore { get; set; }
    public int LevelAfter { get; set; }
    public bool LevelUp => LevelAfter > LevelBefore;
    /// <summary>New achievements, in catalogue order.</summary>
    public List<string> Achievements { get; } = new();
    public List<string> ChaptersCompleted { get; } = new();
    public List<string> PartsCompleted { get; } = new();
    /// <summary>The main chapter whose exam was just passed (first time).</summary>
    public string? ExamPassed { get; set; }
    /// <summary>The exam was just done with 100 % (first time).</summary>
    public bool ExamPerfect { get; set; }
    /// <summary>Set on the first solve of a new day: the streak is now this many days.</summary>
    public int? StreakExtendedTo { get; set; }
    /// <summary>Something changed that should be saved.</summary>
    public bool Changed { get; set; }

    public bool Celebrate => ChaptersCompleted.Count > 0 || PartsCompleted.Count > 0 || ExamPassed is not null;
}
