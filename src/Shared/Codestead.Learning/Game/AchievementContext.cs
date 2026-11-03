namespace Codestead.Learning.Game;

// What an achievement's check can look at.

/// <summary>Everything an achievement can look at when it is checked.</summary>
/// <param name="Course">The course (parts, lessons, exams).</param>
/// <param name="Command">The command just run, if the check comes from a command (the tool's own subclass).</param>
/// <param name="SolvedNow">Tasks solved by that command.</param>
/// <param name="Now">Local time.</param>
public sealed record AchievementContext(CourseOutline Course, GameState Game, ProgressView Progress, CommandFacts? Command, IReadOnlyList<string> SolvedNow, DateTime Now)
{
    public int Level => Levels.LevelOf(XpRules.Total(Game, Progress));
}
