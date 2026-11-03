namespace Codestead.Content.Game;

// What an achievement's check can look at.

/// <summary>Everything an achievement can look at when it is checked.</summary>
/// <param name="Command">The command just run, if the check comes from a command.</param>
/// <param name="SolvedNow">Tasks solved by that command.</param>
/// <param name="Now">Local time.</param>
public sealed record AchievementContext(GameState Game, ProgressView Progress, CommandInfo? Command, IReadOnlyList<string> SolvedNow, DateTime Now)
{
    public int Level => Levels.LevelOf(XpRules.Total(Game, Progress));
}
