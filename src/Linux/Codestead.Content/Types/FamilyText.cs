namespace Codestead.Content;

// A text with one variant per distribution family.

/// <summary>Text that differs between the families, e.g. in the translation files.</summary>
public partial class FamilyText
{
    public string? Debian { get; set; }
    public string? Arch { get; set; }
    public string? Redhat { get; set; }

    /// <summary>familyText[family]</summary>
    public string? Get(Family family) => family switch
    {
        "debian" => Debian,
        "arch" => Arch,
        "redhat" => Redhat,
        _ => null,
    };
}
