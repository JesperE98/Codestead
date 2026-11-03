using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Documents;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Styling;
using Avalonia.Threading;
using Codestead.Common;
using Codestead.Learning.Game;
using Codestead.UI;
using Codestead.UI.App;
using Codestead.UI.Controls;
using Codestead.UI.Controls.Game;
using static Codestead.UI.App.UiParts;

namespace Codestead.Learning.UI;

// The rules are in Codestead.Content.Game; this file only shows what they report.
public partial class LearningWindow
{
    private readonly GameBar gameBar = new();
    private readonly NoticeLayer notices = new();
    private readonly Button sidebarAchievements = new();
    /// <summary>The save had progress from before the gamification: say once that it was counted.</summary>
    private bool gameWelcomeBack;

    /// <summary>The progress as the game rules see it.</summary>
    private ProgressView Snapshot()
    {
        int done = 0, total = 0;
        foreach (var ch in Chapters)
        {
            var p = ChapterProgress(ch);
            done += p.Done;
            total += p.Total;
        }
        return new ProgressView(
            state.Progress.Where(kv => kv.Value).Select(kv => kv.Key).ToList(),
            state.Checkpoints.Count(kv => kv.Value),
            state.Exams,
            Lessons.Where(IsLessonComplete).Select(c => c.Id).ToHashSet(),
            done, total);
    }

    /// <summary>At start: brings the game up to date with the saved progress, quietly.</summary>
    private void InitGame()
    {
        gameWelcomeBack = state.Game.Version == 0 && existingUser;
        var ev = tool.Rules.Sync(state.Game, Snapshot(), DateTime.Now);
        gameWelcomeBack &= state.Game.Xp > 0;
        if (ev.Changed) SaveState();
        WriteProfile();

        gameBar.Clicked += OpenAchievements;
        sidebarAchievements.Classes.Add("nav-item");
        sidebarAchievements.Click += (_, _) => OpenAchievements();
        notices.MoreText = n => T("game.more", ("n", n));
        notices.MoreClicked = OpenAchievements;
        SizeChanged += (_, e) => gameBar.Compact = e.NewSize.Width < 1240;
    }

    /// <summary>After the window opened: the welcome-back notice for a save from an older version.</summary>
    private void GameOpened()
    {
        if (!gameWelcomeBack) return;
        gameWelcomeBack = false;
        // After "What's new", so that it is not hidden behind it.
        overlay.ShowWhenFree(() =>
            notices.Show(AchievementToast.Simple(T("game.welcomeBack", ("xp", state.Game.Xp), ("count", state.Game.Achievements.Count)), OpenAchievements), 10));
    }

    private void ResetGame()
    {
        state.Game = new GameState();
        tool.Rules.Sync(state.Game, Snapshot(), DateTime.Now);
        WriteProfile();
    }

    // ---------- Texts ----------

    private string LevelTitle(int level) => T(Levels.TitleKey(level));

    private string LevelTooltip(int xp, int? next) => next is int n
        ? T("game.levelTooltip", ("xp", xp), ("left", n - xp), ("next", Levels.LevelOf(n)))
        : T("game.levelTooltipMax", ("xp", xp));

    private string StreakTooltip(int days, bool today, int best)
    {
        var text = T("game.streakTooltip", ("days", days), ("best", Math.Max(best, days)));
        return today ? text : text + "\n" + T("game.streakWaiting");
    }

    private ProfileTexts ProfileTexts() => new(
        LevelTooltip,
        StreakTooltip,
        T("game.hiddenTitle"),
        T("game.hiddenDesc"),
        date => T("game.unlockedOn", ("date", date)),
        (title, found, total) => T("game.hiddenSection", ("title", title), ("found", found), ("total", total)));

    private LevelModel LevelModelFor(int xp)
    {
        var (level, start, next) = Levels.Progress(xp);
        return new LevelModel(level, LevelTitle(level), xp, start, next, LevelTooltip(xp, next));
    }

    // ---------- Profile ----------

    private static readonly AchievementCategory[] CategoryOrder =
        { AchievementCategory.Learning, AchievementCategory.Exams, AchievementCategory.Terminal, AchievementCategory.Habits, AchievementCategory.Hidden };

