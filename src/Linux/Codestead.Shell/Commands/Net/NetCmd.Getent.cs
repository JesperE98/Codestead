using static Codestead.Shell.NetworkLib;

namespace Codestead.Shell.Commands;

// The getent command: get entries from system databases (hosts, passwd, group).

public static partial class NetCmd
{
    private static readonly CommandDef Getent = new()
    {
        Name = "getent",
        Summary = "Slår upp i systemets databaser (hosts, passwd, group)",
        SummaryEn = "Get entries from system databases (hosts, passwd, group)",
        Man = """
            NAMN
                   getent - slå upp i systemets databaser

            SYNOPSIS
                   getent DATABAS [NYCKEL...]

            BESKRIVNING
                   Frågar på samma sätt som vanliga program gör. "getent hosts NAMN"
                   visar vilken adress systemet använder för ett namn – först från
                   /etc/hosts och sedan från DNS.

            DATABASER
                   hosts     värdnamn och IP-adresser
                   passwd    användare (/etc/passwd)
                   group     grupper (/etc/group)

            EXEMPEL
                   getent hosts example.com
                   getent hosts localhost
                   getent passwd $USER
            """,
        ManEn = """
            NAME
                   getent - get entries from system databases

            SYNOPSIS
                   getent DATABASE [KEY...]

            DESCRIPTION
                   Looks things up the same way ordinary programs do. "getent hosts
                   NAME" shows which address the system uses for a name – first from
                   /etc/hosts and then from DNS.

            DATABASES
                   hosts     host names and IP addresses
                   passwd    users (/etc/passwd)
                   group     groups (/etc/group)

            EXAMPLES
                   getent hosts example.com
                   getent hosts localhost
                   getent passwd $USER
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var db = ctx.Args.At(0);
            var keys = ctx.Args.Skip(1).ToList();
            if (string.IsNullOrEmpty(db))
            {
                ctx.Err("Usage: getent [OPTION...] database [key ...]\nTry `getent --help' or `getent --usage' for more information.\n");
                return 1;
            }
            if (db == "hosts" || db == "ahosts")
            {
                if (keys.Count == 0)
                {
                    foreach (var e in HostsEntries(sh)) ctx.Out($"{e.Ip.PadRight(15)} {string.Join(" ", e.Names)}\n");
                    return 0;
                }
                int code = 0;
                foreach (var k in keys)
                {
                    if (ResolveHost(sh, k) is not ResolvedOk r)
                    {
                        code = 2;
                        continue;
                    }
                    var entry = HostsEntries(sh).Where(e => e.Ip == r.Ip && e.Names.Any(n => n.ToLowerInvariant() == k.ToLowerInvariant())).ToList();
                    ctx.Out($"{r.Ip.PadRight(15)} {(entry.Count > 0 ? string.Join(" ", entry[0].Names) : k)}\n");
                }
                return code;
            }
            if (db == "passwd" || db == "group")
            {
                var lines = (ReadSystemFile(sh, $"/etc/{db}") ?? "").Split('\n').Where(l => l != "").ToList();
                if (keys.Count == 0)
                {
                    foreach (var l in lines) ctx.Out(l + "\n");
                    return 0;
                }
                int code = 0;
                foreach (var k in keys)
                {
                    var line = lines.FirstOrDefault(l => l.Split(':')[0] == k || l.Split(':').ElementAtOrDefault(2) == k);
                    if (line is not null) ctx.Out(line + "\n");
                    else code = 2;
                }
                return code;
            }
            ctx.Err($"Unknown database: {db}\nTry `getent --help' or `getent --usage' for more information.\n");
            return 1;
        },
    };
}
