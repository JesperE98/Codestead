using Avalonia.Markup.Xaml;
using Avalonia.Styling;

namespace Codestead.UI.Themes;

/// <summary>The Codestead theme (colours, fonts, button styles). Add it after FluentTheme.</summary>
public partial class CodesteadTheme : Styles
{
    public CodesteadTheme() => AvaloniaXamlLoader.Load(this);
}
