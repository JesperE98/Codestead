namespace Codestead.Shell;

// Users: one line of /etc/shadow.

public partial class ShadowEntry
{
    public string Name { get; set; } = "";
    /// <summary>Password hash. A leading "!" or "*" means locked/no password.</summary>
    public string Hash { get; set; } = "";
    /// <summary>Last password change, in days since 1970-01-01 (empty = never).</summary>
    public string LastChange { get; set; } = "";
    public string Min { get; set; } = "";
    public string Max { get; set; } = "";
    public string Warn { get; set; } = "";
    public string Inactive { get; set; } = "";
    public string Expire { get; set; } = "";
    public string Reserved { get; set; } = "";
}
