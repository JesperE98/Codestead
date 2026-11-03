namespace Codestead.Shell.Commands;

// The jobs command: shows the background jobs in this terminal.

public static partial class ProcsCmd
{
    private static string JobLine(Job job, bool last, bool @long)
    {
        var state = job.State == "Running" ? "Running" : job.State;
        return $"[{job.Id}]{(last ? "+" : "-")}  {(@long ? job.Pid + " " : "")}{state.PadRight(24)}{job.Cmd}{(job.State == "Running" ? " &" : "")}\n";
    }

    private static readonly CommandDef Jobs = new()
    {
        Name = "jobs",
        Builtin = true,
        Summary = "Visar bakgrundsjobb i den här terminalen",
        Man = """
            NAMN
                   jobs - visa jobb som startats från den här terminalen

            SYNOPSIS
                   jobs [-l]

            BESKRIVNING
                   Ett jobb startas i bakgrunden genom att skriva & efter kommandot,
                   t.ex. "sleep 300 &". Jobben numreras [1], [2] ... och kan anges som
                   %1, %2 till kill, fg och bg.

            FLAGGOR
                   -l    visa även PID
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            sh.RefreshJobs();
            var list = sh.Proc.Jobs;
            for (int i = 0; i < list.Count; i++) ctx.Out(JobLine(list[i], i == list.Count - 1, ctx.Args.Contains("-l")));
            return 0;
        },
    };
}
