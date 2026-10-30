// TEMPORARY STUB (Content) – what src/content/chapters.ts needs from src/shell/extrarepo.ts.
// Delete when the real ExtrarepoLib has been ported (see docs/PORTING.md).
namespace Codestead.Shell;

public partial class Ppa
{
    public string User { get; set; } = "";
    public string Name { get; set; } = "";
}

public static partial class ExtrarepoLib
{
    public static Ppa? ParsePpa(string spec) => throw new NotImplementedException();
    public static string PpaSourcesPath(Ppa p) => throw new NotImplementedException();
    public static bool ExtraRepoEnabled(Shell sh, string repo) => throw new NotImplementedException();
}
