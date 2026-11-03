namespace Codestead.Learning.Game;

/// <summary>Ten levels, from Guest to root. The titles are the UI strings level.1 … level.10.</summary>
public static class Levels
{
    /// <summary>The XP where each level starts.</summary>
    public static readonly int[] Thresholds = { 0, 60, 200, 400, 700, 1100, 1600, 2200, 2900, 3700 };

    public static int Max => Thresholds.Length;

    public static int LevelOf(int xp)
    {
        int level = 1;
        for (int i = 1; i < Thresholds.Length; i++)
            if (xp >= Thresholds[i]) level = i + 1;
        return level;
    }

    /// <summary>The level, where it starts and where the next one starts (null at the top).</summary>
    public static (int Level, int Start, int? Next) Progress(int xp)
    {
        int level = LevelOf(xp);
        return (level, Thresholds[level - 1], level < Max ? Thresholds[level] : null);
    }

    public static string TitleKey(int level) => $"level.{level}";
}
