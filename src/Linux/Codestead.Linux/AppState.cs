using Codestead.Content.Game;
using Codestead.Learning;
using Codestead.Learning.Game;
using Codestead.Shell;

namespace Codestead.Linux;

/// <summary>Settings saved between runs.</summary>
public sealed class AppState
{
    public string? Lang { get; set; }
    /// <summary>null = follow the system, "light" or "dark".</summary>
    public string? Theme { get; set; }
    public string Distro { get; set; } = "ubuntu";
    public string? Chapter { get; set; }
    public OrderedDictionary<string, bool> Progress { get; set; } = Js.Obj<bool>();
    /// <summary>Solved checkpoints in the lesson texts ("chapter#index").</summary>
    public OrderedDictionary<string, bool> Checkpoints { get; set; } = Js.Obj<bool>();
    /// <summary>Chapters without checkpoints that the student has marked as read.</summary>
    public List<string> Read { get; set; } = new();
    /// <summary>Commands run while a task was unfinished, per task key (unlocks the solution).</summary>
    public OrderedDictionary<string, int> Attempts { get; set; } = Js.Obj<int>();
    /// <summary>Task keys whose hint has been opened (also unlocks the solution).</summary>
    public List<string> HintSeen { get; set; } = new();
    /// <summary>Best exam result in percent, per main chapter.</summary>
    public OrderedDictionary<string, int> Exams { get; set; } = Js.Obj<int>();
    /// <summary>XP, achievements, streak and counters (see Codestead.Content.Game).</summary>
    public GameState Game { get; set; } = new();
}
