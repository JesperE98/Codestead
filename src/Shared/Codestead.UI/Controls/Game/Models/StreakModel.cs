namespace Codestead.UI.Controls.Game;

// The day streak as the gamification views show it.

/// <summary>Days in a row. <paramref name="Today"/>: today already counts (the flame is lit).</summary>
public sealed record StreakModel(int Days, bool Today, string Tooltip);
