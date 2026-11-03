namespace Codestead.UI.Controls.Game;

// What the gamification views show. The tools build these from their own game state (XP, achievements,
// streak) with every text already translated, so the views work the same in every tool and in the hub.

/// <summary>The learner's level: number, title and how far it is to the next one.</summary>
/// <param name="NextAt">The XP where the next level starts, or null at the top level.</param>
public sealed record LevelModel(int Level, string Title, int Xp, int LevelStart, int? NextAt, string Tooltip)
{
    /// <summary>How far into the current level (0–1).</summary>
    public double Fraction => NextAt is int next && next > LevelStart ? Math.Clamp((Xp - LevelStart) / (double)(next - LevelStart), 0, 1) : 1;
}

/// <summary>Days in a row. <paramref name="Today"/>: today already counts (the flame is lit).</summary>
public sealed record StreakModel(int Days, bool Today, string Tooltip);

/// <summary>One achievement as a tile or a notice.</summary>
/// <param name="Hidden">A hidden achievement; while it is locked, its real title and description are not given.</param>
/// <param name="Target">For achievements with a counter (e.g. 25 tasks); 0 when there is none.</param>
/// <param name="UnlockedText">E.g. "Unlocked 3 Nov 2026"; null while locked.</param>
public sealed record AchievementCard(string Icon, string Title, string Description, bool Unlocked, bool Hidden, int Current, int Target, string? UnlockedText, string? ProgressText);

/// <summary>A group of achievements in the gallery.</summary>
public sealed record AchievementSection(string Title, IReadOnlyList<AchievementCard> Cards);

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

/// <summary>A tool's progress as a summary (the hub's tool cards).</summary>
public sealed record ProfileModel(LevelModel Level, StreakModel Streak, int Unlocked, int Total, string AchievementsText, string OpenText);

/// <summary>Texts of the achievement gallery.</summary>
public sealed record GalleryTexts(string Title, string CountText, string StreakText, string Close);
