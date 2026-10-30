// TEMPORARY STUB (Content) – what src/content/chapters.ts needs from src/shell/services.ts.
// Delete when the real ServicesLib has been ported (see docs/PORTING.md).
namespace Codestead.Shell;

public partial class UnitRt
{
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public string Loaded { get; set; } = "";
    /// <summary>"active" | "inactive" | "failed"</summary>
    public string Active { get; set; } = "inactive";
    /// <summary>"running" | "dead" | "exited" | "failed"</summary>
    public string Sub { get; set; } = "dead";
    public long? Since { get; set; }
    public long? StartedAt { get; set; }
    public int? Pid { get; set; }
    public int? LastPid { get; set; }
    public string? Result { get; set; }
    public string? ExitInfo { get; set; }
}

public partial class ServiceState
{
    public OrderedDictionary<string, UnitRt> Units { get; set; } = Js.Obj<UnitRt>();
}
