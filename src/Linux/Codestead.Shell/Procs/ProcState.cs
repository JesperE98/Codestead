namespace Codestead.Shell;

// Process table: the saved processes and jobs.

public partial class ProcState
{
    public List<Proc> Procs { get; set; } = new();
    public List<Job> Jobs { get; set; } = new();
    public int NextPid { get; set; }
}
