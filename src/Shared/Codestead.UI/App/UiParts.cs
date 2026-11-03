using Avalonia.Controls;
using Avalonia.Media;

namespace Codestead.UI.App;

/// <summary>Small building blocks the windows of every app use.</summary>
public static class UiParts
{
    /// <summary>A wrapping text with a size, an optional weight and an optional style class ("muted", "eyebrow" …).</summary>
    public static TextBlock Text(string text, double size = 14, FontWeight? weight = null, string? cls = null)
    {
        var tb = new TextBlock { Text = text, FontSize = size, TextWrapping = TextWrapping.Wrap };
        if (weight is not null) tb.FontWeight = weight.Value;
        if (cls is not null) tb.Classes.Add(cls);
        return tb;
    }
}
