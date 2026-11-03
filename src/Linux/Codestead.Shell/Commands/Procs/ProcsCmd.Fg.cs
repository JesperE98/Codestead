namespace Codestead.Shell.Commands;

// The fg command: moves a background job to the foreground.

public static partial class ProcsCmd
{
    private static readonly CommandDef Fg = new()
    {
        Name = "fg",
        Builtin = true,
        Summary = "Flyttar ett bakgrundsjobb till förgrunden",
        Man = """
            NAMN
                   fg - flytta ett jobb till förgrunden

            SYNOPSIS
                   fg [%JOBB]

            BESKRIVNING
                   Jobbet tar över terminalen tills det är klart. I en riktig terminal
                   kan du skicka tillbaka det till bakgrunden med Ctrl+Z följt av bg.
            """,
        Run = ctx =>
        {
            var job = PickJob(ctx);
            if (job is null) return 1;
            ctx.Out(job.Cmd + "\n");
            if (job.State == "Running")
            {
                ctx.Out($"{UtilCmd.Color.Dim}({ctx.Sh.Msg("procs.fgJobDone")}){UtilCmd.Color.Reset}\n");
                ctx.Sh.FinishJob(job, "Done");
            }
            ctx.Sh.Proc.Jobs = ctx.Sh.Proc.Jobs.Where(j => !ReferenceEquals(j, job)).ToList();
            return 0;
        },
    };
}
