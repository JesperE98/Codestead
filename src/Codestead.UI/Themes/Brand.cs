using Avalonia.Controls;
using Avalonia.Media;
using Avalonia.Styling;

namespace Codestead.UI.Themes;

/// <summary>A tool's own accent colour, in the light and the dark theme (see "Färgsystemet" in docs/DEVELOPMENT.md).</summary>
/// <param name="Accent">Primary buttons, the current item, focus.</param>
/// <param name="AccentSoft">A light background in the same colour (selected items).</param>
/// <param name="OnAccent">Text on <paramref name="Accent"/> – it must be easy to read.</param>
public sealed record BrandShade(Color Accent, Color AccentSoft, Color OnAccent);

/// <summary>The accent colours of the Codestead tools. Every tool has its own, so you can tell at a glance which one you are in.</summary>
public sealed record Brand(string Name, BrandShade Light, BrandShade Dark)
{
    /// <summary>Codestead Linux: teal, like a terminal prompt.</summary>
    public static readonly Brand Linux = new("linux",
        new(Color.Parse("#0f766e"), Color.Parse("#d4f2ee"), Colors.White),
        new(Color.Parse("#2dd4bf"), Color.Parse("#0f2f2b"), Color.Parse("#062420")));

    /// <summary>The hub: indigo.</summary>
    public static readonly Brand Hub = new("hub",
        new(Color.Parse("#4f46e5"), Color.Parse("#e8e7fe"), Colors.White),
        new(Color.Parse("#8b93fb"), Color.Parse("#1e1f3d"), Color.Parse("#12132b")));

    /// <summary>Puts the colours in a resource dictionary (an app's or a window's), where they override the theme's.</summary>
    public void ApplyTo(IResourceDictionary resources)
    {
        foreach (var (variant, shade) in new[] { (ThemeVariant.Light, Light), (ThemeVariant.Dark, Dark) })
        {
            if (!resources.ThemeDictionaries.TryGetValue(variant, out var provider) || provider is not ResourceDictionary dict)
            {
                dict = new ResourceDictionary();
                resources.ThemeDictionaries[variant] = dict;
            }
            dict["CsAccent"] = new SolidColorBrush(shade.Accent);
            dict["CsAccentSoft"] = new SolidColorBrush(shade.AccentSoft);
            dict["CsOnAccent"] = new SolidColorBrush(shade.OnAccent);
        }
    }
}
