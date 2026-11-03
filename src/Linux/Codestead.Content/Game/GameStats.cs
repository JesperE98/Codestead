namespace Codestead.Content.Game;

// Lifetime counters over what the learner has typed.

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
