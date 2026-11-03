namespace Codestead.Shell;

// Virtual file system: a user as seen by permission checks (name, uid, groups, home).

public partial class User
{
    public string Name { get; set; } = "";
    public int Uid { get; set; }
    public List<string> Groups { get; set; } = new();
    public string Home { get; set; } = "";
}
