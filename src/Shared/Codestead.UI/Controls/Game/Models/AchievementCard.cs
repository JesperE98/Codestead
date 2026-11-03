namespace Codestead.UI.Controls.Game;

// One achievement as a tile or a notice.

/// <summary>One achievement as a tile or a notice.</summary>
/// <param name="Hidden">A hidden achievement; while it is locked, its real title and description are not given.</param>
/// <param name="Target">For achievements with a counter (e.g. 25 tasks); 0 when there is none.</param>
/// <param name="UnlockedText">E.g. "Unlocked 3 Nov 2026"; null while locked.</param>
public sealed record AchievementCard(string Icon, string Title, string Description, bool Unlocked, bool Hidden, int Current, int Target, string? UnlockedText, string? ProgressText);
