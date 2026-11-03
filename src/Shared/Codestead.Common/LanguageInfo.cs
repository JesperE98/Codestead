namespace Codestead.Common;

/// <summary>A language from build/languages.json.</summary>
/// <param name="Name">The language's name in the language itself.</param>
/// <param name="Dir">Writing direction: "ltr" or "rtl".</param>
/// <param name="Offered">False: parked – not in the menus and its texts are not required.</param>
public sealed record LanguageInfo(string Code, string Name, string Dir, bool Offered)
{
    public bool RightToLeft => Dir == "rtl";
}
