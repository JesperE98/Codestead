using System.Globalization;

namespace Codestead.UI.Controls.Game;

/// <summary>
/// A tool's level, streak and achievements, saved as <c>profile.json</c> in the tool's data folder so that the
/// hub can show them. The format does not depend on the tool: every text is stored in every language, so the
/// hub needs nothing from the tool to show it. A tool rewrites the file when its progress changes.
/// </summary>
public sealed class ToolProfile
{
    public const int CurrentSchema = 1;
    public const string FileName = "profile";

    public int Schema { get; set; } = CurrentSchema;
    public int Xp { get; set; }
    public int Level { get; set; } = 1;
    public int MaxLevel { get; set; } = 1;
    /// <summary>The XP where the current level starts.</summary>
    public int LevelStart { get; set; }
    /// <summary>The XP where the next level starts, or null at the top level.</summary>
    public int? NextLevelAt { get; set; }
    /// <summary>The title of the current level: language → text.</summary>
    public Dictionary<string, string> LevelTitle { get; set; } = new();
    public int Streak { get; set; }
    public int BestStreak { get; set; }
    /// <summary>The last day with progress ("yyyy-MM-dd", local time).</summary>
    public string? LastActiveDay { get; set; }
    /// <summary>The groups of the gallery, in order.</summary>
    public List<ProfileCategory> Categories { get; set; } = new();
    public List<ProfileAchievement> Achievements { get; set; } = new();

    public int Unlocked => Achievements.Count(a => a.UnlockedAt is not null);

    /// <summary>The streak as it should be shown on <paramref name="today"/> (0 once a day was missed).</summary>
    public (int Days, bool Today) StreakOn(DateOnly today)
    {
        if (LastActiveDay is null || !DateOnly.TryParseExact(LastActiveDay, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var last))
            return (0, false);
        if (last >= today) return (Streak, true);
        return last == today.AddDays(-1) ? (Streak, false) : (0, false);
    }

    /// <summary>A text in a language, else English, else any.</summary>
    public static string Pick(IReadOnlyDictionary<string, string>? texts, string lang)
    {
        if (texts is null || texts.Count == 0) return "";
        if (texts.TryGetValue(lang, out var t) && t.Length > 0) return t;
        if (texts.TryGetValue("en", out t) && t.Length > 0) return t;
        return texts.Values.FirstOrDefault(v => v.Length > 0) ?? "";
    }

    /// <summary>Reads a tool's profile; null when there is none or it cannot be read.</summary>
    public static ToolProfile? Load(Storage storage)
    {
        var p = storage.Load<ToolProfile>(FileName);
        if (p is null || p.Schema < 1 || p.Schema > CurrentSchema) return null;
        p.LevelTitle ??= new();
        p.Categories ??= new();
        p.Achievements = (p.Achievements ?? new()).Where(a => a is not null && !string.IsNullOrEmpty(a.Id)).ToList();
        return p;
    }

    public void Save(Storage storage) => storage.Save(FileName, this);
}
