using static Codestead.Shell.NetworkLib;

namespace Codestead.Shell.Commands;

// Port of src/shell/commands/net.ts – network commands: ip, ping, ss, dig, host, nslookup, getent,
// traceroute, curl, wget and the practice server myserver. The network itself is in ../Network.cs.

public static partial class NetCmd
{
    private static void Note(CmdCtx ctx, string key, params (string Name, object? Value)[] args) =>
        ctx.Err($"{UtilCmd.Color.Dim}{ctx.Sh.Msg(key, args)}{UtilCmd.Color.Reset}\n");

    private static bool IsRoot(CmdCtx ctx) => ctx.Sh.CurrentUser().Uid == 0;

    private static string Ms(double n) => Js.ToFixed(n, n < 1 ? 3 : n < 10 ? 2 : 1);

    /// <summary>Math.round</summary>
    private static double Round(double x) => Math.Floor(x + 0.5);

    private static bool IsInteger(double n) => !double.IsNaN(n) && !double.IsInfinity(n) && n == Math.Floor(n);

    // ---------- ip ----------

    private static readonly string[] IpObjects = { "address", "route", "link", "neighbour", "neighbor", "help" };

    private static int IpAddr(CmdCtx ctx, bool brief, bool only4, string? dev)
    {
        var list = Interfaces(ctx.Sh).Where(i => string.IsNullOrEmpty(dev) || i.Name == dev).ToList();
        if (!string.IsNullOrEmpty(dev) && list.Count == 0)
        {
            ctx.Err($"Device \"{dev}\" does not exist.\n");
            return 1;
        }
        foreach (var i in list)
        {
            if (brief)
            {
                var addrs = i.Inet.Select(a => $"{a.Addr}/{a.Prefix}").ToList();
                if (!only4) addrs.AddRange(i.Inet6.Select(a => $"{a.Addr}/{a.Prefix}"));
                ctx.Out($"{i.Name.PadRight(16)} {i.State.PadRight(14)} {string.Join(" ", addrs)} \n");
                continue;
            }
            ctx.Out($"{i.Index}: {i.Name}: <{i.Flags}> mtu {i.Mtu} qdisc {i.Qdisc} state {i.State} group default qlen 1000\n");
            if (!only4) ctx.Out($"    link/{i.LinkType} {i.Mac} brd {i.Brd}\n");
            foreach (var a in i.Inet)
            {
                ctx.Out($"    inet {a.Addr}/{a.Prefix}{(!string.IsNullOrEmpty(a.Brd) ? $" brd {a.Brd}" : "")} scope {a.Scope}{(a.Extra != "" ? " " + a.Extra : "")} {i.Name}\n");
                ctx.Out($"       valid_lft {a.Lft} preferred_lft {a.Lft}\n");
            }
            if (only4) continue;
            foreach (var a in i.Inet6)
            {
                ctx.Out($"    inet6 {a.Addr}/{a.Prefix} scope {a.Scope} {a.Extra} \n");
                ctx.Out("       valid_lft forever preferred_lft forever\n");
            }
        }
        return 0;
    }

    private static int IpLink(CmdCtx ctx, bool brief, List<string> args)
    {
        var sh = ctx.Sh;
        var cmd = args.Count > 0 ? args[0] : "show";
        var words = args.Skip(1).Where(w => w != "dev").ToList();
        if (cmd == "set")
        {
            var setDev = words.At(0);
            var state = words.At(1);
            if (string.IsNullOrEmpty(setDev) || !Interfaces(sh).Any(i => i.Name == setDev))
            {
                ctx.Err(!string.IsNullOrEmpty(setDev) ? $"Cannot find device \"{setDev}\"\n" : "Not enough information: \"dev\" argument is required.\n");
                return 1;
            }
            if (state != "up" && state != "down")
            {
                ctx.Err($"Error: either \"dev\" is duplicate, or \"{state ?? ""}\" is a garbage.\n");
                return 255;
            }
            if (!IsRoot(ctx))
            {
                ctx.Err("RTNETLINK answers: Operation not permitted\n");
                return 2;
            }
            if (setDev == NetworkLib.Iface) SetLinkUp(sh, state == "up");
            return 0;
        }
        if (cmd != "show" && cmd != "list" && cmd != "ls")
        {
            ctx.Err($"Command \"{cmd}\" is unknown, try \"ip link help\".\n");
            return 255;
        }
        var dev = words.At(0);
        var list = Interfaces(sh).Where(i => string.IsNullOrEmpty(dev) || i.Name == dev).ToList();
        if (!string.IsNullOrEmpty(dev) && list.Count == 0)
        {
            ctx.Err($"Device \"{dev}\" does not exist.\n");
            return 1;
        }
        foreach (var i in list)
        {
            if (brief)
            {
                ctx.Out($"{i.Name.PadRight(16)} {i.State.PadRight(14)} {i.Mac} <{i.Flags}> \n");
                continue;
            }
            ctx.Out($"{i.Index}: {i.Name}: <{i.Flags}> mtu {i.Mtu} qdisc {i.Qdisc} state {i.State} mode DEFAULT group default qlen 1000\n");
            ctx.Out($"    link/{i.LinkType} {i.Mac} brd {i.Brd}\n");
        }
        return 0;
    }

