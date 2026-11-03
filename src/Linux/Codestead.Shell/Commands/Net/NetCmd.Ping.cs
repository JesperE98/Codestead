using static Codestead.Shell.NetworkLib;

namespace Codestead.Shell.Commands;

// The ping command: send test packets to a host and wait for replies.

public static partial class NetCmd
{
    private static string Ms(double n) => Js.ToFixed(n, n < 1 ? 3 : n < 10 ? 2 : 1);

    /// <summary>Math.round</summary>
    private static double Round(double x) => Math.Floor(x + 0.5);

    private static readonly CommandDef Ping = new()
    {
        Name = "ping",
        Summary = "Skickar testpaket till en dator och väntar på svar",
        SummaryEn = "Send test packets to a host and wait for replies",
        Man = """
            NAMN
                   ping - kontrollera om en dator går att nå

            SYNOPSIS
                   ping [-c ANTAL] [-q] VÄRD

            BESKRIVNING
                   Skickar ICMP "echo request"-paket och visar svaren och hur lång tid
                   de tog (time=... ms). Utan -c fortsätter ping tills du trycker
                   Ctrl+C. Sist visas en sammanfattning med hur många paket som
                   försvann (packet loss).

            FLAGGOR
                   -c ANTAL   skicka bara ANTAL paket
                   -q         visa bara sammanfattningen
                   -n         visa bara IP-adresser, inga namn

            EXEMPEL
                   ping -c 3 192.168.1.1
                   ping -c 4 example.com
            """,
        ManEn = """
            NAME
                   ping - check whether a host can be reached

            SYNOPSIS
                   ping [-c COUNT] [-q] HOST

            DESCRIPTION
                   Sends ICMP "echo request" packets and shows the replies and how long
                   they took (time=... ms). Without -c, ping keeps going until you press
                   Ctrl+C. Finally a summary shows how many packets were lost.

            OPTIONS
                   -c COUNT   send only COUNT packets
                   -q         quiet, show only the summary
                   -n         numeric output, no names

            EXAMPLES
                   ping -c 3 192.168.1.1
                   ping -c 4 example.com
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "qn46vOD", Values = "ciWswtI" });
            if (o.Error is not null)
            {
                ctx.Err($"ping: {o.Error}\n");
                return 2;
            }
            var target = o.Operands.At(0);
            if (string.IsNullOrEmpty(target))
            {
                ctx.Err("ping: usage error: Destination address required\n");
                return 1;
            }
            int count = 4;
            var limited = o.Values.ContainsKey("c");
            if (limited)
            {
                var c = Js.Number(o.Values["c"]);
                if (!IsInteger(c) || c < 1)
                {
                    ctx.Err($"ping: invalid argument: '{o.Values["c"]}': out of range: 1 <= value <= 9223372036854775807\n");
                    return 1;
                }
                count = (int)Math.Min(c, 1000);
            }
            var resolved = ResolveHost(sh, target);
            if (resolved is not ResolvedOk r)
            {
                ctx.Err($"ping: {target}: {ResolveErrorText(((ResolvedFail)resolved).Error)}\n");
                return 2;
            }
            var dest = r.Ip == "0.0.0.0" ? "127.0.0.1" : r.Ip;
            var status = Reach(sh, dest);
            if (status == "netunreach")
            {
                ctx.Err("ping: connect: Network is unreachable\n");
                return 2;
            }
            var numeric = o.Flags.Contains("n") || r.Source == "literal";
            var from = numeric ? dest : $"{ReverseName(sh, dest) ?? target} ({dest})";
            ctx.Out($"PING {target} ({dest}) 56(84) bytes of data.\n");
            var times = new List<double>();
            int errors = 0;
            for (int seq = 1; seq <= count; seq++)
            {
                if (status == "ok")
                {
                    var t = Rtt(sh, dest, seq);
                    times.Add(t);
                    if (!o.Flags.Contains("q")) ctx.Out($"64 bytes from {from}: icmp_seq={seq} ttl={Ttl(sh, dest)} time={Ms(t)} ms\n");
                }
                else if (status == "hostunreach")
                {
                    errors++;
                    if (!o.Flags.Contains("q")) ctx.Out($"From {MyIp(sh)} icmp_seq={seq} Destination Host Unreachable\n");
                }
            }
            if (!limited) ctx.Out("^C\n");
            var elapsed = count == 1 ? 0 : (count - 1) * 1000 + Round(times.Sum() / count) + (status == "ok" ? 2 : 40);
            var loss = Round((double)(count - times.Count) / count * 100);
            ctx.Out(
                $"\n--- {target} ping statistics ---\n" +
                $"{count} packets transmitted, {times.Count} received, {(errors != 0 ? $"+{errors} errors, " : "")}{Js.Num(loss)}% packet loss, time {Js.Num(elapsed)}ms\n");
            if (times.Count > 0)
            {
                var min = times.Min();
                var max = times.Max();
                var avg = times.Sum() / times.Count;
                var mdev = Math.Sqrt(times.Sum(b => Math.Pow(b - avg, 2)) / times.Count);
                ctx.Out($"rtt min/avg/max/mdev = {string.Join("/", new[] { min, avg, max, mdev }.Select(x => Js.ToFixed(x, 3)))} ms\n");
            }
            else if (errors != 0)
            {
                ctx.Out($"pipe {Math.Min(count, 4)}\n");
            }
            if (!limited && ctx.IsTTY)
            {
                Note(ctx, "net.pingCtrlC");
            }
            return times.Count > 0 ? 0 : 1;
        },
    };
}
