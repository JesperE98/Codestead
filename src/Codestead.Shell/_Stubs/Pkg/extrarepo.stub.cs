// TEMPORARY STUB – deleted when src/shell/extrarepo.ts has been ported (see docs/PORTING.md).
// What Commands/PkgCmd.cs, ReposCmd.cs and UniversalCmd.cs use from ExtrarepoLib.
namespace Codestead.Shell;

public partial class Ppa
{
    public string User { get; set; } = "";
    public string Name { get; set; } = "";
}

public partial class Copr
{
    public string Owner { get; set; } = "";
    public string Project { get; set; } = "";
}

public static partial class ExtrarepoLib
{
    public const string PpaHost = "ppa.launchpadcontent.net";
    public const string CoprHost = "copr.fedorainfracloud.org";
    public const string PpaSuite = "noble";

    public static Ppa? ParsePpa(string spec) => throw new NotImplementedException();
    public static string PpaUri(Ppa p) => throw new NotImplementedException();
    public static string PpaSourcesPath(Ppa p) => throw new NotImplementedException();
    public static string PpaListPath(Ppa p) => throw new NotImplementedException();
    public static Copr? ParseCopr(string spec) => throw new NotImplementedException();
    public static string CoprId(Copr c) => throw new NotImplementedException();
    public static string CoprRepoPath(Copr c) => throw new NotImplementedException();
    public static bool CoprEnabled(Shell sh, Copr c) => throw new NotImplementedException();
    public static void EnsureDir(Shell sh, string path) => throw new NotImplementedException();
}