    private static int IpRoute(CmdCtx ctx, List<string> args)
    {
        var sh = ctx.Sh;
        var cmd = args.Count > 0 ? args[0] : "show";
        var target = args.At(1);
        if (cmd == "show" || cmd == "list" || cmd == "ls")
        {
            foreach (var r in Routes(sh)) ctx.Out(r + " \n");
            return 0;
        }
        if (cmd == "get")
        {
            if (string.IsNullOrEmpty(target) || !IsIPv4(target))
            {
                ctx.Err($"Error: inet prefix is expected rather than \"{target ?? ""}\".\n");
                return 1;
            }
            var uid = sh.CurrentUser().Uid;
            if (target.StartsWith("127.", StringComparison.Ordinal) || target == MyIp(sh))
            {
                ctx.Out($"local {target} dev lo src {(target.StartsWith("127.", StringComparison.Ordinal) ? "127.0.0.1" : target)} uid {uid} \n    cache <local> \n");
                return 0;
            }
            if (!LinkUp(sh))
            {
                ctx.Err("RTNETLINK answers: Network is unreachable\n");
                return 2;
            }
            var via = target.StartsWith("192.168.1.", StringComparison.Ordinal) ? "" : $"via {Gateway} ";
            ctx.Out($"{target} {via}dev {NetworkLib.Iface} src {MyIp(sh)} uid {uid} \n    cache \n");
            return 0;
        }
        if (new[] { "add", "del", "delete", "change", "replace", "flush" }.Contains(cmd))
        {
            if (!IsRoot(ctx))
            {
                ctx.Err("RTNETLINK answers: Operation not permitted\n");
                return 2;
            }
            Note(ctx, "net.routeChangeUnsupported");
            return 1;
        }
        ctx.Err($"Command \"{cmd}\" is unknown, try \"ip route help\".\n");
        return 255;
    }

