namespace Codestead.Shell.Commands;

// The wait command: waits until the background jobs are done.

public static partial class ProcsCmd
{
    private static readonly CommandDef Wait = new()
    {
        Name = "wait",
        Builtin = true,
        Summary = "Väntar tills bakgrundsjobben är klara",
        Man = """
            NAMN
                   wait - vänta på att bakgrundsjobb blir klara

            BESKRIVNING
                   Används i skript som startar flera saker parallellt med & och
                   sedan behöver vänta in dem. I simulatorn blir jobben klara direkt.
            """,
        Run = ctx =>
        {
            foreach (var job in ctx.Sh.Proc.Jobs.ToList()) if (job.State == "Running") ctx.Sh.FinishJob(job, "Done");
            ctx.Sh.Proc.Jobs = new List<Job>();
            return 0;
        },
    };
}
