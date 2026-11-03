namespace Codestead.Content;

// One language from build/languages.json.

public partial class Language
{
    public Lang Code { get; set; } = "";
    /// <summary>The language's name in the language itself.</summary>
    public string Name { get; set; } = "";
    /// <summary>Writing direction: "ltr" or "rtl".</summary>
    public string Dir { get; set; } = "ltr";
    /// <summary>False: parked – not in the menus, its texts are not required (build/languages.json).</summary>
    public bool Offered { get; set; } = true;
}