    private static readonly CommandDef Ip = new()
    {
        Name = "ip",
        Summary = "Visar och ändrar nätverksgränssnitt, adresser och rutter",
        SummaryEn = "Show and manipulate network interfaces, addresses and routes",
        Man = """
            NAMN
                   ip - visa och ändra nätverksinställningar

            SYNOPSIS
                   ip [-br] [-4] OBJEKT [KOMMANDO]

            BESKRIVNING
                   ip kommer från paketet iproute2 (iproute i Fedora) och har ersatt
                   de gamla kommandona ifconfig och route. Objektet kan förkortas.

            OBJEKT
                   address (a)    IP-adresser på gränssnitten
                   link (l)       gränssnitten själva (nätverkskorten)
                   route (r)      routingtabellen – bl.a. standard-gatewayen
                   neigh (n)      grannar i det lokala nätet (ARP-tabellen)

            FLAGGOR
                   -br      kort format, en rad per gränssnitt
                   -4       bara IPv4

            EXEMPEL
                   ip a                        visa alla adresser
                   ip -br a                    kort översikt
                   ip route                    visa rutter och gateway
                   ip route get 1.1.1.1        vilken väg tar paketen dit?
                   sudo ip link set enp0s3 down   stäng av nätverkskortet
                   sudo ip link set enp0s3 up     sätt på det igen
            """,
        ManEn = """
            NAME
                   ip - show and manipulate network settings

            SYNOPSIS
                   ip [-br] [-4] OBJECT [COMMAND]

            DESCRIPTION
                   ip comes from the iproute2 package (iproute on Fedora) and replaces
                   the old ifconfig and route commands. Objects may be abbreviated.

            OBJECTS
                   address (a)    IP addresses on the interfaces
                   link (l)       the interfaces themselves (network cards)
                   route (r)      the routing table – including the default gateway
                   neigh (n)      neighbours on the local network (ARP table)

            OPTIONS
                   -br      brief output, one line per interface
                   -4       IPv4 only

            EXAMPLES
                   ip a                        show all addresses
                   ip -br a                    short overview
                   ip route                    show routes and the gateway
                   ip route get 1.1.1.1        which way do packets go?
                   sudo ip link set enp0s3 down   turn the network card off
                   sudo ip link set enp0s3 up     turn it on again
            """,
        Run = ctx =>
        {
            var args = new List<string>(ctx.Args);
            bool brief = false;
            bool only4 = false;
            while (args.Count > 0 && args[0].StartsWith('-'))
            {
                var f = args[0];
                args.RemoveAt(0);
                if (f == "-br" || f == "-brief" || f == "--brief") brief = true;
                else if (f == "-4") only4 = true;
                else if (new[] { "-6", "-c", "-color", "--color", "-s", "-d", "-details" }.Contains(f) || f.StartsWith("-color=", StringComparison.Ordinal) || f.StartsWith("--color=", StringComparison.Ordinal)) continue;
                else if (f == "-V" || f == "-Version")
                {
                    ctx.Out("ip utility, iproute2-6.14.0, libbpf 1.5.0\n");
                    return 0;
                }
                else
                {
                    ctx.Err($"Option \"{f}\" is unknown, try \"ip -help\".\n");
                    return 255;
                }
            }
            string? objWord = null;
            if (args.Count > 0)
            {
                objWord = args[0];
                args.RemoveAt(0);
            }
            if (string.IsNullOrEmpty(objWord))
            {
                ctx.Err("Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | link | neighbour | route | ... }\n       OPTIONS := { -4 | -6 | -br[ief] | -c[olor] | -s[tatistics] | ... }\n");
                return 255;
            }
            var obj = IpObjects.FirstOrDefault(o => o.StartsWith(objWord, StringComparison.Ordinal));
            switch (obj)
            {
                case "address":
                {
                    var cmd = args.Count > 0 ? args[0] : "show";
                    var rest = args.Skip(1).ToList();
                    if (cmd == "show" || cmd == "list" || cmd == "ls") return IpAddr(ctx, brief, only4, rest.Where(w => w != "dev").ToList().At(0));
                    if (new[] { "add", "del", "delete", "flush", "change", "replace" }.Contains(cmd))
                    {
                        if (!IsRoot(ctx))
                        {
                            ctx.Err("RTNETLINK answers: Operation not permitted\n");
                            return 2;
                        }
                        Note(ctx, "net.addressChangeUnsupported");
                        return 1;
                    }
                    ctx.Err($"Command \"{cmd}\" is unknown, try \"ip address help\".\n");
                    return 255;
                }
                case "link":
                    return IpLink(ctx, brief, args);
                case "route":
                    return IpRoute(ctx, args);
                case "neighbour":
                case "neighbor":
                    foreach (var n in Neighbours(ctx.Sh)) ctx.Out(n + " \n");
                    return 0;
                case "help":
                    ctx.Out("Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | link | neighbour | route | ... }\n");
                    return 0;
                default:
                    ctx.Err($"Object \"{objWord}\" is unknown, try \"ip help\".\n");
                    return 1;
            }
        },
    };

    // ---------- ping ----------

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

    // ---------- ss ----------

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

    // ---------- DNS: dig, host, nslookup ----------

    private static readonly string[] DigTypes = { "A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA", "PTR", "ANY" };

    private static string ReverseZone(string ip)
    {
        var parts = ip.Split('.');
        Array.Reverse(parts);
        return string.Join(".", parts) + ".in-addr.arpa";
    }