    /// <summary>The profile in some languages (all of them for the hub's file, the current one for the gallery).</summary>
    private ToolProfile BuildProfile(IReadOnlyList<string> langs)
    {
        var g = state.Game;
        var progress = Snapshot();
        var ctx = new AchievementContext(tool.Rules.Course, g, progress, null, Array.Empty<string>(), DateTime.Now);
        Dictionary<string, string> All(string key, params (string Name, object Value)[] args) =>
            langs.ToDictionary(l => l, l => tool.Translate(l, key, args.Length == 0 ? null : args.ToDictionary(a => a.Name, a => a.Value)));
        var (level, start, next) = Levels.Progress(g.Xp);
        var profile = new ToolProfile
        {
            Xp = g.Xp,
            Level = level,
            MaxLevel = Levels.Max,
            LevelStart = start,
            NextLevelAt = next,
            LevelTitle = All(Levels.TitleKey(level)),
            Streak = g.Streak,
            BestStreak = g.BestStreak,
            LastActiveDay = g.LastActiveDay,
            Categories = CategoryOrder.Select(c => new ProfileCategory
            {
                Id = c.ToString().ToLowerInvariant(),
                Title = All($"ach.cat.{c.ToString().ToLowerInvariant()}"),
                Hidden = c == AchievementCategory.Hidden,
            }).ToList(),
        };
        foreach (var a in tool.Rules.Achievements)
        {
            bool unlocked = g.Achievements.TryGetValue(a.Id, out var at);
            var (current, target) = (0, 0);
            if (a.Counter is not null)
            {
                try
                {
                    (current, target) = a.Counter(ctx);
                }
                catch
                {
                    // A counter that fails shows no progress.
                }
            }
            bool secret = a.Hidden && !unlocked;
            profile.Achievements.Add(new ProfileAchievement
            {
                Id = a.Id,
                Icon = secret ? "" : a.Icon,
                Category = a.Category.ToString().ToLowerInvariant(),
                Hidden = a.Hidden,
                UnlockedAt = unlocked ? at : null,
                Current = unlocked ? target : current,
                Target = target,
                // Hidden achievements that have not been found keep their secret, also in the file.
                Title = secret ? new() : All(a.TitleKey),
                Description = secret ? new() : All(a.DescKey),
            });
        }
        return profile;
    }

    /// <summary>Writes profile.json for the hub.</summary>
    private void WriteProfile()
    {
        if (smokeTest) return;
        BuildProfile(Languages.Offered.Select(l => l.Code).ToList()).Save(storage);
    }

    // ---------- Views ----------

    private void UpdateGameViews()
    {
        var g = state.Game;
        var (days, today) = GameRules.StreakAt(g, DateOnly.FromDateTime(DateTime.Now));
        gameBar.Update(LevelModelFor(g.Xp), new StreakModel(days, today, StreakTooltip(days, today, g.BestStreak)));
        sidebarAchievements.Content = Icons.Label(Icons.Trophy(), T("game.achievementsShort", ("unlocked", g.Achievements.Count), ("total", tool.Rules.Achievements.Count)));
    }

    private void OpenAchievements()
    {
        var profile = BuildProfile(new[] { Lang });
        var texts = ProfileTexts();
        var g = state.Game;
        var (days, _) = GameRules.StreakAt(g, DateOnly.FromDateTime(DateTime.Now));
        var gallery = new GalleryTexts(
            T("game.achievements"),
            T("game.achievementsCount", ("unlocked", profile.Unlocked), ("total", profile.Achievements.Count)),
            days > 0 ? T("game.streakLine", ("days", days), ("best", Math.Max(g.BestStreak, days))) : T("game.streakNone"),
            T("dialog.close"));
        overlay.ShowDialog(
            AchievementGalleryView.Build(gallery, ProfileModels.Level(profile, Lang, texts), ProfileModels.Sections(profile, Lang, texts), overlay.CloseDialog),
            overlay.CloseDialog, 800, scroll: false);
    }

    private AchievementCard CardFor(string id)
    {
        var a = tool.Rules.Find(id)!;
        return new AchievementCard(a.Icon, T(a.TitleKey), T(a.DescKey), true, a.Hidden, 0, 0, null, null);
    }

    /// <summary>Shows what changed: the top bar, "+XP", notices, and the celebration when something big was done.</summary>
    private void Present(GameEvents ev)
    {
        if (ev.Changed) SaveState();
        bool notable = ev.XpGained != 0 || ev.Achievements.Count > 0 || ev.StreakExtendedTo is not null || ev.Celebrate;
        if (notable) WriteProfile();
        UpdateGameViews();
        if (smokeTest) return;
        if (ev.XpGained > 0) gameBar.ShowGain(T("game.xpGain", ("xp", ev.XpGained)));

        if (ev.Celebrate)
        {
            var model = Celebration(ev, out var next);
            overlay.ShowWhenFree(() =>
            {
                void Close() => overlay.CloseDialog();
                Action? onNext = next is null ? null : () =>
                {
                    overlay.CloseDialog();
                    Navigate(next);
                };
                overlay.ShowDialog(CelebrationView.Build(model, Close, onNext), Close, model.Big ? 560 : 540, scroll: false);
            });
        }
        else
        {
            foreach (var id in ev.Achievements)
            {
                var a = tool.Rules.Find(id)!;
                notices.Show(AchievementToast.Build(T(a.Hidden ? "game.secretFound" : "game.newAchievement"), a.Icon, T(a.TitleKey), T(a.DescKey)), 6, OpenAchievements);
            }
            if (ev.LevelUp) notices.Show(LevelToast(ev.LevelAfter, ev.XpAfter), 6, OpenAchievements);
        }
        if (ev.StreakExtendedTo is int days && days >= 2)
            notices.Show(AchievementToast.Simple(T("game.streakToast", ("days", days))), 4);
    }

