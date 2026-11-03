using static Codestead.Shell.NetworkLib;

namespace Codestead.Shell.Commands;

// The host command: DNS lookup utility (short and simple).

public static partial class NetCmd
{
    private static readonly CommandDef Host = new()
    {
        Name = "host",
        Summary = "Slår upp ett namn eller en IP-adress i DNS",
        SummaryEn = "DNS lookup utility (short and simple)",
        Man = """
            NAMN
                   host - enkelt DNS-uppslag

            SYNOPSIS
                   host NAMN [SERVER]
                   host IP-ADRESS

            BESKRIVNING
                   Visar vilka adresser ett namn har – eller vilket namn en IP-adress
                   har (omvänt uppslag). Finns i samma paket som dig.

            EXEMPEL
                   host example.com
                   host 1.1.1.1
            """,
        ManEn = """
            NAME
                   host - simple DNS lookup

            SYNOPSIS
                   host NAME [SERVER]
                   host IP-ADDRESS

            DESCRIPTION
                   Shows which addresses a name has – or which name an IP address has
                   (reverse lookup). Comes in the same package as dig.

            EXAMPLES
                   host example.com
                   host 1.1.1.1
            """,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "av46", Values = "t" });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var name = o.Operands.At(0);
            var server = o.Operands.At(1);
            if (string.IsNullOrEmpty(name))
            {
                ctx.Err("Usage: host [-aCdilrTvVw] [-c class] [-N ndots] [-t type] [-W time]\n            [-R number] [-m flag] [-p port] hostname [server]\n");
                return 1;
            }
            var srv = PickServer(ctx, server);
            var answer = srv is not null ? DnsQuery(ctx.Sh, IsIPv4(name) ? "unused.invalid" : name, srv) : null;
            if (srv is null || answer is null)
            {
                ctx.Out($";; communications error to {srv ?? server ?? "undefined"}#53: timed out\n;; no servers could be reached\n");
                return 1;
            }
            if (!string.IsNullOrEmpty(server)) ctx.Out($"Using domain server:\nName: {server}\nAddress: {srv}#53\nAliases: \n\n");
            if (answer.Status == "SERVFAIL")
            {
                ctx.Out($"Host {name} not found: 2(SERVFAIL)\n");
                return 1;
            }
            if (IsIPv4(name))
            {
                var ptr = DnsReverse(name);
                if (ptr is null)
                {
                    ctx.Out($"Host {ReverseZone(name)} not found: 3(NXDOMAIN)\n");
                    return 1;
                }
                ctx.Out($"{ReverseZone(name)} domain name pointer {ptr}.\n");
                return 0;
            }
            if (answer.Status == "NXDOMAIN")
            {
                ctx.Out($"Host {name} not found: 3(NXDOMAIN)\n");
                return 1;
            }
            var t = o.Values.Get("t")?.ToUpperInvariant();
            if (string.IsNullOrEmpty(t) || t == "A") foreach (var a in answer.A) ctx.Out($"{name} has address {a}\n");
            if (string.IsNullOrEmpty(t) || t == "AAAA") foreach (var a in answer.Aaaa) ctx.Out($"{name} has IPv6 address {a}\n");
            if (!string.IsNullOrEmpty(t) && t != "A" && t != "AAAA") ctx.Out($"{name} has no {t} record\n");
            return 0;
        },
    };
}
