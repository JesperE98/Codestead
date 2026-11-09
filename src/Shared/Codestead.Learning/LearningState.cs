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

    /// <summary>
    /// Moves saved task progress to new keys after tasks moved to another chapter (old key → new key). A key counted
    /// per variant group ("chapter/task@family") follows its task. Returns whether anything changed.
    /// </summary>
    public bool MoveTasks(IReadOnlyDictionary<string, string> moved)
    {
        bool changed = false;
        foreach (var (from, to) in moved)
        {
            changed |= Rename(Progress, from, to);
            changed |= Rename(Attempts, from, to);
            changed |= Rename(HintSeen, from, to);
            changed |= Rename(Game.Unaided, from, to);
            changed |= Rename(Game.SolutionSeen, from, to);
        }
        return changed;
    }

    private static string? NewKey(string key, string from, string to) =>
        key == from ? to : key.StartsWith(from + "@", StringComparison.Ordinal) ? to + key[from.Length..] : null;

    private static bool Rename<T>(OrderedDictionary<string, T> dict, string from, string to)
    {
        bool changed = false;
        foreach (var key in dict.Keys.ToList())
        {
            if (NewKey(key, from, to) is not { } target) continue;
            var value = dict[key];
            dict.Remove(key);
            dict.TryAdd(target, value);
            changed = true;
        }
        return changed;
    }

    private static bool Rename(List<string> list, string from, string to)
    {
        bool changed = false;
        for (int i = list.Count - 1; i >= 0; i--)
        {
            if (NewKey(list[i], from, to) is not { } target) continue;
            list.RemoveAt(i);
            if (!list.Contains(target)) list.Add(target);
            changed = true;
        }
        return changed;
    }
}
