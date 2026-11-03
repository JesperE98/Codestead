namespace Codestead.Shell;

// Users: /etc/passwd, /etc/group and /etc/shadow loaded together.

public partial class UserDb
{
    public List<PasswdEntry> Passwd { get; set; } = new();
    public List<GroupEntry> Group { get; set; } = new();
    public List<ShadowEntry> Shadow { get; set; } = new();
}
