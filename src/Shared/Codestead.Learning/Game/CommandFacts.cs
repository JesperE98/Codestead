namespace Codestead.Learning.Game;

/// <summary>
/// What a command line the learner ran contained, for the statistics and achievements. The engine counts commands
/// and command names; a tool subclasses this to count what matters for it (Codestead Linux: pipes, sudo, loops …).
/// </summary>
public class CommandFacts
{
    public string Line { get; init; } = "";
    /// <summary>The output without colours.</summary>
    public string Output { get; init; } = "";
    public int ExitCode { get; init; }
    /// <summary>The names of commands the tool knows, in order.</summary>
    public List<string> Names { get; } = new();
    /// <summary>The first word of each command, known or not.</summary>
    public List<string> FirstWords { get; } = new();

    /// <summary>Adds the tool's own counters to the statistics (called once per command line).</summary>
    public virtual void CountInto(GameStats stats)
    {
    }
}
