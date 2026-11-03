namespace Codestead.Shell.Commands;

// The bg command: resumes a stopped job in the background.

public static partial class ProcsCmd
{
    private static readonly CommandDef Bg = new()
    {
        Name = "bg",
        Builtin = true,
        Summary = "Fortsätter ett stoppat jobb i bakgrunden",
        Man = """
            NAMN
                   bg - låt ett stoppat jobb fortsätta i bakgrunden

            SYNOPSIS
                   bg [%JOBB]

            BESKRIVNING
                   Används efter att ett program stoppats med Ctrl+Z.
            """,
        Run = ctx =>
        {
            var job = PickJob(ctx);
            if (job is null) return 1;
            ctx.Err($"bash: bg: job {job.Id} already in background\n");
            return 0;
        },
    };
}
