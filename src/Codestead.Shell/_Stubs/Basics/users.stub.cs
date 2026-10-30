// TEMPORARY STUB – needed by Commands/FsCmd.cs and Commands/SystemCmd.cs until users.ts is ported
// (see docs/PORTING.md). Delete this file when Users.cs exists.
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

public static partial class UsersLib
{
    public static PasswdEntry? FindUser(Shell sh, string name) =>
        name is "root" or InitfsLib.Student
            ? new PasswdEntry { Name = name, Uid = name == "root" ? 0 : 1000, Gid = name == "root" ? 0 : 1000, Home = sh.GetUser(name).Home, Shell = "/bin/bash" }
            : null;

    public static bool UserExists(Shell sh, string name) => FindUser(sh, name) is not null;

    public static bool GroupExists(Shell sh, string name) => GidOf(sh, name) is not null;

    public static int? GidOf(Shell sh, string group) => group switch
    {
        "root" => 0,
        "sudo" => 27,
        "wheel" => 10,
        InitfsLib.Student => 1000,
        _ => null,
    };

    public static string? ShadowHash(Shell sh, string name) => FindUser(sh, name) is null ? null : "!";

    public static bool VerifyPassword(Shell sh, string name, string password) => false;

    public static void SwitchUser(Shell sh, string name, bool login, Action<string> warn)
    {
        var entry = FindUser(sh, name);
        var user = sh.GetUser(name);
        sh.UserStack.Add(name);
        sh.Env["USER"] = name;
        sh.Env["LOGNAME"] = name;
        sh.Env["HOME"] = user.Home;
        if (!string.IsNullOrEmpty(entry?.Shell)) sh.Env["SHELL"] = entry.Shell;
        if (!login) return;
        var home = sh.Vfs.TryLookup(user.Home, user);
        if (home?.Type == "dir") sh.Cwd = user.Home;
        else warn($"cannot change directory to {user.Home}: No such file or directory");
    }

    public static bool IsNologin(string shell) => shell.EndsWith("/nologin", StringComparison.Ordinal) || shell.EndsWith("/false", StringComparison.Ordinal);
}
