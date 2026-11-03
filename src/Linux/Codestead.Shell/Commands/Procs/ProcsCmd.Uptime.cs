namespace Codestead.Shell.Commands;

// The uptime command: shows how long the computer has been running, and the load.

public static partial class ProcsCmd
{
    private static readonly CommandDef Uptime = new()
    {
        Name = "uptime",
        Summary = "Visar hur länge datorn varit igång och belastningen",
        Man = """
            NAMN
                   uptime - visa hur länge systemet varit igång

            BESKRIVNING
                   Load average är det genomsnittliga antalet processer som vill ha
                   processorn under senaste 1, 5 och 15 minuterna.
            """,
        Run = ctx =>
        {
            var load = Snapshot(ctx).Aggregate(0.0, (s, p) => s + p.Cpu) / 100;
            ctx.Out($" {TimeString(8)} up  2:14,  1 user,  load average: {Js.ToFixed(load, 2)}, {Js.ToFixed(load * 0.9, 2)}, {Js.ToFixed(load * 0.8, 2)}\n");
            return 0;
        },
    };
}
