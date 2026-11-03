namespace Codestead.Shell;

// A distribution family: package manager and package format.

public partial class FamilyInfo
{
    public Family Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string PackageManager { get; set; } = "";
    public string PackageFormat { get; set; } = "";
    public string Members { get; set; } = "";
}