    /// <summary>Which DNS server to use: @server, otherwise /etc/resolv.conf.</summary>
    private static string? PickServer(CmdCtx ctx, string? explicitServer)
    {
        if (!string.IsNullOrEmpty(explicitServer))
        {
            if (IsIPv4(explicitServer)) return explicitServer;
            return ResolveHost(ctx.Sh, explicitServer) is ResolvedOk r ? r.Ip : null;
        }
        return Nameserver(ctx.Sh);
    }

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

    // ---------- traceroute ----------

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

    // ---------- URLs, curl and wget ----------

    private sealed class Url
    {
        /// <summary>"http" or "https".</summary>
        public string Scheme { get; init; } = "http";
        public string Host { get; init; } = "";
        public double Port { get; init; }
        public string Path { get; init; } = "/";
        /// <summary>The host as it was typed, with the port if one was given ("localhost:8080").</summary>
        public string HostPort { get; init; } = "";
    }

    private static readonly Regex SchemeRe = new("^([a-zA-Z][a-zA-Z0-9+.-]*)://", RegexOptions.CultureInvariant);
    private static readonly Regex HostPortRe = new("^([^:@]+)(?::([0-9]+))?\\z", RegexOptions.CultureInvariant);
    private static readonly Regex UserInfoRe = new("^.*@", RegexOptions.CultureInvariant);
    private static readonly Regex FragmentRe = new("#.*", RegexOptions.CultureInvariant);
    private static readonly Regex HttpUrlRe = new("^https?://", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex AnySchemeRe = new("^[A-Za-z0-9_]+://", RegexOptions.CultureInvariant);
    private static readonly Regex QuotedRe = new("'(.+?)'", RegexOptions.CultureInvariant);

    /// <summary>Parses a URL. On failure Url is null and Error is "protocol" (with Scheme) or "malformed".</summary>
    private static (Url? Url, string? Error, string? Scheme) ParseUrl(string raw)
    {
        var rest = raw;
        var scheme = "http";
        var m = SchemeRe.Match(raw);
        if (m.Success)
        {
            scheme = m.Groups[1].Value.ToLowerInvariant();
            rest = raw[m.Length..];
        }
        if (scheme != "http" && scheme != "https") return (null, "protocol", m.Groups[1].Value);
        var slash = rest.IndexOfAny(new[] { '/', '?', '#' });
        var hostPort = slash < 0 ? rest : rest[..slash];
        var path = slash < 0 ? "/" : rest[slash..];
        if (!path.StartsWith('/')) path = "/" + path;
        var hp = HostPortRe.Match(UserInfoRe.Replace(hostPort, "", 1));
        if (!hp.Success) return (null, "malformed", null);
        double port = hp.Groups[2].Success && hp.Groups[2].Value != "" ? Js.Number(hp.Groups[2].Value) : scheme == "https" ? 443 : 80;
        return (new Url { Scheme = scheme, Host = hp.Groups[1].Value.ToLowerInvariant(), Port = port, Path = FragmentRe.Replace(path, "", 1), HostPort = hostPort }, null, null);
    }

    private static string JoinUrl(Url @base, string location)
    {
        if (HttpUrlRe.IsMatch(location)) return location;
        return $"{@base.Scheme}://{@base.HostPort}{(location.StartsWith('/') ? location : "/" + location)}";
    }

    private static string StatusLine(HttpResponse r) =>
        r.Version == "HTTP/2" ? $"HTTP/2 {r.Status}" : $"{r.Version} {r.Status} {r.Reason}";

    private static string HeaderText(HttpResponse r) =>
        string.Join("\n", new[] { StatusLine(r) }.Concat(r.Headers.Select(h => $"{h.Key}: {h.Value}"))) + "\n\n";

    private static string? Header(HttpResponse r, string name)
    {
        foreach (var (k, v) in r.Headers) if (k.ToLowerInvariant() == name) return v;
        return null;
    }

    private static string ConnectError(string kind, string host, string port) => kind switch
    {
        "refused" or "netunreach" => $"curl: (7) Failed to connect to {host} port {port} after 0 ms: Couldn't connect to server",
        "hostunreach" => $"curl: (7) Failed to connect to {host} port {port} after 3071 ms: Couldn't connect to server",
        _ => $"curl: (28) Failed to connect to {host} port {port} after 134023 ms: Timeout was reached",
    };

    /// <summary>Saves to a file. Returns the error message, or null.</summary>
    private static string? SaveFile(CmdCtx ctx, string path, string content)
    {
        try
        {
            ctx.Sh.Vfs.WriteFile(ctx.Sh.Resolve(path), content, ctx.Sh.CurrentUser());
            return null;
        }
        catch (FsError e)
        {
            return e.Message;
        }
    }

    private static readonly CommandDef Curl = new()
    {
        Name = "curl",
        Summary = "Hämtar data från en webbadress (URL)",
        SummaryEn = "Transfer data from or to a server (URL)",
        Man = """
            NAMN
                   curl - hämta (eller skicka) data via en URL

            SYNOPSIS
                   curl [FLAGGOR] URL

            BESKRIVNING
                   curl skriver det den hämtar direkt i terminalen (standard ut), så
                   att det går att skicka vidare i en pipe. Använd -o eller -O för att
                   spara till en fil.

            FLAGGOR
                   -o FIL   spara till FIL
                   -O       spara med filnamnet från URL:en
                   -I       visa bara svarshuvudena (headers)
                   -i       visa svarshuvudena före innehållet
                   -L       följ omdirigeringar (301/302)
                   -s       tyst: ingen förloppsmätare och inga felmeddelanden
                   -S       visa fel även med -s
                   -f       misslyckas (kod 22) om servern svarar med ett fel, t.ex. 404
                   -v       visa hela samtalet med servern

            EXEMPEL
                   curl http://localhost:8080
                   curl -I https://example.com
                   curl -L http://linux.org
                   curl -o sida.html https://example.com
            """,
        ManEn = """
            NAME
                   curl - transfer data from or to a URL

            SYNOPSIS
                   curl [OPTIONS] URL

            DESCRIPTION
                   curl writes what it fetches straight to the terminal (standard
                   output), so that it can be piped further. Use -o or -O to save it to
                   a file.

            OPTIONS
                   -o FILE  write to FILE
                   -O       write to a file named like the remote file
                   -I       show the response headers only
                   -i       include the response headers before the body
                   -L       follow redirects (301/302)
                   -s       silent: no progress meter and no error messages
                   -S       show errors even with -s
                   -f       fail (exit code 22) on server errors such as 404
                   -v       verbose, show the whole conversation with the server

            EXAMPLES
                   curl http://localhost:8080
                   curl -I https://example.com
                   curl -L http://linux.org
                   curl -o page.html https://example.com
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "sSLIifvOkV#",
                Values = "oHAXdmwe",
                Long = new()
                {
                    ["silent"] = "s",
                    ["show-error"] = "S",
                    ["location"] = "L",
                    ["head"] = "I",
                    ["include"] = "i",
                    ["fail"] = "f",
                    ["verbose"] = "v",
                    ["remote-name"] = "O",
                    ["insecure"] = "k",
                    ["version"] = "V",
                    ["output"] = "o",
                    ["header"] = "H",
                    ["user-agent"] = "A",
                    ["request"] = "X",
                    ["data"] = "d",
                    ["max-time"] = "m",
                    ["write-out"] = "w",
                    ["referer"] = "e",
                },
            });
            if (o.Error is not null)
            {
                var qm = QuotedRe.Match(o.Error);
                var opt = qm.Success ? qm.Groups[1].Value : o.Error;
                ctx.Err($"curl: option {(opt.StartsWith('-') ? opt : "-" + opt)}: is unknown\ncurl: try 'curl --help' or 'curl --manual' for more information\n");
                return 2;
            }
            var f = o.Flags;
            if (f.Contains("V"))
            {
                ctx.Out("curl 8.15.0 (x86_64-pc-linux-gnu) libcurl/8.15.0 OpenSSL/3.5.1 zlib/1.3.1 brotli/1.1.0 zstd/1.5.7 libidn2/2.3.8 nghttp2/1.66.0\nProtocols: dict file ftp ftps http https imap imaps mqtt pop3 pop3s rtsp smtp smtps telnet tftp ws wss\n");
                return 0;
            }
            var raw = o.Operands.At(0);
            if (string.IsNullOrEmpty(raw))
            {
                ctx.Err("curl: try 'curl --help' or 'curl --manual' for more information\n");
                return 2;
            }
            var silent = f.Contains("s") && !f.Contains("S");
            int Fail(int code, string msg)
            {
                if (!silent) ctx.Err(msg + "\n");
                return code;
            }
            var current = raw;
            HttpResponse? response = null;
            var headersOut = "";
            Url? url = null;
            for (int redirects = 0; ; redirects++)
            {
                var (u, uerr, uscheme) = ParseUrl(current);
                if (u is null)
                {
                    return uerr == "protocol"
                        ? Fail(1, $"curl: (1) Protocol \"{uscheme}\" not supported")
                        : Fail(3, "curl: (3) URL rejected: Malformed input to a URL function");
                }
                url = u;
                var port = Js.Num(u.Port);
                if (ResolveHost(sh, u.Host) is not ResolvedOk r) return Fail(6, $"curl: (6) Could not resolve host: {u.Host}");
                if (f.Contains("v")) ctx.Err($"*   Trying {r.Ip}:{port}...\n");
                var c = Connect(sh, r.Ip, ToPort(u.Port));
                if (c != "ok") return Fail(c == "timeout" ? 28 : 7, ConnectError(c, u.Host, port));
                var (res, herr) = HttpRequest(sh, r.Ip, ToPort(u.Port), u.Scheme == "https", u.HostPort, u.Path);
                if (herr == "not-http") return Fail(1, "curl: (1) Received HTTP/0.9 when not allowed");
                if (herr == "tls-error") return Fail(35, "curl: (35) OpenSSL/3.5.1: error:0A00010B:SSL routines::wrong version number");
                if (herr == "empty") return Fail(52, "curl: (52) Empty reply from server");
                if (f.Contains("v"))
                {
                    var method = f.Contains("I") ? "HEAD" : "GET";
                    ctx.Err(
                        $"* Connected to {u.Host} ({r.Ip}) port {port}\n" +
                        (u.Scheme == "https" ? "* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384\n" : "") +
                        $"> {method} {u.Path} {(res!.Version == "HTTP/2" ? "HTTP/2" : "HTTP/1.1")}\n> Host: {u.HostPort}\n> User-Agent: curl/8.15.0\n> Accept: */*\n>\n" +
                        string.Concat(HeaderText(res).TrimEnd().Split('\n').Select(l => $"< {l}\n")) +
                        "<\n");
                }
                response = res!;
                if (f.Contains("I") || f.Contains("i")) headersOut += HeaderText(res!);
                var location = Header(res!, "location");
                if (f.Contains("L") && res!.Status >= 300 && res.Status < 400 && !string.IsNullOrEmpty(location))
                {
                    if (redirects >= 50) return Fail(47, "curl: (47) Maximum (50) redirects followed");
                    current = JoinUrl(u, location);
                    continue;
                }
                break;
            }
            var resp = response!;
            if (f.Contains("f") && resp.Status >= 400) return Fail(22, $"curl: (22) The requested URL returned error: {resp.Status}");
            var body = f.Contains("I") ? "" : resp.Body;
            var output = headersOut + body;
            var target = o.Values.Get("o");
            if (f.Contains("O") && target is null)
            {
                target = VfsLib.Basename(url!.Path.Split('?')[0]);
                if (target == "" || url.Path.EndsWith('/')) return Fail(23, "curl: (23) Remote file name has no length");
            }
            if (target is not null && target != "-")
            {
                var err = SaveFile(ctx, target, output);
                if (err is not null)
                {
                    if (!silent) ctx.Err($"Warning: Failed to open the file {target}: {err}\n");
                    return Fail(23, "curl: (23) Failure writing output to destination");
                }
                if (!f.Contains("s"))
                {
                    var size = Js.Num(ByteLength(output));
                    var speed = Js.Num((long)ByteLength(output) * 9);
                    ctx.Err(
                        "  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n" +
                        "                                 Dload  Upload   Total   Spent    Left  Speed\n" +
                        $"100 {size.PadLeft(5)}  100 {size.PadLeft(5)}    0     0  {speed.PadLeft(5)}      0 --:--:-- --:--:-- --:--:--  {speed.PadLeft(5)}\n");
                }
            }
            else
            {
                ctx.Out(output);
            }
            if (!f.Contains("L") && !f.Contains("s") && resp.Status >= 300 && resp.Status < 400 && ctx.IsTTY)
            {
                var loc = Header(resp, "location") ?? "undefined";
                Note(ctx, "net.curlRedirect", ("status", resp.Status), ("reason", resp.Reason), ("location", loc));
            }
            return 0;
        },
    };

    private static string WgetTime()
    {
        var d = Js.LocalNow();
        return d.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
    }

    private static string HumanBytes(int n) => n < 1024 ? Js.Num(n) : $"{Js.ToFixed(n / 1024.0, 1)}K";

    private static readonly Dictionary<string, string> Why = new()
    {
        ["refused"] = "Connection refused",
        ["timeout"] = "Connection timed out",
        ["netunreach"] = "Network is unreachable",
        ["hostunreach"] = "No route to host",
    };

    private static readonly CommandDef Wget = new()
    {
        Name = "wget",
        Summary = "Laddar ner filer från webben",
        SummaryEn = "Download files from the web",
        Man = """
            NAMN
                   wget - ladda ner filer från webben

            SYNOPSIS
                   wget [-q] [-O FIL] [-P KATALOG] URL

            BESKRIVNING
                   wget sparar alltid det den hämtar som en fil (till skillnad från
                   curl, som skriver i terminalen). Filnamnet tas från URL:en, och
                   index.html används om URL:en slutar med /. wget följer
                   omdirigeringar automatiskt.

            FLAGGOR
                   -O FIL      spara som FIL (-O - skriver till standard ut)
                   -P KATALOG  spara i KATALOG
                   -q          tyst

            EXEMPEL
                   wget https://example.com/cheatsheet.txt
                   wget -O exempel.html https://example.com
            """,
        ManEn = """
            NAME
                   wget - download files from the web

            SYNOPSIS
                   wget [-q] [-O FILE] [-P DIRECTORY] URL

            DESCRIPTION
                   wget always saves what it fetches as a file (unlike curl, which
                   writes to the terminal). The file name is taken from the URL, and
                   index.html is used when the URL ends with /. wget follows redirects
                   automatically.

            OPTIONS
                   -O FILE       save as FILE (-O - writes to standard output)
                   -P DIRECTORY  save in DIRECTORY
                   -q            quiet

            EXAMPLES
                   wget https://example.com/cheatsheet.txt
                   wget -O example.html https://example.com
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "qcnvV",
                Values = "OPt",
                Long = new() { ["quiet"] = "q", ["continue"] = "c", ["verbose"] = "v", ["version"] = "V", ["output-document"] = "O", ["directory-prefix"] = "P", ["tries"] = "t" },
            });
            if (o.Error is not null)
            {
                ctx.Err($"wget: {o.Error}\nUsage: wget [OPTION]... [URL]...\n\nTry `wget --help' for more options.\n");
                return 2;
            }
            if (o.Flags.Contains("V"))
            {
                ctx.Out("GNU Wget 1.25.0 built on linux-gnu.\n");
                return 0;
            }
            var raw = o.Operands.At(0);
            if (string.IsNullOrEmpty(raw))
            {
                ctx.Err("wget: missing URL\nUsage: wget [OPTION]... [URL]...\n\nTry `wget --help' for more options.\n");
                return 1;
            }
            var quiet = o.Flags.Contains("q");
            void Log(string s)
            {
                if (!quiet) ctx.Err(s);
            }
            var current = raw;
            HttpResponse? res = null;
            Url? url = null;
            for (int redirects = 0; ; redirects++)
            {
                var (u, uerr, uscheme) = ParseUrl(current);
                if (u is null)
                {
                    ctx.Err(uerr == "protocol" ? $"{current}: Unsupported scheme ‘{uscheme}’.\n" : $"{current}: Invalid URL.\n");
                    return 1;
                }
                url = u;
                var port = Js.Num(u.Port);
                var shown = AnySchemeRe.IsMatch(current) ? current : $"http://{current}";
                Log($"--{WgetTime()}--  {shown}\n");
                var ipAddr = u.Host;
                if (!IsIPv4(u.Host))
                {
                    var resolved = ResolveHost(sh, u.Host);
                    if (resolved is not ResolvedOk rr)
                    {
                        Log($"Resolving {u.Host} ({u.Host})... failed: {ResolveErrorText(((ResolvedFail)resolved).Error)}.\n");
                        ctx.Err($"wget: unable to resolve host address ‘{u.Host}’\n");
                        return 4;
                    }
                    ipAddr = rr.Ip;
                    Log($"Resolving {u.Host} ({u.Host})... {ipAddr}\n");
                }
                var where = IsIPv4(u.Host) ? $"{u.Host}:{port}" : $"{u.Host} ({u.Host})|{ipAddr}|:{port}";
                var c = Connect(sh, ipAddr, ToPort(u.Port));
                if (c != "ok")
                {
                    var why = Why[c];
                    Log($"Connecting to {where}... failed: {why}.\n");
                    if (quiet) ctx.Err($"wget: {u.Host}: {why}\n");
                    return 4;
                }
                Log($"Connecting to {where}... connected.\n");
                var (r, herr) = HttpRequest(sh, ipAddr, ToPort(u.Port), u.Scheme == "https", u.HostPort, u.Path);
                if (herr == "tls-error")
                {
                    ctx.Err("OpenSSL: error:0A00010B:SSL routines::wrong version number\nUnable to establish SSL connection.\n");
                    return 4;
                }
                if (herr == "not-http" || herr == "empty")
                {
                    Log("HTTP request sent, awaiting response... No data received.\n");
                    return 4;
                }
                Log($"HTTP request sent, awaiting response... {r!.Status} {r.Reason}\n");
                var location = Header(r, "location");
                if (r.Status >= 300 && r.Status < 400 && !string.IsNullOrEmpty(location))
                {
                    if (redirects >= 20)
                    {
                        ctx.Err("20 redirections exceeded.\n");
                        return 8;
                    }
                    current = JoinUrl(u, location);
                    Log($"Location: {current} [following]\n");
                    continue;
                }
                res = r;
                break;
            }
            if (res.Status >= 400)
            {
                ctx.Err($"{WgetTime()} ERROR {res.Status}: {res.Reason}.\n\n");
                return 8;
            }
            var size = ByteLength(res.Body);
            var type = (Header(res, "content-type") ?? "text/plain").Split(';')[0];
            Log($"Length: {size}{(size < 1024 ? "" : $" ({HumanBytes(size)})")} [{type}]\n");
            var target = o.Values.Get("O");
            if (target == "-")
            {
                Log("Saving to: ‘STDOUT’\n\n");
                ctx.Out(res.Body);
                Log($"\n{WgetTime()} (12.4 MB/s) - written to stdout [{size}/{size}]\n\n");
                return 0;
            }
            if (target is null)
            {
                var path = url!.Path.Split('?')[0];
                var name = path.EndsWith('/') ? "index.html" : VfsLib.Basename(path);
                var dirOpt = o.Values.Get("P");
                var dir = !string.IsNullOrEmpty(dirOpt) ? (dirOpt.EndsWith('/') ? dirOpt[..^1] : dirOpt) + "/" : "";
                target = dir + name;
                for (int n = 1; sh.Vfs.TryLookup(sh.Resolve(target), sh.RootUser()) is not null; n++) target = $"{dir}{name}.{n}";
            }
            Log($"Saving to: ‘{target}’\n\n");
            var err = SaveFile(ctx, target, res.Body);
            if (err is not null)
            {
                ctx.Err($"{target}: {err}\n");
                return 3;
            }
            Log($"{VfsLib.Basename(target).PadRight(18)} 100%[===================>]  {HumanBytes(size).PadLeft(6)}  --.-KB/s    in 0s      \n\n");
            Log($"{WgetTime()} (12.4 MB/s) - ‘{target}’ saved [{size}/{size}]\n\n");
            return 0;
        },
    };

    // ---------- myserver ----------

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

    public static List<CommandDef> All { get; } = new() { Ip, Ping, Ss, Dig, Host, Nslookup, Getent, Traceroute, Curl, Wget, Myserver };
}
