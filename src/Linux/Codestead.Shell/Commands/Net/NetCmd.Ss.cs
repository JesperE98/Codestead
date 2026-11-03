using static Codestead.Shell.NetworkLib;

namespace Codestead.Shell.Commands;

// The ss command: show network sockets and listening ports.

public static partial class NetCmd
{
    private static readonly CommandDef Ss = new()
    {
        Name = "ss",
        Summary = "Visar nätverksanslutningar och lyssnande portar",
        SummaryEn = "Show network sockets and listening ports",
        Man = """
            NAMN
                   ss - visa sockets (nätverksanslutningar och portar)

            SYNOPSIS
                   ss [-tulpna]

            BESKRIVNING
                   ss ersätter det äldre netstat. Den vanligaste kombinationen är
                   "ss -tulpn": vilka program lyssnar på vilka portar?

            FLAGGOR
                   -t   TCP
                   -u   UDP
                   -l   bara lyssnande (listening) sockets
                   -p   visa vilken process som äger porten (alla processer kräver sudo)
                   -n   visa portnummer i stället för tjänstenamn (22 i stället för ssh)
                   -a   visa både lyssnande och anslutna

            EXEMPEL
                   ss -tulpn
                   sudo ss -tlpn
            """,
        ManEn = """
            NAME
                   ss - show sockets (network connections and ports)

            SYNOPSIS
                   ss [-tulpna]

            DESCRIPTION
                   ss replaces the older netstat. The most common combination is
                   "ss -tulpn": which programs are listening on which ports?

            OPTIONS
                   -t   TCP
                   -u   UDP
                   -l   listening sockets only
                   -p   show the process using the socket (all processes need sudo)
                   -n   numeric ports instead of service names (22 instead of ssh)
                   -a   show both listening and connected sockets

            EXAMPLES
                   ss -tulpn
                   sudo ss -tlpn
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "tulpnaH4",
                Long = new() { ["tcp"] = "t", ["udp"] = "u", ["listening"] = "l", ["processes"] = "p", ["numeric"] = "n", ["all"] = "a", ["no-header"] = "H" },
            });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var f = o.Flags;
            var wantTcp = f.Contains("t") || !f.Contains("u");
            var wantUdp = f.Contains("u") || !f.Contains("t");
            var listening = f.Contains("l") || f.Contains("a");
            var user = sh.CurrentUser();
            var rows = listening
                ? Listeners(sh).Where(l => (l.Proto == "tcp" ? wantTcp : wantUdp) && (!f.Contains("4") || !l.Addr.StartsWith('['))).ToList()
                : new List<Listener>();
            string Port(int n) => f.Contains("n") ? Js.Num(n) : (ServiceNames.GetValueOrDefault(n) ?? Js.Num(n));
            static string Peer(string addr) => addr.StartsWith('[') ? "[::]:*" : "0.0.0.0:*";
            bool hidden = false;
            var lines = rows.Select(l =>
            {
                var procCol = "";
                if (f.Contains("p"))
                {
                    if (user.Uid == 0 || l.Proc.User == user.Name) procCol = $"users:((\"{ProcsLib.ProcName(l.Proc)}\",pid={l.Proc.Pid},fd={l.Fd}))";
                    else hidden = true;
                }
                var state = l.Proto == "tcp" ? "LISTEN" : "UNCONN";
                var backlog = l.Proto == "tcp" ? (ProcsLib.ProcName(l.Proc) == "sshd" ? "128" : "4096") : "0";
                return $"{l.Proto.PadRight(6)}{state.PadRight(7)}0      {backlog.PadRight(7)}{$"{l.Addr}:{Port(l.Port)}".PadLeft(18)} {Peer(l.Addr).PadLeft(13)} {procCol}".TrimEnd();
            }).ToList();
            if (!f.Contains("H")) ctx.Out("Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process\n");
            foreach (var line in lines) ctx.Out(line + "\n");
            if (hidden && ctx.IsTTY)
            {
                Note(ctx, "net.ssProcessColumn");
            }
            if (!listening && ctx.IsTTY)
            {
                Note(ctx, "net.ssNoConnections");
            }
            return 0;
        },
    };
}
