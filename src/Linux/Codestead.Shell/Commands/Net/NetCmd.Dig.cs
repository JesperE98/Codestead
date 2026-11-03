using static Codestead.Shell.NetworkLib;

namespace Codestead.Shell.Commands;

// The dig command: DNS lookup utility.

public static partial class NetCmd
{
    private static readonly string[] DigTypes = { "A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA", "PTR", "ANY" };

    private static string UtcString() =>
        DateTimeOffset.FromUnixTimeMilliseconds(Js.Now()).UtcDateTime.ToString("r", CultureInfo.InvariantCulture);

    private static readonly CommandDef Dig = new()
    {
        Name = "dig",
        Summary = "Frågar DNS om ett namn",
        SummaryEn = "DNS lookup utility",
        Man = """
            NAMN
                   dig - fråga en DNS-server

            SYNOPSIS
                   dig [@SERVER] NAMN [TYP] [+short]
                   dig -x IP-ADRESS

            BESKRIVNING
                   dig frågar DNS direkt och visar hela svaret. Den bryr sig inte om
                   /etc/hosts – för att se vad systemet slår upp, använd getent hosts.
                   dig finns i paketet dnsutils (Debian/Ubuntu), bind (Arch) eller
                   bind-utils (Fedora).

            FLAGGOR
                   +short     visa bara svaret (IP-adresserna)
                   @SERVER    fråga en viss DNS-server, t.ex. @1.1.1.1
                   TYP        A (IPv4, standard), AAAA (IPv6) ...
                   -x IP      omvänt uppslag: vilket namn har adressen?

            EXEMPEL
                   dig example.com
                   dig +short example.com
                   dig @8.8.8.8 debian.org AAAA
            """,
        ManEn = """
            NAME
                   dig - query a DNS server

            SYNOPSIS
                   dig [@SERVER] NAME [TYPE] [+short]
                   dig -x IP-ADDRESS

            DESCRIPTION
                   dig asks DNS directly and shows the whole answer. It ignores
                   /etc/hosts – to see what the system resolves, use getent hosts.
                   dig is in the package dnsutils (Debian/Ubuntu), bind (Arch) or
                   bind-utils (Fedora).

            OPTIONS
                   +short     show only the answer (the IP addresses)
                   @SERVER    ask a specific DNS server, e.g. @1.1.1.1
                   TYPE       A (IPv4, default), AAAA (IPv6) ...
                   -x IP      reverse lookup: which name does the address have?

            EXAMPLES
                   dig example.com
                   dig +short example.com
                   dig @8.8.8.8 debian.org AAAA
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            string? server = null;
            bool @short = false;
            var type = "A";
            string? name = null;
            bool reverse = false;
            var args = new List<string>(ctx.Args);
            string? Shift()
            {
                if (args.Count == 0) return null;
                var v = args[0];
                args.RemoveAt(0);
                return v;
            }
            while (args.Count > 0)
            {
                var a = Shift()!;
                if (a.StartsWith('@')) server = a[1..];
                else if (a == "+short") @short = true;
                else if (a.StartsWith('+')) continue;
                else if (a == "-x")
                {
                    reverse = true;
                    name = Shift();
                    type = "PTR";
                }
                else if (a == "-t") type = (Shift() ?? "A").ToUpperInvariant();
                else if (a.StartsWith('-'))
                {
                    ctx.Err($"Invalid option: {a}\nUsage:  dig [@global-server] [domain] [q-type] [q-class] {{q-opt}}\n");
                    return 1;
                }
                else if (name is not null && DigTypes.Contains(a.ToUpperInvariant())) type = a.ToUpperInvariant();
                else if (name is null) name = a;
            }
            if (name is null)
            {
                name = ".";
                type = "NS";
            }
            var qname = reverse && name != "" && IsIPv4(name) ? ReverseZone(name) : name;
            var srv = PickServer(ctx, server);
            var answer = srv is not null ? DnsQuery(sh, reverse ? "unused.invalid" : name, srv) : null;
            if (srv is null || answer is null)
            {
                var s = srv ?? server ?? "127.0.0.1";
                ctx.Out($";; communications error to {s}#53: timed out\n;; communications error to {s}#53: timed out\n;; communications error to {s}#53: timed out\n\n; <<>> DiG 9.20.13 <<>> {string.Join(" ", ctx.Args)}\n;; global options: +cmd\n;; no servers could be reached\n");
                return 9;
            }
            var status = answer.Status;
            var records = new List<string>();
            if (reverse)
            {
                var ptr = name != "" && IsIPv4(name) ? DnsReverse(name) : null;
                if (answer.Status != "SERVFAIL") status = ptr is not null ? "NOERROR" : "NXDOMAIN";
                if (ptr is not null) records = new List<string> { ptr + "." };
            }
            else if (type == "A") records = answer.A;
            else if (type == "AAAA") records = answer.Aaaa;
            else if (type == "ANY") records = answer.A.Concat(answer.Aaaa).ToList();
            if (@short)
            {
                foreach (var rec in records) ctx.Out(rec + "\n");
                return 0;
            }
            var fq = qname.EndsWith('.') ? qname : qname + ".";
            string RType(string rec) => reverse ? "PTR" : rec.Contains(':') ? "AAAA" : "A";
            var id = 10_000 + (int)((long)ByteLength(fq) * 7919 % 50_000);
            var @out =
                $"\n; <<>> DiG 9.20.13 <<>> {string.Join(" ", ctx.Args)}\n;; global options: +cmd\n;; Got answer:\n" +
                $";; ->>HEADER<<- opcode: QUERY, status: {status}, id: {id}\n" +
                $";; flags: qr rd ra; QUERY: 1, ANSWER: {records.Count}, AUTHORITY: {(records.Count != 0 || status == "SERVFAIL" ? 0 : 1)}, ADDITIONAL: 1\n\n" +
                $";; OPT PSEUDOSECTION:\n; EDNS: version: 0, flags:; udp: 65494\n;; QUESTION SECTION:\n;{fq}\t\t\tIN\t{type}\n\n";
            if (records.Count > 0)
            {
                @out += ";; ANSWER SECTION:\n";
                foreach (var rec in records) @out += $"{fq}\t\t{(reverse ? 3600 : 300)}\tIN\t{RType(rec)}\t{rec}\n";
                @out += "\n";
            }
            else if (status == "NXDOMAIN" || status == "NOERROR")
            {
                var zone = reverse ? "in-addr.arpa." : string.Join(".", Js.Slice<string>(fq.Split('.'), -2));
                if (zone == "") zone = ".";
                @out += $";; AUTHORITY SECTION:\n{zone}\t\t\t900\tIN\tSOA\ta.root-servers.net. nstld.verisign-grs.com. 2026103000 1800 900 604800 86400\n\n";
            }
            var time = srv == "127.0.0.53" && records.Count > 0 ? 0 : 8 + (id % 30);
            @out += $";; Query time: {time} msec\n;; SERVER: {srv}#53({srv}) (UDP)\n;; WHEN: {UtcString()}\n;; MSG SIZE  rcvd: {40 + fq.Length + records.Count * 16}\n\n";
            ctx.Out(@out);
            return 0;
        },
    };
}
