namespace Codestead.Shell;

// systemd model: the explanation shown with `journalctl -x`.

/// <summary>Explanation shown with `journalctl -x` (the `x` field of a journal entry).</summary>
public partial class JournalCatalog
{
    public string Subject { get; set; } = "";
    public List<string> Body { get; set; } = new();
}
