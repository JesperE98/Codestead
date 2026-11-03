using Avalonia;
using Avalonia.Styling;

namespace Codestead.UI.App;

/// <summary>The theme setting of every app: null follows the system, "light" or "dark".</summary>
public static class ThemeSwitcher
{
    public static void Apply(string? theme)
    {
        if (Application.Current is null) return;
        Application.Current.RequestedThemeVariant = theme switch
        {
            "light" => ThemeVariant.Light,
            "dark" => ThemeVariant.Dark,
            _ => ThemeVariant.Default,
        };
    }
}
