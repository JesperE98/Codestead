namespace Codestead.Shell;

// systemd model: the saved state of all services, the journal and the boots.

public partial class ServiceState
{
    public OrderedDictionary<string, UnitRt> Units { get; set; } = Js.Obj<UnitRt>();
    public List<JournalEntry> Journal { get; set; } = new();
    /// <summary>All boots; the last one is the current one.</summary>
    public List<BootRecord> Boots { get; set; } = new();
    /// <summary>Running number for jobs (shown with journalctl -x).</summary>
    public int Job { get; set; }
    public string MachineId { get; set; } = "";
}
