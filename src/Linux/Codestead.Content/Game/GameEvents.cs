namespace Codestead.Content.Game;

// What changed in the game state, for notices and celebrations.

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
