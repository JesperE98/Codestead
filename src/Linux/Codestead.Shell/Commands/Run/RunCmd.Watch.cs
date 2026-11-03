namespace Codestead.Shell.Commands;

// The watch command: run a command repeatedly and show its output.

public static partial class RunCmd
{
    private static readonly CommandDef Watch = new()
    {
        Name = "watch",
        Summary = "Kör ett kommando om och om igen och visar resultatet",
        SummaryEn = "Run a command repeatedly and show its output",
        Man = """
            NAMN
                   watch - kör ett kommando om och om igen

            SYNOPSIS
                   watch [-n SEKUNDER] [-d] KOMMANDO

            BESKRIVNING
                   Kör KOMMANDO varannan sekund och visar resultatet på en ren
                   skärm, så att du kan se hur det förändras. Avsluta med Ctrl+C.

                   I simulatorn visas resultatet en gång.

            FLAGGOR
                   -n SEK   kör var SEK:e sekund i stället för varannan
                   -d       markera det som ändrats sedan förra gången
                   -t       visa inte rubrikraden

            EXEMPEL
                   watch df -h
                   watch -n 5 'ls -l /var/log'
            """,
        ManEn = """
            NAME
                   watch - run a command over and over again

            SYNOPSIS
                   watch [-n SECONDS] [-d] COMMAND

            DESCRIPTION
                   Runs COMMAND every two seconds and shows the result on a clean
                   screen, so you can see how it changes. Exit with Ctrl+C.

                   In the simulator the result is shown once.

            OPTIONS
                   -n SEC   run every SEC seconds instead of every two
                   -d       highlight what changed since last time
                   -t       do not show the header line

            EXAMPLES
                   watch df -h
                   watch -n 5 'ls -l /var/log'
            """,
        Run = ctx =>
        {
            var args = ctx.Args.ToList();
            double interval = 2;
            bool title = true;
            while (args.Count > 0 && args[0].StartsWith('-') && args[0].Length > 1)
            {
                var a = args[0];
                args.RemoveAt(0);
                if (a == "--") break;
                if (a == "-n" || a == "--interval")
                {
                    if (args.Count == 0) return UtilCmd.BadOption(ctx, "option requires an argument -- 'n'");
                    interval = Js.Number(args[0]);
                    args.RemoveAt(0);
                }
                else if (a.StartsWith("-n", StringComparison.Ordinal)) interval = Js.Number(a[2..]);
                else if (a == "-t" || a == "--no-title") title = false;
                else if (a != "-d" && a != "--differences" && a != "-c" && a != "--color") return UtilCmd.BadOption(ctx, $"invalid option -- '{a.TrimStart('-')}'");
            }
            if (args.Count == 0)
            {
                ctx.Err("\nUsage:\n watch [options] command\n");
                return 1;
            }
            if (double.IsNaN(interval) || interval < 0.1) interval = 0.1;
            var sh = ctx.Sh;
            var line = string.Join(" ", args);
            if (title)
            {
                var head = $"Every {interval.ToString("0.0", CultureInfo.InvariantCulture)}s: {line}";
                var right = $"{sh.Distro.Hostname}: {Js.LocalNow().ToString("ddd MMM d HH:mm:ss yyyy", CultureInfo.InvariantCulture)}";
                ctx.Out($"{head}{new string(' ', Math.Max(2, 80 - head.Length - right.Length))}{right}\n\n");
            }
            var output = new StringBuilder();
            var io = new IO(s => output.Append(s), s => output.Append(s), null, false);
            sh.RunScript(line, "sh", new List<string>(), io);
            ctx.Out(output.ToString());
            ctx.Out($"{UtilCmd.Color.Dim}{sh.Msg("run.watchOnce", ("seconds", Js.Num(interval)))}{UtilCmd.Color.Reset}\n");
            return 0;
        },
    };
}
