namespace Codestead.UI.Controls.Game;

// The learner's level as the gamification views show it.

/// <summary>The learner's level: number, title and how far it is to the next one.</summary>
/// <param name="NextAt">The XP where the next level starts, or null at the top level.</param>
public sealed record LevelModel(int Level, string Title, int Xp, int LevelStart, int? NextAt, string Tooltip)
{
    /// <summary>How far into the current level (0–1).</summary>
    public double Fraction => NextAt is int next && next > LevelStart ? Math.Clamp((Xp - LevelStart) / (double)(next - LevelStart), 0, 1) : 1;
}
