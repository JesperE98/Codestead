namespace Codestead.Shell;

// systemd model: the settings read from a unit file.

public partial class ParsedUnit
{
    public string Description { get; set; } = "";
    public List<string> Docs { get; set; } = new();
    /// <summary>"simple", "exec", "notify", "forking", "oneshot" or "dbus".</summary>
    public string Type { get; set; } = "simple";
    public string Exec { get; set; } = "";
    public string? Reload { get; set; }
    public string? User { get; set; }
    public bool RemainAfterExit { get; set; }
    public List<string> WantedBy { get; set; } = new();
    public List<string> Alias { get; set; } = new();
}
