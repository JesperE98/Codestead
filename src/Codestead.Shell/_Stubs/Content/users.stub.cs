// TEMPORARY STUB (Content) – what src/content/chapters.ts needs from src/shell/users.ts.
// Delete when the real UsersLib has been ported (see docs/PORTING.md).
namespace Codestead.Shell;

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

public partial class GroupEntry
{
    public string Name { get; set; } = "";
    public string Password { get; set; } = "";
    public int Gid { get; set; }
    public List<string> Members { get; set; } = new();
}

public static partial class UsersLib
{
    public static PasswdEntry? FindUser(Shell sh, string name) => throw new NotImplementedException();
    public static GroupEntry? FindGroup(Shell sh, string name) => throw new NotImplementedException();
    public static string? ShadowHash(Shell sh, string name) => throw new NotImplementedException();
}
