using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Styling;
using Avalonia.Threading;
using Codestead.Hub.Core;
using Codestead.UI;
using Codestead.UI.Controls;
using Codestead.UI.Controls.Game;
using Codestead.UI.App;
using static Codestead.UI.App.UiParts;

namespace Codestead.Hub;

// Each tool's level, streak and achievements (profile.json), and the total of all tools.
public sealed partial class MainWindow
{
    // ---------- Profiles (level, streak and achievements written by each tool) ----------

    private static ToolProfile? LoadProfile(string toolId) => ToolProfile.Load(new Storage(toolId));

    /// <summary>The profiles of the installed tools.</summary>
    private List<ToolProfile> ProfilesShown() =>
        store.All().Select(t => LoadProfile(t.Id)).OfType<ToolProfile>().ToList();

    private ProfileTexts ProfileTexts() => new(
        (xp, next) => next is int n ? T("profile.levelTooltip", ("xp", xp), ("left", n - xp)) : T("profile.levelTooltipMax", ("xp", xp)),
        (days, today, best) => T("profile.streakTooltip", ("days", days), ("best", Math.Max(best, days))) + (today ? "" : "\n" + T("profile.streakWaiting")),
        T("profile.hiddenTitle"),
        T("profile.hiddenDesc"),
        date => T("profile.unlockedOn", ("date", date)),
        (title, found, total) => T("profile.hiddenSection", ("title", title), ("found", found), ("total", total)));

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.Now);

    private ProfileModel ProfileModelFor(ToolProfile p)
    {
        var texts = ProfileTexts();
        return new ProfileModel(ProfileModels.Level(p, Lang, texts), ProfileModels.Streak(p, Today, texts), p.Unlocked, p.Achievements.Count,
            $"{p.Unlocked}/{p.Achievements.Count}", T("profile.achievements"));
    }

    /// <summary>All tools together: XP, achievements and the longest current streak.</summary>
    private Control TotalRow(List<ToolProfile> profiles)
    {
        int xp = profiles.Sum(p => p.Xp), unlocked = profiles.Sum(p => p.Unlocked), total = profiles.Sum(p => p.Achievements.Count);
        int streak = profiles.Max(p => p.StreakOn(Today).Days);
        var text = T("profile.total", ("xp", xp), ("unlocked", unlocked), ("total", total));
        if (streak > 0) text += " · " + T("profile.totalStreak", ("days", streak));
        var label = Text(text, 14, FontWeight.SemiBold);
        label.FontFamily = (FontFamily)Application.Current!.FindResource("CsUiFont")!;
        var box = new Border { CornerRadius = new CornerRadius(10), Padding = new Thickness(14, 10), Child = label };
        box.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsRewardSoft"));
        return box;
    }

    private void OpenAchievements(string name, ToolProfile p)
    {
        var texts = ProfileTexts();
        var (days, _) = p.StreakOn(Today);
        var gallery = new GalleryTexts(
            T("profile.galleryTitle", ("name", name)),
            T("profile.count", ("unlocked", p.Unlocked), ("total", p.Achievements.Count)),
            days > 0 ? T("profile.streakLine", ("days", days), ("best", Math.Max(p.BestStreak, days))) : T("profile.streakNone"),
            T("dialog.close"));
        overlay.ShowDialog(AchievementGalleryView.Build(gallery, ProfileModels.Level(p, Lang, texts), ProfileModels.Sections(p, Lang, texts), overlay.CloseDialog),
            overlay.CloseDialog, 800, scroll: false);
    }
}
