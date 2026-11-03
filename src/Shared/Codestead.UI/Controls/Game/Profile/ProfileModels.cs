using System.Globalization;

namespace Codestead.UI.Controls.Game;

// Turns a saved profile into what the gamification views show.

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
