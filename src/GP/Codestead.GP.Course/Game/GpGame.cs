using Codestead.Learning.Game;

namespace Codestead.GP.Course.Game;

/// <summary>The learning engine set up for the Codestead GP course.</summary>
public static class GpGame
{
    public static GameRules Rules { get; } = new(GpCourse.Outline, GpAchievements.All);
}
