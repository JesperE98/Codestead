using Avalonia.Media;

namespace Codestead.UI.Themes;

// A tool's accent colours in one theme (light or dark).

/// <summary>A tool's own accent colour, in the light and the dark theme (see "Färgsystemet" in docs/DEVELOPMENT.md).</summary>
/// <param name="Accent">Primary buttons, the current item, focus.</param>
/// <param name="AccentSoft">A light background in the same colour (selected items).</param>
/// <param name="OnAccent">Text on <paramref name="Accent"/> – it must be easy to read.</param>
public sealed record BrandShade(Color Accent, Color AccentSoft, Color OnAccent);
