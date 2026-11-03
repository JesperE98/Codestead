namespace Codestead.Hub;

/// <summary>Settings saved between runs.</summary>
public sealed class HubState
{
    public string? Lang { get; set; }
    /// <summary>null = follow the system, "light" or "dark".</summary>
    public string? Theme { get; set; }
}
