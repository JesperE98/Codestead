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

// The --smoke-test of the installation tests.
public partial class LearningWindow
{
    private Task RunSmokeTest() => SmokeTest.RunAsync(this, tool.Product, async () =>
    {
        // Every chapter renders in every language without throwing.
        foreach (var l in Languages.Offered)
        {
            state.Lang = l.Code;
            foreach (var ch in Chapters)
            {
                state.Chapter = ch.Id;
                tool.ChapterShown(ch.Id);
                RenderAll();
            }
        }
        // Switching language and variant in the pickers, as a click does, must not crash
        // (it once closed the app: the pickers were rebuilt inside their own SelectionChanged).
        var offered = Languages.Offered;
        foreach (var lc in new[] { offered[1].Code, offered[^1].Code, offered[0].Code })
        {
            langPicker.SelectedItem = langPicker.Items.OfType<ComboBoxItem>().First(i => Equals(i.Tag, lc));
            Dispatcher.UIThread.RunJobs();
            if (Lang != lc) throw new InvalidOperationException($"The language picker did not switch to {lc}.");
        }
        if (Chapters.FirstOrDefault(c => tool.Variants(c.Id).Sum(g => g.Options.Count) > 1) is { } withVariants)
        {
            state.Chapter = withVariants.Id;
            tool.ChapterShown(Chapter.Id);
            FillPickers();
            foreach (var id in variantPicker.Items.OfType<ComboBoxItem>().Select(i => i.Tag).OfType<string>().ToList())
            {
                variantPicker.SelectedItem = variantPicker.Items.OfType<ComboBoxItem>().First(i => Equals(i.Tag, id));
                Dispatcher.UIThread.RunJobs();
                if (tool.CurrentVariant(Chapter.Id) != id) throw new InvalidOperationException($"The variant picker did not switch to {id}.");
            }
        }
        // Solve the first task of the first chapter that has tasks, in the real workbench (Codestead GP's first
        // chapters are reading chapters).
        state.Lang = Languages.Default;
        state.Chapter = Chapters.First(c => tool.Tasks(c.Id, Languages.Default).Count > 0).Id;
        tool.ChapterShown(Chapter.Id);
        ApplyLanguage();
        var task = tool.Tasks(Chapter.Id, Lang)[0];
        var before = state.Progress.ContainsKey(task.Key);
        if (!IsUnlocked(Chapter))
        {
            // The terminal is there from the start, but the tasks stay locked until the text is done.
            if (!workbenchFrame.IsVisible) throw new InvalidOperationException("The terminal of a locked lesson is hidden.");
            await tool.SolveForSmokeTest(task);
            if (state.Progress.ContainsKey(task.Key)) throw new InvalidOperationException("A task was checked before the lesson was unlocked.");
            for (int i = 0; i < CheckpointCount(Chapter); i++) state.Checkpoints[CheckpointKey(Chapter, i)] = true;
            if (!state.Read.Contains(Chapter.Id)) state.Read.Add(Chapter.Id);
            RenderAll();
        }
        await tool.SolveForSmokeTest(task);
        var after = state.Progress.ContainsKey(task.Key);
        if (!before && !after) throw new InvalidOperationException("The first task was not completed by its solution.");
        if (state.Game.Xp <= 0 || !state.Game.Achievements.ContainsKey("first-task"))
            throw new InvalidOperationException($"The game did not count the first task (XP {state.Game.Xp}).");
        var extra = tool.SmokeTest();
        return $"{Chapters.Count} chapters, {offered.Count} languages" + (extra == "" ? "" : ", " + extra);
    });
}
