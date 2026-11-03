namespace Codestead.UI.Controls.Game;

// What the gamification views show. The tools build these from their own game state (XP, achievements,
// streak) with every text already translated, so the views work the same in every tool and in the hub.

/// <summary>What the celebration dialog shows when a chapter, a part or an exam is done.</summary>
/// <param name="Big">A whole part or an exam: the bigger, gold variant.</param>
/// <param name="Commands">The commands practised in the chapter (shown as chips).</param>
/// <param name="TimeText">E.g. "About 12 minutes", or null.</param>
/// <param name="LevelBefore">The level before, to animate the bar from; equal to <paramref name="Level"/> when nothing changed.</param>
/// <param name="LevelUpText">E.g. "Level 4: Pipe fitter", or null.</param>
/// <param name="NextText">The label of the button to the next chapter, or null when there is none.</param>
public sealed record CelebrationModel(
    string Icon, string Title, string? Subtitle, bool Big,
    string? CommandsHeading, IReadOnlyList<string> Commands,
    string? TimeText, string XpText, LevelModel LevelBefore, LevelModel Level, string? LevelUpText,
    string? AchievementsHeading, IReadOnlyList<AchievementCard> Achievements,
    string CloseText, string? NextText);