    private Control LevelToast(int level, int xp)
    {
        var (_, _, next) = Levels.Progress(xp);
        var desc = next is int n ? T("game.levelUpDesc", ("xp", xp), ("left", n - xp)) : T("game.levelUpDescMax");
        return AchievementToast.Build(T("game.levelUp"), level.ToString(System.Globalization.CultureInfo.InvariantCulture),
            T("game.levelUpTitle", ("level", level), ("title", LevelTitle(level))), desc, level: true);
    }

    /// <summary>"About 14 minutes" from active seconds, or null when too short to mention.</summary>
    private string? TimeText(int seconds)
    {
        if (seconds < 90) return null; // never "about 1 minutes"
        int minutes = (int)Math.Round(seconds / 60.0);
        return minutes >= 120 ? T("celebrate.hours", ("hours", (int)Math.Round(minutes / 60.0))) : T("celebrate.minutes", ("minutes", minutes));
    }

    /// <summary>The celebration for the biggest thing that was just done. <paramref name="next"/>: where "Next" goes.</summary>
    private CelebrationModel Celebration(GameEvents ev, out string? next)
    {
        var chapters = Chapters;
        string icon, title;
        string? subtitle, nextText;
        bool big;
        IReadOnlyList<string> commands = Array.Empty<string>();
        int seconds = 0;
        CourseChapter? after;
        if (ev.ExamPassed is { } examPart)
        {
            big = true;
            icon = "🎓";
            int percent = state.Exams.GetValueOrDefault(examPart);
            title = T("celebrate.exam.title", ("percent", percent));
            subtitle = T("celebrate.exam.subtitle", ("part", T($"part.{examPart}")));
            after = chapters.SkipWhile(c => !(c.Part == examPart && c.Kind == ChapterKinds.Exam)).Skip(1).FirstOrDefault();
            nextText = after is null ? null : T("celebrate.nextPart", ("title", T($"part.{after.Part}")));
        }
        else if (ev.PartsCompleted.Count > 0)
        {
            var part = ev.PartsCompleted[^1];
            var lessons = LessonsIn(part);
            big = true;
            icon = tool.Rules.Find($"part-{part}")?.Icon ?? "🏅";
            title = T("celebrate.part.title", ("part", T($"part.{part}")));
            var exam = chapters.FirstOrDefault(c => c.Part == part && c.Kind == ChapterKinds.Exam);
            subtitle = T(exam is null ? "celebrate.part.subtitleNoExam" : "celebrate.part.subtitle", ("count", lessons.Count));
            commands = lessons.SelectMany(l => tool.ChapterCommands(l.Id)).Distinct().Take(16).ToList();
            seconds = lessons.Sum(l => state.Game.Stats.ChapterSeconds.GetValueOrDefault(l.Id));
            after = exam ?? chapters.SkipWhile(c => c.Id != lessons[^1].Id).Skip(1).FirstOrDefault();
            nextText = after is null ? null : exam is not null ? T("celebrate.toExam") : T("celebrate.next", ("title", tool.ChapterTitle(after.Id, Lang)));
        }
        else
        {
            // The chapter on screen if it was one of them, else the last one.
            var id = ev.ChaptersCompleted.Contains(Chapter.Id) ? Chapter.Id : ev.ChaptersCompleted[^1];
            var chapter = chapters.First(c => c.Id == id);
            big = false;
            icon = "✓";
            title = T("celebrate.chapter.title");
            subtitle = tool.ChapterTitle(chapter.Id, Lang);
            commands = tool.ChapterCommands(chapter.Id).Take(12).ToList();
            seconds = state.Game.Stats.ChapterSeconds.GetValueOrDefault(chapter.Id);
            after = chapters.SkipWhile(c => c.Id != chapter.Id).Skip(1).FirstOrDefault();
            nextText = after is null ? null : T("celebrate.next", ("title", tool.ChapterTitle(after.Id, Lang)));
        }
        next = after?.Id;
        return new CelebrationModel(
            icon, title, subtitle, big,
            commands.Count > 0 ? T(big ? "celebrate.commandsPart" : "celebrate.commands") : null, commands,
            TimeText(seconds),
            T("game.xpGain", ("xp", ev.XpGained)),
            LevelModelFor(ev.XpBefore), LevelModelFor(ev.XpAfter),
            ev.LevelUp ? T("game.levelUpTitle", ("level", ev.LevelAfter), ("title", LevelTitle(ev.LevelAfter))) : null,
            ev.Achievements.Count > 0 ? T("celebrate.achievements") : null,
            ev.Achievements.Select(CardFor).ToList(),
            T("celebrate.close"), nextText);
    }
}
