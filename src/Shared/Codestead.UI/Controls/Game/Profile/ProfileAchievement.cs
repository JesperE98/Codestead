namespace Codestead.UI.Controls.Game;

// One achievement in a saved profile.

public sealed class ProfileAchievement
{
    public string Id { get; set; } = "";
    public string Icon { get; set; } = "";
    public string Category { get; set; } = "";
    public bool Hidden { get; set; }
    /// <summary>When it was unlocked ("yyyy-MM-ddTHH:mm", local time), or null.</summary>
    public string? UnlockedAt { get; set; }
    public int Current { get; set; }
    public int Target { get; set; }
    /// <summary>Empty for a hidden achievement that has not been found.</summary>
    public Dictionary<string, string> Title { get; set; } = new();
    public Dictionary<string, string> Description { get; set; } = new();
}
