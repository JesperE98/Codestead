namespace Codestead.Shell;

// systemd model: the symlinks created and removed by enable/disable.

public partial class LinkChange
{
    public List<string> Created { get; set; } = new();
    public List<string> Removed { get; set; } = new();
}
