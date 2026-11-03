using static Codestead.Shell.NetworkLib;

namespace Codestead.Shell.Commands;

// The nslookup command: query DNS name servers (older tool).

public static partial class NetCmd
{
    private static readonly CommandDef Nslookup = new()
    {
        Name = "nslookup",
        Summary = "Slår upp ett namn i DNS (äldre verktyg)",
        SummaryEn = "Query DNS name servers (older tool)",
        Man = """
            NAMN
                   nslookup - fråga DNS (finns även i Windows)

            SYNOPSIS
                   nslookup NAMN [SERVER]

            BESKRIVNING
                   Ett äldre verktyg som finns på nästan alla system, även Windows och
                   macOS. "Non-authoritative answer" betyder att svaret kommer från en
                   mellanlagrad kopia och inte direkt från domänens egen DNS-server.

            EXEMPEL
                   nslookup example.com
                   nslookup archlinux.org 1.1.1.1
            """,
        ManEn = """
            NAME
                   nslookup - query DNS (also exists on Windows)

            SYNOPSIS
                   nslookup NAME [SERVER]

            DESCRIPTION
                   An older tool found on almost every system, including Windows and
                   macOS. "Non-authoritative answer" means the answer came from a cached
                   copy and not directly from the domain's own DNS server.

            EXAMPLES
                   nslookup example.com
                   nslookup archlinux.org 1.1.1.1
            """,
        Run = ctx =>
        {
            var words = ctx.Args.Where(a => !a.StartsWith('-')).ToList();
            var name = words.At(0);
            var server = words.At(1);
            if (string.IsNullOrEmpty(name))
            {
                ctx.Err($"{UtilCmd.Color.Dim}{ctx.Sh.Msg("net.nslookupInteractive")}{UtilCmd.Color.Reset}\n");
                return 1;
            }
            var srv = PickServer(ctx, server);
            var answer = srv is not null ? DnsQuery(ctx.Sh, IsIPv4(name) ? "unused.invalid" : name, srv) : null;
            if (srv is null || answer is null)
            {
                ctx.Out($";; communications error to {srv ?? server ?? "undefined"}#53: timed out\n;; no servers could be reached\n\n");
                return 1;
            }
            ctx.Out($"Server:\t\t{srv}\nAddress:\t{srv}#53\n\n");
            if (answer.Status == "SERVFAIL")
            {
                ctx.Out($"** server can't find {name}: SERVFAIL\n\n");
                return 1;
            }
            if (IsIPv4(name))
            {
                var ptr = DnsReverse(name);
                if (ptr is null)
                {
                    ctx.Out($"** server can't find {ReverseZone(name)}: NXDOMAIN\n\n");
                    return 1;
                }
                ctx.Out($"Non-authoritative answer:\n{ReverseZone(name)}\tname = {ptr}.\n\nAuthoritative answers can be found from:\n\n");
                return 0;
            }
            if (answer.Status == "NXDOMAIN")
            {
                ctx.Out($"** server can't find {name}: NXDOMAIN\n\n");
                return 1;
            }
            ctx.Out("Non-authoritative answer:\n");
            foreach (var a in answer.A) ctx.Out($"Name:\t{name}\nAddress: {a}\n");
            foreach (var a in answer.Aaaa) ctx.Out($"Name:\t{name}\nAddress: {a}\n");
            ctx.Out("\n");
            return 0;
        },
    };
}
