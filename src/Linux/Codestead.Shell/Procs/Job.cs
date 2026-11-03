namespace Codestead.Shell;

// Process table: a background job started by the student.

public partial class Job
{
    public int Id { get; set; }
    public int Pid { get; set; }
    public string Cmd { get; set; } = "";
    /// <summary>"Running", "Done", "Terminated" or "Killed".</summary>
    public string State { get; set; } = "Running";
    /// <summary>When a `sleep` job finishes (ms since 1970).</summary>
    public long? EndsAt { get; set; }
    public int? Exit { get; set; }
}
