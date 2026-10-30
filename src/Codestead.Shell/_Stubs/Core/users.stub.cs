// TEMPORARY STUB – deleted by the agent that ports the real module (see docs/PORTING.md).
// It only exists so the core compiles before that module has been ported.
namespace Codestead.Shell;

public static partial class UsersLib
{
    public static User LookupUser(Shell sh, string name) => name == "root"
        ? new User { Name = "root", Uid = 0, Groups = new() { "root" }, Home = "/root" }
        : new User { Name = name, Uid = 1000, Groups = new() { name, sh.Distro.AdminGroup }, Home = $"/home/{name}" };
}
