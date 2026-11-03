namespace Codestead.Shell.Commands;

// Port of src/shell/commands/repos.ts
// Repositories outside the distribution's own:
//   - PPA (Ubuntu, and at your own risk Debian): add-apt-repository + apt
//   - AUR (Arch): git clone + makepkg, and the AUR helper yay
//   - COPR (Fedora): dnf copr enable/disable/list
// Plus the made-up programs installed from there (moonphase, snowfall).
// The functions that apt and dnf (PkgCmd) call are in ReposCmd.Ppa.cs and ReposCmd.Copr.cs.

using static ExtrarepoLib;
using static PackagesLib;

public static partial class ReposCmd
{
    private static bool IsRoot(Shell sh) => sh.CurrentUser().Uid == 0;
    private static string Dim(Shell sh, string key, params (string Name, object? Value)[] args) => $"{UtilCmd.Color.Dim}{sh.Msg(key, args)}{UtilCmd.Color.Reset}\n";
    private static PackageDef PkgById(string id) => Packages.FirstOrDefault(p => p.Id == id)!;
    /// <summary>sh.installed[id] used as a truth value.</summary>
    private static bool Has(Shell sh, string id) => !string.IsNullOrEmpty(sh.Installed.Get(id));
    private static string TrimSlash(string s) => s.EndsWith('/') ? s[..^1] : s;
    /// <summary>Math.round for non-negative numbers.</summary>
    private static long Round(double v) => (long)Math.Floor(v + 0.5);

    private static OrderedDictionary<string, FsNode> Kids(params (string Name, FsNode Node)[] items)
    {
        var d = Js.Obj<FsNode>();
        foreach (var (name, node) in items) d[name] = node;
        return d;
    }

    private static readonly Regex YesRe = new(@"^(y|yes|j|ja)\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>
    /// Asks yes/no unless assumeYes. If input comes from a pipe the answer is read from there.
    /// (The same behaviour as the package managers in PkgCmd.cs.)
    /// </summary>
    public static int AskYesNo(CmdCtx ctx, string question, bool defaultYes, bool assumeYes, Func<Sink, int> onYes, Func<Sink, int> onNo)
    {
        if (assumeYes) return onYes(ctx);
        if (ctx.Stdin is not null)
        {
            var answer = ctx.Stdin.Split('\n')[0].Trim();
            ctx.Out(question + answer + "\n");
            var yes = answer == "" ? defaultYes : YesRe.IsMatch(answer);
            return yes ? onYes(ctx) : onNo(ctx);
        }
        ctx.Sh.Ask(question, defaultYes, (yes, io) => yes ? onYes(io) : onNo(io));
        return 0;
    }

    /// <summary>Writes a file as root and creates the directories needed.</summary>
    private static void WriteRootFile(Shell sh, string path, string content)
    {
        EnsureDir(sh, path.Slice(0, path.LastIndexOf('/')));
        sh.Vfs.WriteFile(path, content, sh.RootUser());
    }

    // ================================================================ The programs

    private const double Synodic = 29.530588853;
    private static readonly long NewMoon2000 = new DateTimeOffset(2000, 1, 6, 18, 14, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();

    /// <summary>The moon's age in days since the last new moon.</summary>
    public static double MoonAge(double ms)
    {
        var age = ((ms - NewMoon2000) / 86_400_000) % Synodic;
        return age < 0 ? age + Synodic : age;
    }

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new() { AddAptRepository, Makepkg, Yay, Moonphase, Snowfall, Go };
}
