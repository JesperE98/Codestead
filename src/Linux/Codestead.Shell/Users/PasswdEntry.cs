namespace Codestead.Shell;

// Users: one line of /etc/passwd.

public partial class PasswdEntry
{
    public string Name { get; set; } = "";
    public string Password { get; set; } = "";
    public int Uid { get; set; }
    public int Gid { get; set; }
    public string Gecos { get; set; } = "";
    public string Home { get; set; } = "";
    public string Shell { get; set; } = "";
}
