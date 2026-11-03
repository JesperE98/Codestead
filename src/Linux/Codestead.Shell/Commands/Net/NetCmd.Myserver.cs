using static Codestead.Shell.NetworkLib;

namespace Codestead.Shell.Commands;

// The myserver command: start the practice server (a tiny web server).

public static partial class NetCmd
{
    private static readonly CommandDef Myserver = new()
    {
        Name = "myserver",
        Summary = "Startar övningsservern (en liten webbserver)",
        SummaryEn = "Start the practice server (a tiny web server)",
        Man = """
            NAMN
                   myserver - en liten webbserver att öva på

            SYNOPSIS
                   myserver [--port PORT]

            BESKRIVNING
                   Startar en webbserver som körs i bakgrunden (som en tjänst) och
                   lyssnar på port 8080. Prova "curl http://localhost:8080" och
                   "ss -tlpn". Portar under 1024 kräver root.

            EXEMPEL
                   myserver
                   myserver --port 9090
                   pkill myserver
            """,
        ManEn = """
            NAME
                   myserver - a tiny web server to practise with

            SYNOPSIS
                   myserver [--port PORT]

            DESCRIPTION
                   Starts a web server that runs in the background (as a service) and
                   listens on port 8080. Try "curl http://localhost:8080" and
                   "ss -tlpn". Ports below 1024 require root.

            EXAMPLES
                   myserver
                   myserver --port 9090
                   pkill myserver
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Values = "p", Long = new() { ["port"] = "p" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var portNum = o.Values.TryGetValue("p", out var pv) ? Js.Number(pv) : 8080;
            if (!IsInteger(portNum) || portNum < 1 || portNum > 65535)
            {
                ctx.Err($"myserver: invalid port '{pv}'\n");
                return 2;
            }
            var port = (int)portNum;
            if (Listeners(sh).Any(l => l.Proto == "tcp" && l.Port == port))
            {
                ctx.Err($"myserver: bind 0.0.0.0:{port}: Address already in use\n");
                return 1;
            }
            if (port < 1024 && !IsRoot(ctx))
            {
                ctx.Err($"myserver: bind 0.0.0.0:{port}: Permission denied\n");
                return 1;
            }
            var pid = sh.Proc.NextPid++;
            sh.Proc.Procs.Add(new Proc
            {
                Pid = pid,
                Ppid = 1,
                User = sh.CurrentUser().Name,
                Cmd = $"/usr/local/bin/myserver --port {port}",
                Cpu = 0.3,
                Mem = 1.2,
                Vsz = 182_340,
                Rss = 24_116,
                Tty = "?",
                Stat = "Ssl",
                Start = Js.LocalNow().ToString("HH:mm", CultureInfo.InvariantCulture),
                Time = "0:00",
            });
            ctx.Out($"myserver 1.0: listening on http://0.0.0.0:{port}/ (pid {pid})\n");
            if (ctx.IsTTY)
            {
                Note(ctx, "net.myserverBackground", ("port", port));
            }
            return 0;
        },
    };
}
