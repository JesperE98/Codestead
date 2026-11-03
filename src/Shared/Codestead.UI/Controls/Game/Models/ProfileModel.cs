namespace Codestead.UI.Controls.Game;

// A tool's progress as a summary (the hub's tool cards).

/// <summary>A tool's progress as a summary (the hub's tool cards).</summary>
public sealed record ProfileModel(LevelModel Level, StreakModel Streak, int Unlocked, int Total, string AchievementsText, string OpenText);
