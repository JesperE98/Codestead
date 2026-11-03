namespace Codestead.Shell;

// systemd model: the run state of one loaded unit (service).

public partial class UnitRt
{
    public string Name { get; set; } = "";
    /// <summary>The unit file that was loaded.</summary>
    public string Path { get; set; } = "";
    /// <summary>The unit file's content at the last load (daemon-reload).</summary>
    public string Loaded { get; set; } = "";
    /// <summary>"active", "inactive" or "failed".</summary>
    public string Active { get; set; } = "inactive";
    /// <summary>"running", "dead", "exited" or "failed".</summary>
    public string Sub { get; set; } = "dead";
    /// <summary>When the state last changed.</summary>
    public long? Since { get; set; }
    /// <summary>When the service last started (for "Duration").</summary>
    public long? StartedAt { get; set; }
    /// <summary>The main process while the service runs.</summary>
    public int? Pid { get; set; }
    /// <summary>The latest main process, after the service stopped.</summary>
    public int? LastPid { get; set; }
    /// <summary>Why the service failed, e.g. "exit-code".</summary>
    public string? Result { get; set; }
    /// <summary>E.g. "code=exited, status=1/FAILURE".</summary>
    public string? ExitInfo { get; set; }
}
