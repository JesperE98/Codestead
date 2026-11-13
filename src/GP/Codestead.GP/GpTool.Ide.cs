using Avalonia.Controls;
using Avalonia.Media;
using Avalonia.Threading;
using Codestead.GP.Course.Ide;

namespace Codestead.GP;

// The IDE picker in the top bar, next to the API: the chapters' ":::ide" blocks follow it. One choice for the whole course, saved in ide.json; until the learner chooses, Visual Studio
// on Windows and CLion elsewhere (and Setting up your IDE asks them to choose).
public sealed partial class GpTool
{
    private const string IdeFile = "ide";
    private readonly ComboBox idePicker = new() { MinWidth = 150 };
    private bool fillingIdes;
    private string? ide;

    public override Control? TopBarExtra => idePicker;

    /// <summary>The IDE the texts follow.</summary>
    internal string Ide => ide ??= Window.Storage.Load<Dictionary<string, string>>(IdeFile)?.GetValueOrDefault("ide") is { } id && Ides.IsKnown(id) ? id : Ides.Default;

    /// <summary>Has the learner chosen an IDE (or is it still the default)?</summary>
    private bool IdeChosen => File.Exists(Path.Combine(Window.Storage.Directory, IdeFile + ".json"));

    private void InitIdePicker()
    {
        // Rebuilding the items must wait until the picker has finished its own selection change (see the window's pickers).
        idePicker.SelectionChanged += (_, _) =>
        {
            if (fillingIdes || idePicker.SelectedItem is not ComboBoxItem { Tag: string id }) return;
            Dispatcher.UIThread.Post(() => ChooseIde(id));
        };
    }

    private void FillIdePicker()
    {
        fillingIdes = true;
        idePicker.Items.Clear();
        idePicker.Items.Add(new ComboBoxItem { Content = Window.T("ide.group"), IsEnabled = false, FontWeight = FontWeight.SemiBold, FontSize = 12 });
        foreach (var i in Ides.All)
        {
            var item = new ComboBoxItem { Content = "   " + i.Name, Tag = i.Id };
            idePicker.Items.Add(item);
            if (i.Id == Ide) idePicker.SelectedItem = item;
        }
        ToolTip.SetTip(idePicker, Window.T("ide.label"));
        fillingIdes = false;
    }

    /// <summary>The learner chose an IDE: saved, and the texts and the panel shown again for it.</summary>
    internal void ChooseIde(string id)
    {
        if (!Ides.IsKnown(id) || (id == Ide && IdeChosen)) return;
        ide = id;
        Window.Storage.Save(IdeFile, new Dictionary<string, string> { ["ide"] = id });
        Window.Refresh();
    }

    public override void TextsApplied() => FillIdePicker();

    /// <summary>Setting up your IDE asks the learner to choose until they have.</summary>
    private string WithIdeHint(string chapterId, string text) =>
        chapterId == "ide-setup" && !IdeChosen ? $"> {Window.T("ide.chooseHint", ("ide", Ides.Get(Ide).Name))}\n\n{text}" : text;
}
