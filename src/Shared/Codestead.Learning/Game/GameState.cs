namespace Codestead.Learning.Game;

// The gamification: XP and levels, achievements, a day streak and some lifetime counters.
// Everything is saved in the app's state (AppState.Game); see GameRules for how it changes.

/// <summary>XP, achievements, streak and lifetime counters. Saved inside the app state.</summary>
public sealed class GameState
{
    public const int CurrentVersion = 1;

    /// <summary>0 = saved by a version without gamification: <see cref="GameRules.Sync"/> brings it up to date quietly.</summary>
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
