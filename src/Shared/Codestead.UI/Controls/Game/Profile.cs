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

public sealed class ProfileCategory
{
    public string Id { get; set; } = "";
    public Dictionary<string, string> Title { get; set; } = new();
    /// <summary>A group of hidden achievements (shown as "x of y found").</summary>
    public bool Hidden { get; set; }
}

public sealed class ProfileAchievement
{
    public string Id { get; set; } = "";
    public string Icon { get; set; } = "";
    public string Category { get; set; } = "";
    public bool Hidden { get; set; }
    /// <summary>When it was unlocked ("yyyy-MM-ddTHH:mm", local time), or null.</summary>
    public string? UnlockedAt { get; set; }
    public int Current { get; set; }
    public int Target { get; set; }
    /// <summary>Empty for a hidden achievement that has not been found.</summary>
    public Dictionary<string, string> Title { get; set; } = new();
    public Dictionary<string, string> Description { get; set; } = new();
}

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

/// <summary>Turns a <see cref="ToolProfile"/> into what the views show.</summary>
public static class ProfileModels
{
    public static LevelModel Level(ToolProfile p, string lang, ProfileTexts t) =>
        new(p.Level, ToolProfile.Pick(p.LevelTitle, lang), p.Xp, p.LevelStart, p.NextLevelAt, t.LevelTooltip(p.Xp, p.NextLevelAt));

    public static StreakModel Streak(ToolProfile p, DateOnly today, ProfileTexts t)
    {
        var (days, isToday) = p.StreakOn(today);
        return new StreakModel(days, isToday, t.StreakTooltip(days, isToday, p.BestStreak));
    }

    /// <summary>A date for people: "3 Nov 2026" in the language's way (Gregorian calendar everywhere).</summary>
    public static string FormatDate(string stamp, string lang)
    {
        if (!DateTime.TryParseExact(stamp, "yyyy-MM-ddTHH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)) return stamp;
        try
        {
            var culture = (CultureInfo)CultureInfo.GetCultureInfo(lang).Clone();
            if (culture.DateTimeFormat.Calendar is not GregorianCalendar)
            {
                var gregorian = culture.OptionalCalendars.OfType<GregorianCalendar>().FirstOrDefault();
                if (gregorian is null) return d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                culture.DateTimeFormat.Calendar = gregorian;
            }
            return d.ToString("d MMM yyyy", culture);
        }
        catch (CultureNotFoundException)
        {
            return d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }
    }

    public static AchievementCard Card(ProfileAchievement a, string lang, ProfileTexts t)
    {
        bool unlocked = a.UnlockedAt is not null;
        bool secret = a.Hidden && !unlocked;
        return new AchievementCard(
            a.Icon,
            secret ? t.HiddenTitle : ToolProfile.Pick(a.Title, lang),
            secret ? t.HiddenDescription : ToolProfile.Pick(a.Description, lang),
            unlocked, a.Hidden,
            a.Current, secret ? 0 : a.Target,
            unlocked ? t.UnlockedOn(FormatDate(a.UnlockedAt!, lang)) : null,
            !unlocked && a.Target > 0 ? $"{a.Current} / {a.Target}" : null);
    }

    public static List<AchievementSection> Sections(ToolProfile p, string lang, ProfileTexts t)
    {
        var sections = new List<AchievementSection>();
        foreach (var cat in p.Categories)
        {
            var items = p.Achievements.Where(a => a.Category == cat.Id).ToList();
            if (items.Count == 0) continue;
            // Unlocked first in a hidden group, so the found ones are not lost among the "???".
            if (cat.Hidden) items = items.OrderBy(a => a.UnlockedAt is null).ToList();
            var title = ToolProfile.Pick(cat.Title, lang);
            if (cat.Hidden) title = t.HiddenSection(title, items.Count(a => a.UnlockedAt is not null), items.Count);
            sections.Add(new AchievementSection(title, items.Select(a => Card(a, lang, t)).ToList()));
        }
        return sections;
    }
}
