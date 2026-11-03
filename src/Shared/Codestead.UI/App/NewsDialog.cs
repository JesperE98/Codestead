using Codestead.UI.Controls;

namespace Codestead.UI.App;

/// <summary>The "What's new" dialog of every app (newest version first; only the list scrolls).</summary>
public static class NewsDialog
{
    public static void Show(OverlayHost overlay, WhatsNewTexts texts, IEnumerable<ChangelogEntry> entries, string lang, Action? afterClose = null)
    {
        void Close()
        {
            overlay.CloseDialog();
            afterClose?.Invoke();
        }
        overlay.ShowDialog(WhatsNewView.Build(texts, entries, lang, Close), Close, 560, scroll: false);
    }
}
