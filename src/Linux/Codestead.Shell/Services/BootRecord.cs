namespace Codestead.Shell;

// systemd model: one boot of the computer.

/// <summary>One boot ({ id, start }).</summary>
public partial class BootRecord
{
    public string Id { get; set; } = "";
    public long Start { get; set; }
}
