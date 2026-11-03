namespace Codestead.Shell;

// Process table: one process.

public partial class Proc
{
    public int Pid { get; set; }
    public int Ppid { get; set; }
    public string User { get; set; } = "";
    /// <summary>The whole command line, e.g. "/usr/sbin/sshd -D".</summary>
    public string Cmd { get; set; } = "";
    public double Cpu { get; set; }
    public double Mem { get; set; }
    public long Vsz { get; set; }
    public long Rss { get; set; }
    public string Tty { get; set; } = "?";
    public string Stat { get; set; } = "Ss";
    public string Start { get; set; } = "08:00";
    public string Time { get; set; } = "0:00";
}
