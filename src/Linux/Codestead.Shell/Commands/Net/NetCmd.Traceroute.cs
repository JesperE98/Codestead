using static Codestead.Shell.NetworkLib;

namespace Codestead.Shell.Commands;

// The traceroute command: print the route packets take to a host.

public static partial class NetCmd
{
    private static readonly CommandDef Traceroute = new()
    {
        Name = "traceroute",
        Summary = "Visar vägen (routrarna) paketen tar till en dator",
        SummaryEn = "Print the route packets take to a host",
        Man = """
            NAMN
                   traceroute - visa vägen till en dator

            SYNOPSIS
                   traceroute [-n] VÄRD

            BESKRIVNING
                   Visar varje router (hopp) på vägen och hur lång tid det tar att nå
                   den. Första hoppet är din gateway. "* * *" betyder att routern inte
                   svarar – det är vanligt och behöver inte vara ett fel.

            FLAGGOR
                   -n   visa bara IP-adresser

            EXEMPEL
                   traceroute example.com
            """,
        ManEn = """
            NAME
                   traceroute - print the route to a host

            SYNOPSIS
                   traceroute [-n] HOST

            DESCRIPTION
                   Shows every router (hop) along the way and how long it takes to
                   reach it. The first hop is your gateway. "* * *" means the router
                   does not answer – this is common and not necessarily an error.

            OPTIONS
                   -n   numeric output, IP addresses only

            EXAMPLES
                   traceroute example.com
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "nI46", Values = "mqw" });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var target = o.Operands.At(0);
            if (string.IsNullOrEmpty(target))
            {
                ctx.Err("Usage:\n  traceroute [ -46dFITnreAUDV ] [ -f first_ttl ] [ -m max_ttl ] host [ packetlen ]\n");
                return 2;
            }
            var resolved = ResolveHost(sh, target);
            if (resolved is not ResolvedOk r)
            {
                ctx.Err($"{target}: {ResolveErrorText(((ResolvedFail)resolved).Error)}\nCannot handle \"host\" cmdline arg `{target}' on position 1 (argc 1)\n");
                return 2;
            }
            var status = Reach(sh, r.Ip);
            if (status == "netunreach")
            {
                ctx.Err("connect: Network is unreachable\n");
                return 1;
            }
            var m = Js.Number(o.Values.Get("m") ?? "30");
            if (double.IsNaN(m) || m == 0) m = 30;
            var max = Math.Min(m, 30);
            ctx.Out($"traceroute to {target} ({r.Ip}), {Js.Num(max)} hops max, 60 byte packets\n");
            var path = Hops(sh, r.Ip);
            for (int i = 0; i < max; i++)
            {
                var hop = i < path.Count ? path[i] : null;
                var n = Js.Num(i + 1).PadLeft(2);
                if (hop is null || (status != "ok" && i == path.Count - 1 && hop == r.Ip))
                {
                    ctx.Out($"{n}  * * *\n");
                    if (status == "ok" && i >= path.Count) break;
                    continue;
                }
                var name = o.Flags.Contains("n") ? hop : $"{ReverseName(sh, hop) ?? hop} ({hop})";
                var @base = hop == r.Ip ? Rtt(sh, hop, 1) : 0.4 + i * 2.7;
                var t = string.Join("  ", new[] { 1, 2, 3 }.Select(k => $"{Js.ToFixed(@base + k * 0.031, 3)} ms"));
                ctx.Out($"{n}  {name}  {t}\n");
                if (hop == r.Ip) break;
            }
            return 0;
        },
    };
}
