namespace Codestead.Shell.Commands;

// The htop command: shows processes and resource usage.

public static partial class ExtrasCmd
{
    /// <summary>Math.round in JavaScript (halves round up).</summary>
    private static double JsRound(double v) => Math.Floor(v + 0.5);

    private static readonly CommandDef Htop = new()
    {
        Name = "htop",
        Summary = "Visar processer och resursanvändning",
        Man = """
NAMN
       htop - interaktiv processvisare

BESKRIVNING
       Visar CPU, minne och alla processer som körs. I en riktig terminal
       sorterar du med F6, söker med F3, avslutar processer med F9 och
       stänger htop med q eller F10. I simulatorn visas en ögonblicksbild.
""",
        Run = ctx =>
        {
            var procs = ProcsCmd.CurrentProcs(ctx, "htop").ToList().StableSort((a, b) =>
            {
                double d = b.Cpu - a.Cpu;
                if (d != 0) return d < 0 ? -1 : 1;
                return a.Pid - b.Pid;
            });
            double load = procs.Sum(p => p.Cpu);
            string Bar(double pct) =>
                $"[{UtilCmd.Color.Green}{"|".Repeat((int)JsRound(Math.Min(pct, 100) / 4)).PadRight(25)}{UtilCmd.Color.Reset}{Js.ToFixed(pct, 1).PadLeft(5)}%]";
            string Mb(long kb) => kb >= 1024 ? $"{Js.ToFixed(kb / 1024.0, 1)}M" : $"{Js.Num(kb)}K";
            ctx.Out(
                $"    0{Bar(Math.Min(100, load))}   Tasks: {procs.Count}, 1 running\n" +
                $"    1{Bar(3.2)}   Load average: {Js.ToFixed(load / 100, 2)} {Js.ToFixed(load / 100 * 0.9, 2)} {Js.ToFixed(load / 100 * 0.8, 2)}\n" +
                $"  Mem[{UtilCmd.Color.Green}||||||||||||             {UtilCmd.Color.Reset}1.84G/7.70G]   Uptime: 02:14:07\n" +
                "  Swp[                             0K/2.00G]\n\n" +
                $"\x1b[30;42m    PID USER       PRI  NI  VIRT   RES S CPU% MEM%   TIME+  Command              {UtilCmd.Color.Reset}\n");
            foreach (var p in procs)
            {
                ctx.Out(
                    $"{Js.Num(p.Pid).PadLeft(7)} {p.User.Slice(0, 9).PadRight(10)} 20   0 {Mb(p.Vsz).PadLeft(5)} {Mb(p.Rss).PadLeft(5)} {p.Stat.CharAt(0)} {Js.ToFixed(p.Cpu, 1).PadLeft(4)} {Js.ToFixed(p.Mem, 1).PadLeft(4)} {(p.Time + ".00").PadLeft(8)} {p.Cmd}\n");
            }
            ctx.Out("\nF1Help  F2Setup  F3Search  F4Filter  F5Tree  F6SortBy  F7Nice-  F8Nice+  F9Kill  F10Quit\n");
            Note(ctx, ctx.Sh.Msg("extras.htopSnapshot"));
            return 0;
        },
    };
}
