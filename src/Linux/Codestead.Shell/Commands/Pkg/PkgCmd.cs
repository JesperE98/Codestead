namespace Codestead.Shell.Commands;

// Port of src/shell/commands/pkg.ts
// Simulated package managers: apt (Debian/Ubuntu), pacman (Arch) and dnf (Fedora/RHEL).
// The output imitates the real programs, but simplified.

using static PackagesLib;

public static partial class PkgCmd
{
    private static bool IsRoot(CmdCtx ctx) => ctx.Sh.CurrentUser().Uid == 0;
    private static string PkgName(CmdCtx ctx, PackageDef p) => p.Names.Get(ctx.Sh.Distro.Family)!;
    private static List<PackageDef> FamilyPackages(CmdCtx ctx) =>
        Packages.Where(p => !string.IsNullOrEmpty(p.Names.Get(ctx.Sh.Distro.Family)) && IsKnown(ctx.Sh, p)).ToList();

    private static bool Flag(Shell sh, string key) => sh.Flags.TryGetValue(key, out var v) && v;

    private static readonly Regex YesRe = new(@"^(y|yes|j|ja)\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>
    /// Asks "continue? [Y/n]" unless -y/--noconfirm was given.
    /// If input comes from a pipe (e.g. `yes | apt ...`) the answer is read from there.
    /// </summary>
    private static int Confirm(CmdCtx ctx, string question, bool defaultYes, bool assumeYes, Func<Sink, int> onYes, Func<Sink, int> onNo)
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

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new() { MakeApt("apt"), MakeApt("apt-get"), Pacman, Dnf("dnf"), Dnf("dnf5") };
}
