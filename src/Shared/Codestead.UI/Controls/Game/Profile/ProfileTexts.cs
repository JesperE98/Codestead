namespace Codestead.UI.Controls.Game;

// The texts the views need around a profile.

/// <summary>The texts the views need around a profile, in the viewer's language.</summary>
/// <param name="LevelTooltip">(xp, next level's XP or null) → e.g. "520 XP · 180 to level 5".</param>
/// <param name="StreakTooltip">(days, today counts, best) → e.g. "5 days in a row (best: 9)".</param>
/// <param name="HiddenTitle">The title of an unfound hidden achievement ("???").</param>
/// <param name="HiddenDescription">Its description ("Found by exploring the terminal.").</param>
/// <param name="UnlockedOn">A date (already formatted) → "Unlocked 3 Nov 2026".</param>
/// <param name="HiddenSection">(section title, found, total) → "Hidden · 2 of 10 found".</param>
public sealed record ProfileTexts(
    Func<int, int?, string> LevelTooltip,
    Func<int, bool, int, string> StreakTooltip,
    string HiddenTitle,
    string HiddenDescription,
    Func<string, string> UnlockedOn,
    Func<string, int, int, string> HiddenSection);
