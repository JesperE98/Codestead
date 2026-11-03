namespace Codestead.UI.Controls.Game;

// A category of achievements in a saved profile.

public sealed class ProfileCategory
{
    public string Id { get; set; } = "";
    public Dictionary<string, string> Title { get; set; } = new();
    /// <summary>A group of hidden achievements (shown as "x of y found").</summary>
    public bool Hidden { get; set; }
}
