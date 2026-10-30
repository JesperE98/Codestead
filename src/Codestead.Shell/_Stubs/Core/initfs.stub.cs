// TEMPORARY STUB – deleted by the agent that ports the real module (see docs/PORTING.md).
// It only exists so the core compiles before that module has been ported.
namespace Codestead.Shell;

public static partial class InitfsLib
{
    public const string Student = "elev";

    public static FsNode BuildFs(Distro distro)
    {
        FsNode D(string owner = "root") => VfsLib.MakeDir(owner);
        var root = D();
        var home = D();
        home.Children!["elev"] = D("elev");
        root.Children!["home"] = home;
        var usr = D();
        usr.Children!["bin"] = D();
        root.Children["usr"] = usr;
        root.Children["bin"] = D();
        root.Children["etc"] = D();
        root.Children["tmp"] = VfsLib.MakeDir("root", Js.Oct(1777));
        root.Children["root"] = VfsLib.MakeDir("root", Js.Oct(700));
        return root;
    }
}
