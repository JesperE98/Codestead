namespace Codestead.Content.Game;

// A task solved by a command.

/// <summary>A task solved by a command. <paramref name="Aided"/>: a hint or the solution had been shown.</summary>
public sealed record SolvedTask(string Key, bool Aided);
