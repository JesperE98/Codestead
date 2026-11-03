namespace Codestead.UI.Controls.Game;

// A group of achievements in the gallery.

/// <summary>A group of achievements in the gallery.</summary>
public sealed record AchievementSection(string Title, IReadOnlyList<AchievementCard> Cards);
