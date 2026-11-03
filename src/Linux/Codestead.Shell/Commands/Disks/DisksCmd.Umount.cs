namespace Codestead.Shell.Commands;

// The umount command: unmount a file system.

public static partial class DisksCmd
{
    private static readonly CommandDef Umount = new()
    {
        Name = "umount",
        Summary = "Avmonterar ett filsystem",
        SummaryEn = "Unmount a file system",
        Man = UmountMan,
        ManEn = UmountManEn,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "vfl", Long = Long(("verbose", "v"), ("force", "f"), ("lazy", "l")) });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            if (o.Operands.Count == 0)
            {
                ctx.Err("umount: bad usage\nTry 'umount --help' for more information.\n");
                return 1;
            }
            var sh = ctx.Sh;
            var state = sh.Disks;
            var root = sh.RootUser();
            int code = 0;
            foreach (var arg in o.Operands)
            {
                var block = arg.StartsWith("/dev/", StringComparison.Ordinal) || LabelUuidPrefix.IsMatch(arg) ? DisksLib.FindBlock(state, arg) : null;
                Mount? m;
                string shown;
                if (block is not null)
                {
                    shown = block.Path;
                    m = DisksLib.MountsOf(state, block.Name).LastOrDefault();
                }
                else
                {
                    var target = sh.Resolve(arg);
                    shown = target;
                    m = state.Mounts.LastOrDefault(x => x.Target == target);
                    if (m is null && sh.Vfs.TryLookup(target, root) is null)
                    {
                        ctx.Err($"umount: {arg}: no mount point specified.\n");
                        code = 1;
                        continue;
                    }
                }
                if (!IsRoot(ctx))
                {
                    ctx.Err($"umount: {shown}: must be superuser to use umount.\n");
                    code = 1;
                    continue;
                }
                if (m is null)
                {
                    ctx.Err($"umount: {shown}: not mounted.\n");
                    code = 32;
                    continue;
                }
                var t = m.Target;
                bool Inside(string p) => p == t || p.StartsWith(t == "/" ? "/" : t + "/", StringComparison.Ordinal);
                var nested = state.Mounts.Any(x => x != m && x.Target != t && Inside(x.Target));
                if (m.System || nested || Inside(sh.Cwd))
                {
                    ctx.Err($"umount: {t}: target is busy.\n");
                    if (Inside(sh.Cwd) && !m.System)
                    {
                        Tip(ctx, "disks.shellInsideDir");
                    }
                    code = 32;
                    continue;
                }
                var (dir, name) = sh.Vfs.Parent(t, root);
                var fsRoot = dir.Children!.Get(name);
                if (m.Dev is not null)
                {
                    var b = DisksLib.FindBlock(state, m.Dev);
                    if (b is not null) b.Dev.Root = fsRoot?.Type == "dir" ? fsRoot : VfsLib.MakeDir();
                }
                if (m.Under is not null) dir.Children![name] = m.Under;
                else dir.Children![name] = VfsLib.MakeDir();
                var removed = m;
                state.Mounts = state.Mounts.Where(x => x != removed).ToList();
                DisksLib.WriteProcMounts(sh.Vfs, state);
                if (o.Flags.Contains("v")) ctx.Out($"umount: {t} unmounted\n");
            }
            return code;
        },
    };

    private const string UmountMan = """
        NAMN
               umount - avmontera ett filsystem

        SYNOPSIS
               umount KATALOG | ENHET

        BESKRIVNING
               Kopplar bort filsystemet från katalogträdet. Allt som ännu inte
               skrivits till enheten skrivs först, så att inget går förlorat.
               Avmontera alltid en USB-sticka innan du drar ut den!

               Notera stavningen: umount, utan n.

               Om något använder filsystemet – till exempel om ditt skal står i
               katalogen – vägrar umount med "target is busy". Gå då därifrån
               (cd ~) och försök igen.

        FLAGGOR
               -v           berätta vad som händer

        EXEMPEL
               sudo umount /mnt/usb
               sudo umount /dev/sdb1
        """;

    private const string UmountManEn = """
        NAME
               umount - unmount a file system

        SYNOPSIS
               umount DIRECTORY | DEVICE

        DESCRIPTION
               Detaches the file system from the directory tree. Everything that
               has not been written to the device yet is written first, so that
               nothing is lost. Always unmount a USB stick before unplugging it!

               Note the spelling: umount, without an n.

               If something is using the file system – for example if your shell
               is in the directory – umount refuses with "target is busy". Leave
               the directory (cd ~) and try again.

        OPTIONS
               -v           verbose

        EXAMPLES
               sudo umount /mnt/usb
               sudo umount /dev/sdb1
        """;
}
