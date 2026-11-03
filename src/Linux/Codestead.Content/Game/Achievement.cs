namespace Codestead.Content.Game;

// One achievement: id, icon, category, check and counter.

/// <summary>
/// An achievement. Title and description are the UI strings ach.&lt;id&gt;.title and ach.&lt;id&gt;.desc. Hidden ones
/// are shown as "???" until found. <see cref="Counter"/> gives the progress ("62 / 100") of counting ones.
/// </summary>
public sealed record Achievement(string Id, string Icon, AchievementCategory Category, Func<AchievementContext, bool> Done,
    Func<AchievementContext, (int Current, int Target)>? Counter = null)
{
    public bool Hidden => Category == AchievementCategory.Hidden;
    public string TitleKey => $"ach.{Id}.title";
    public string DescKey => $"ach.{Id}.desc";
}
