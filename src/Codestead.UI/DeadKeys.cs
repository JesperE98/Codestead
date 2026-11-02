using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;

namespace Codestead.UI;

/// <summary>
/// Makes the dead tilde work in every text box on Linux. On X11, Avalonia lets the input method combine
/// dead keys, and the combination "dead tilde + space" (how ~ is typed on Swedish, Finnish, French,
/// Spanish, Portuguese and many other keyboards) comes out as a plain space – so ~ could not be typed in
/// the terminal at all. Other dead keys (^ ` ´ ¨) and dead tilde + a letter (ñ, õ) work.
///
/// When a dead key is immediately followed by a space that comes through uncombined, the space is
/// replaced by ~. Only the tilde fails this way, so the replacement is always the right character.
/// </summary>
public static class DeadKeys
{
    private static bool deadKeyPending;
    private static bool replaceNextSpace;

    /// <summary>Installs the fix for all text boxes (once, at startup). Does nothing outside Linux.</summary>
    public static void Install()
    {
        if (!OperatingSystem.IsLinux()) return;
        InputElement.KeyDownEvent.AddClassHandler<TextBox>(OnKeyDown, RoutingStrategies.Tunnel, handledEventsToo: true);
        InputElement.TextInputEvent.AddClassHandler<TextBox>(OnTextInput, RoutingStrategies.Tunnel, handledEventsToo: true);
    }

    private static readonly HashSet<Key> Modifiers = new()
    {
        Key.LeftShift, Key.RightShift, Key.LeftAlt, Key.RightAlt, Key.LeftCtrl, Key.RightCtrl, Key.LWin, Key.RWin,
    };

    /// <summary>For tests: what happens to a key and the text it produced.</summary>
    internal static string? Filter(Key key, string? keySymbol, KeyModifiers modifiers, string? text)
    {
        OnKey(key, keySymbol, modifiers);
        return text is null ? null : OnText(text);
    }

    private static void OnKeyDown(TextBox box, KeyEventArgs e) => OnKey(e.Key, e.KeySymbol, e.KeyModifiers);

    private static void OnKey(Key key, string? keySymbol, KeyModifiers modifiers)
    {
        if (Modifiers.Contains(key)) return; // AltGr or Shift held for the dead key itself
        // A dead key: the input method swallows it, so it has neither a key nor a symbol.
        if (key == Key.None && keySymbol is null)
        {
            deadKeyPending = true;
            replaceNextSpace = false;
            return;
        }
        replaceNextSpace = deadKeyPending && key == Key.Space && (modifiers & ~KeyModifiers.Shift) == KeyModifiers.None;
        deadKeyPending = false;
    }

    private static void OnTextInput(TextBox box, TextInputEventArgs e)
    {
        if (e.Text is not null) e.Text = OnText(e.Text);
    }

    private static string OnText(string text)
    {
        // Text after a dead key means the input method combined it (e.g. ^ or ñ): nothing to fix.
        deadKeyPending = false;
        if (!replaceNextSpace) return text;
        replaceNextSpace = false;
        return text == " " ? "~" : text;
    }
}
