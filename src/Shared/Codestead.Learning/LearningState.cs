using System.Text.Json.Serialization;
using Codestead.Learning.Game;

namespace Codestead.Learning;

/// <summary>What a learning tool saves between runs (state.json in its data folder).</summary>
public sealed class LearningState
{
    public string? Lang { get; set; }
    /// <summary>null = follow the system, "light" or "dark".</summary>
    public string? Theme { get; set; }
    /// <summary>The variant the learner chose (Codestead Linux: the distribution). Saved as "distro" for older saves.</summary>
    [JsonPropertyName("distro")]
    public string? Variant { get; set; }
    public string? Chapter { get; set; }
    /// <summary>Completed tasks (key → true).</summary>
    public OrderedDictionary<string, bool> Progress { get; set; } = new(StringComparer.Ordinal);
    /// <summary>Solved checkpoints in the lesson texts ("chapter#index").</summary>
    public OrderedDictionary<string, bool> Checkpoints { get; set; } = new(StringComparer.Ordinal);
    /// <summary>Chapters without checkpoints that the learner has marked as read.</summary>
    public List<string> Read { get; set; } = new();
    /// <summary>Commands run while a task was unfinished, per task key (unlocks the solution).</summary>
    public OrderedDictionary<string, int> Attempts { get; set; } = new(StringComparer.Ordinal);
    /// <summary>Task keys whose hint has been opened (also unlocks the solution).</summary>
    public List<string> HintSeen { get; set; } = new();
    /// <summary>Best exam result in percent, per main chapter.</summary>
    public OrderedDictionary<string, int> Exams { get; set; } = new(StringComparer.Ordinal);
    /// <summary>XP, achievements, streak and counters (see GameRules).</summary>
    public GameState Game { get; set; } = new();
}
