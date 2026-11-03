using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Documents;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Styling;
using Avalonia.Threading;
using Codestead.Content;
using Codestead.Content.Game;
using Codestead.Learning;
using Codestead.Learning.Game;
using Codestead.Shell;
using Codestead.UI;
using Codestead.UI.Controls;
using Codestead.UI.Controls.Game;
using Codestead.Terminal;
using Codestead.UI.App;
using static Codestead.UI.App.UiParts;
using ShellType = Codestead.Shell.Shell;

namespace Codestead.Linux;

// The --smoke-test of the installation tests.
public sealed partial class MainWindow
{
    private void RunSmokeTest() => SmokeTest.Run(this, ProductInfo.Meta, () =>
    {
        // Every chapter renders in every language without throwing.
        foreach (var l in LanguagesLib.Languages)
        {
            state.Lang = l.Code;
            foreach (var ch in ChaptersLib.Chapters)
            {
                state.Chapter = ch.Id;
                UseShellFor(ch);
                RenderAll();
            }
        }
        // Switching language and distribution in the pickers, as a click does, must not crash
        // (it once closed the app: the pickers were rebuilt inside their own SelectionChanged).
        foreach (var lc in new[] { "sv", "ja", "en" })
        {
            langPicker.SelectedItem = langPicker.Items.OfType<ComboBoxItem>().First(i => Equals(i.Tag, lc));
            Dispatcher.UIThread.RunJobs();
            if (Lang != lc) throw new InvalidOperationException($"The language picker did not switch to {lc}.");
        }
        state.Chapter = ChaptersLib.Chapters.First(c => ChaptersLib.DistrosFor(c).Count() > 1).Id;
        UseShellFor(Chapter);
        FillPickers();
        foreach (var id in distroPicker.Items.OfType<ComboBoxItem>().Select(i => i.Tag).OfType<string>().ToList())
        {
            distroPicker.SelectedItem = distroPicker.Items.OfType<ComboBoxItem>().First(i => Equals(i.Tag, id));
            Dispatcher.UIThread.RunJobs();
            if (Distro.Id != id) throw new InvalidOperationException($"The distribution picker did not switch to {id}.");
        }
        // Solve the first task of the first chapter in the real terminal.
        state.Lang = "en";
        state.Chapter = ChaptersLib.Chapters[0].Id;
        UseShellFor(Chapter);
        ApplyLanguage();
        var task = Chapter.Tasks[0];
        var before = state.Progress.ContainsKey(ChaptersLib.TaskKey(Chapter.Id, task.Id, task.PerFamily, Distro.Family));
        foreach (var cmd in task.SolutionFor(Distro, shell.World))
        {
            terminal.Inject(cmd);
            OnResult(shell.Execute(cmd));
        }
        var after = state.Progress.ContainsKey(ChaptersLib.TaskKey(Chapter.Id, task.Id, task.PerFamily, Distro.Family));
        if (!before && !after) throw new InvalidOperationException("The first task was not completed by its solution.");
        if (state.Game.Xp <= 0 || !state.Game.Achievements.ContainsKey("first-task"))
            throw new InvalidOperationException($"The game did not count the first task (XP {state.Game.Xp}).");
        return $"{ChaptersLib.Chapters.Count} chapters, {LanguagesLib.Languages.Count} languages";
    });
}
