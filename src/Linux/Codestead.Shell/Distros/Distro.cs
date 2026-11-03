namespace Codestead.Shell;

// A distribution the simulator can pretend to be.

public partial class Distro
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public Family Family { get; set; } = "debian";
    public string Hostname { get; set; } = "";
    public string Version { get; set; } = "";
    public string? Codename { get; set; }
    public string Kernel { get; set; } = "";
    /// <summary>"apt", "pacman" or "dnf".</summary>
    public string PackageManager { get; set; } = "";
    /// <summary>The group that may use sudo: "sudo" or "wheel".</summary>
    public string AdminGroup { get; set; } = "";
    public int AdminGid { get; set; }
    /// <summary>What the prompt looks like by default: "ubuntu", "debian" or "bracket".</summary>
    public string PromptStyle { get; set; } = "";
    public string OsRelease { get; set; } = "";
    public string Motd { get; set; } = "";
    /// <summary>Mirror servers shown by apt update.</summary>
    public List<string> Mirrors { get; set; } = new();
    public string Accent { get; set; } = "";
}
