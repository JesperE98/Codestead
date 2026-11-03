namespace Codestead.Shell;

// systemd model: one line in the journal.

public partial class JournalEntry
{
    /// <summary>Time (ms since 1970).</summary>
    public long T { get; set; }
    /// <summary>Which boot the line belongs to (index in `Boots`).</summary>
    public int Boot { get; set; }
    /// <summary>The program that wrote the line, e.g. "systemd", "sshd" or "kernel".</summary>
    public string Ident { get; set; } = "";
    public int? Pid { get; set; }
    /// <summary>0 = emerg … 3 = err, 4 = warning, 5 = notice, 6 = info, 7 = debug.</summary>
    public int Prio { get; set; }
    public string Msg { get; set; } = "";
    /// <summary>The service the line is about (for `journalctl -u`).</summary>
    public string? Unit { get; set; }
    /// <summary>Explanation shown with `journalctl -x`.</summary>
    public JournalCatalog? X { get; set; }
}
