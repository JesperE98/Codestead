namespace Codestead.Shell;

// Users: one line of /etc/group.

public partial class GroupEntry
{
    public string Name { get; set; } = "";
    public string Password { get; set; } = "";
    public int Gid { get; set; }
    public List<string> Members { get; set; } = new();
}
