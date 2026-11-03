namespace Codestead.Shell.Commands;

// The nohup command: run a command that keeps running after you log out.

public static partial class RunCmd
{
    private static readonly CommandDef Nohup = new()
    {
        Name = "nohup",
        Summary = "Kör ett kommando som fortsätter när du loggar ut",
        SummaryEn = "Run a command that keeps running after you log out",
        Man = """
            NAMN
                   nohup - kör ett kommando som inte stoppas när du loggar ut

            SYNOPSIS
                   nohup KOMMANDO [ARGUMENT]...

            BESKRIVNING
                   När du loggar ut (eller stänger terminalen eller ssh-
                   anslutningen) får dina program signalen SIGHUP ("hang up") och
                   avslutas. nohup gör att KOMMANDO struntar i den signalen.

                   Utdata som skulle ha visats i terminalen hamnar i stället i
                   filen nohup.out. Sätt & sist för att köra kommandot i bakgrunden.

            EXEMPEL
                   nohup ./lang-jobb.sh &
                   nohup ./lang-jobb.sh > jobb.log 2>&1 &
            """,
        ManEn = """
            NAME
                   nohup - run a command that is not stopped when you log out

            SYNOPSIS
                   nohup COMMAND [ARGUMENT]...

            DESCRIPTION
                   When you log out (or close the terminal or the ssh connection), your
                   programs get the signal SIGHUP ("hang up") and exit. nohup makes
                   COMMAND ignore that signal.

                   Output that would have been shown in the terminal goes to the file
                   nohup.out instead. Put & last to run the command in the background.

            EXAMPLES
                   nohup ./long-job.sh &
                   nohup ./long-job.sh > job.log 2>&1 &
            """,
        Run = ctx =>
        {
            var args = ctx.Args.ToList();
            if (args.Count > 0 && args[0] == "--") args.RemoveAt(0);
            if (args.Count == 0)
            {
                ctx.Err("nohup: missing operand\nTry 'nohup --help' for more information.\n");
                return 125;
            }
            var sh = ctx.Sh;
            if (!ctx.IsTTY) return Exec(ctx, "nohup", args, new IO(ctx.OutFn, ctx.ErrFn, null, false));
            // Output to the terminal goes to nohup.out (in the home directory if this one is not writable).
            var user = sh.CurrentUser();
            var file = sh.Resolve("nohup.out");
            var label = "nohup.out";
            var here = sh.Vfs.TryLookup(sh.Cwd, user);
            if (here is null || !VfsLib.HasPerm(here, user, 'w'))
            {
                file = $"{user.Home}/nohup.out";
                label = file;
            }
            var output = new StringBuilder();
            ctx.Err($"nohup: ignoring input and appending output to '{label}'\n");
            int code = Exec(ctx, "nohup", args, new IO(s => output.Append(s), s => output.Append(s), null, false));
            try
            {
                sh.Vfs.WriteFile(file, output.ToString(), user, append: true);
            }
            catch (FsError e)
            {
                ctx.Err($"nohup: failed to open '{label}': {e.Message}\n");
                return 125;
            }
            return code;
        },
    };
}
