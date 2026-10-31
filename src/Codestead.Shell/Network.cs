using System.Runtime.CompilerServices;

namespace Codestead.Shell;

// Port of src/shell/network.ts – the simulated network: the computer's interfaces and routes, name
// lookups via /etc/hosts and a pretend DNS, which addresses answer, which ports listen (from the
// process table) and a few web pages to fetch with curl/wget.
//
// Everything is deterministic and built on the shell's state: /etc/hosts and /etc/resolv.conf are
// read from the file system, listening ports from sh.Proc and whether the network card is down
// from sh.Flags.

public partial class Page
{
    public string Type { get; set; } = "";
    public string Body { get; set; } = "";
}

/// <summary>DNS answer. Status is "NOERROR", "NXDOMAIN" or "SERVFAIL".</summary>
public partial class DnsAnswer
{
    public string Status { get; set; } = "NOERROR";
    public List<string> A { get; set; } = new();
    public List<string> Aaaa { get; set; } = new();
}

/// <summary>Result of <see cref="NetworkLib.ResolveHost"/>: <see cref="ResolvedOk"/> or <see cref="ResolvedFail"/>.</summary>
public abstract partial class Resolved
{
    public abstract bool Ok { get; }
}

public partial class ResolvedOk : Resolved
{
    public override bool Ok => true;
    public string Ip { get; set; } = "";
    /// <summary>The name that was typed (or the IP address).</summary>
    public string Name { get; set; } = "";
    /// <summary>"literal", "hosts" or "dns".</summary>
    public string Source { get; set; } = "";
}

public partial class ResolvedFail : Resolved
{
    public override bool Ok => false;
    /// <summary>"notfound" or "tempfail".</summary>
    public string Error { get; set; } = "";
}

public partial class IfaceInet
{
    public string Addr { get; set; } = "";
    public int Prefix { get; set; }
    public string? Brd { get; set; }
    public string Scope { get; set; } = "";
    public string Extra { get; set; } = "";
    public string Lft { get; set; } = "";
}

public partial class IfaceInet6
{
    public string Addr { get; set; } = "";
    public int Prefix { get; set; }
    public string Scope { get; set; } = "";
    public string Extra { get; set; } = "";
}

public partial class Iface
{
    public int Index { get; set; }
    public string Name { get; set; } = "";
    public string Flags { get; set; } = "";
    public int Mtu { get; set; }
    public string Qdisc { get; set; } = "";
    /// <summary>"UP", "DOWN" or "UNKNOWN".</summary>
    public string State { get; set; } = "";
    public string LinkType { get; set; } = "";
    public string Mac { get; set; } = "";
    public string Brd { get; set; } = "";
    public List<IfaceInet> Inet { get; set; } = new();
    public List<IfaceInet6> Inet6 { get; set; } = new();
}

public partial class Listener
{
    /// <summary>"tcp" or "udp".</summary>
    public string Proto { get; set; } = "";
    public string Addr { get; set; } = "";
    public int Port { get; set; }
    public Proc Proc { get; set; } = null!;
    public int Fd { get; set; }
}

public partial class HttpResponse
{
    public int Status { get; set; }
    public string Reason { get; set; } = "";
    /// <summary>"HTTP/1.1", "HTTP/1.0" or "HTTP/2".</summary>
    public string Version { get; set; } = "";
    public List<(string Key, string Value)> Headers { get; set; } = new();
    public string Body { get; set; } = "";
}

public static partial class NetworkLib
{
    // ---------- The local network ----------

    public const string Iface = "enp0s3";
    public const string LanPrefix = "192.168.1.";
    /// <summary>MY_IP in the TypeScript (renamed: C# cannot have a constant and the method MyIp() with the same name).</summary>
    public const string MyIpAddress = "192.168.1.42";
    public const string Gateway = "192.168.1.1";
    public const string ServerIp = "192.168.1.10";
    public const string ServerName = "server";
    private const string MyMacAddr = "08:00:27:3a:5c:e1";
    private const string ServerMac = "08:00:27:7b:10:0a";
    private const string GatewayMac = "3c:84:6a:12:34:56";

    /// <summary>Shells that pretend to be the server (192.168.1.10) and not the student's computer.</summary>
    private static readonly ConditionalWeakTable<Shell, object> Remote = new();

    public static void MarkAsServer(Shell sh) => Remote.AddOrUpdate(sh, true);

    public static bool IsServer(Shell sh) => Remote.TryGetValue(sh, out _);

    /// <summary>The computer's own address on the local network.</summary>
    public static string MyIp(Shell sh) => IsServer(sh) ? ServerIp : MyIpAddress;

    private static string MyMac(Shell sh) => IsServer(sh) ? ServerMac : MyMacAddr;

    private const string LinkDownFlag = $"net:{Iface}:down";

    public static bool LinkUp(Shell sh) => !(sh.Flags.TryGetValue(LinkDownFlag, out var v) && v);

    public static void SetLinkUp(Shell sh, bool up)
    {
        if (up) sh.Flags.Remove(LinkDownFlag);
        else sh.Flags[LinkDownFlag] = true;
    }

    /// <summary>Ubuntu and Fedora use systemd-resolved with a local DNS stub on 127.0.0.53.</summary>
    public static bool UsesResolved(Distro distro) => distro.Id == "ubuntu" || distro.Family == "redhat";

    public static string ResolvConf(Distro distro)
    {
        if (UsesResolved(distro))
        {
            return
                "# This is /run/systemd/resolve/stub-resolv.conf managed by man:systemd-resolved(8).\n" +
                "# Do not edit.\n#\n" +
                "# This file might be symlinked as /etc/resolv.conf. If you're looking at\n" +
                "# /etc/resolv.conf and seeing this text, you have followed the symlink.\n#\n" +
                "# Run \"resolvectl status\" to see details about the uplink DNS servers\n" +
                "# currently in use.\n\n" +
                "nameserver 127.0.0.53\noptions edns0 trust-ad\nsearch lan\n";
        }
        return $"# Generated by NetworkManager\nsearch lan\nnameserver {Gateway}\n";
    }

    /// <summary>The program file /usr/local/bin/myserver.</summary>
    public static FsNode MyserverBinary()
    {
        var node = VfsLib.MakeFile($"{VfsLib.Elf}\u0002\u0001\u0001 (simulated binary: myserver)", "root", Js.Oct(755));
        node.Size = 48_312;
        return node;
    }

    // ---------- Addresses ----------

    private static readonly Regex OctetRe = new(@"^[0-9]{1,3}\z", RegexOptions.CultureInvariant);

    public static bool IsIPv4(string s)
    {
        var parts = s.Split('.');
        return parts.Length == 4 && parts.All(p => OctetRe.IsMatch(p) && Js.Number(p) <= 255);
    }

    public static bool IsLoopback(string ip) => ip.StartsWith("127.", StringComparison.Ordinal) || ip == "0.0.0.0" || ip == "::1";

    /// <summary>Is the address the computer itself (loopback or its own address)?</summary>
    public static bool IsLocal(Shell sh, string ip) => IsLoopback(ip) || ip == MyIp(sh);

    // ---------- Internet ----------

    private sealed class NetHost
    {
        public required List<string> Names { get; init; }
        public required List<string> A { get; init; }
        public List<string>? Aaaa { get; init; }
        /// <summary>http:// redirects to https:// (301).</summary>
        public bool RedirectHttp { get; init; }
        /// <summary>Answers DNS queries (port 53).</summary>
        public bool Dns { get; init; }
        public required Dictionary<string, Page> Pages { get; init; }
    }

    private static Page Html(string title, string text) => new()
    {
        Type = "text/html; charset=UTF-8",
        Body =
            $"<!doctype html>\n<html>\n<head>\n    <title>{title}</title>\n    <meta charset=\"utf-8\">\n</head>\n<body>\n" +
            $"<h1>{title}</h1>\n<p>{text}</p>\n</body>\n</html>\n",
    };

    private static Page Text(string body) => new() { Type = "text/plain; charset=utf-8", Body = body };

    private static readonly Page Example = new()
    {
        Type = "text/html",
        Body = """
            <!doctype html>
            <html>
            <head>
                <title>Example Domain</title>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </head>
            <body>
            <div>
                <h1>Example Domain</h1>
                <p>This domain is for use in documentation examples without needing permission.
                Avoid use in operations.</p>
                <p><a href="https://iana.org/domains/example">Learn more</a></p>
            </div>
            </body>
            </html>

            """,
    };

    private static readonly Page Cheatsheet = Text("""
        Linux network cheat sheet
        =========================
        ip a                 show your IP addresses
        ip route             show the routing table (default gateway)
        ping -c 3 HOST       is HOST reachable?
        dig +short NAME      look up the IP address of NAME
        ss -tulpn            which ports are listening?
        curl URL             fetch a web page
        wget URL             download a file
        ssh USER@HOST CMD    run CMD on another computer

        """);

    private static readonly List<NetHost> Internet = new()
    {
        new NetHost
        {
            Names = new() { "example.com", "www.example.com" },
            A = new() { "203.0.113.10" },
            Aaaa = new() { "2001:db8::10" },
            Pages = new() { ["/"] = Example, ["/index.html"] = Example, ["/cheatsheet.txt"] = Cheatsheet },
        },
        new NetHost
        {
            Names = new() { "linux.org", "www.linux.org" },
            A = new() { "203.0.113.20" },
            RedirectHttp = true,
            Pages = new() { ["/"] = Html("Linux.org", "Friendly Linux forum. Welcome, beginners!") },
        },
        new NetHost
        {
            Names = new() { "archlinux.org", "www.archlinux.org" },
            A = new() { "203.0.113.30" },
            Aaaa = new() { "2001:db8::30" },
            RedirectHttp = true,
            Pages = new() { ["/"] = Html("Arch Linux", "A simple, lightweight distribution.") },
        },
        new NetHost
        {
            Names = new() { "debian.org", "www.debian.org" },
            A = new() { "198.51.100.20" },
            Aaaa = new() { "2001:db8:1::20" },
            RedirectHttp = true,
            Pages = new() { ["/"] = Html("Debian -- The Universal Operating System", "Debian is a free operating system for your computer.") },
        },
        new NetHost
        {
            Names = new() { "ubuntu.com", "www.ubuntu.com" },
            A = new() { "198.51.100.30" },
            RedirectHttp = true,
            Pages = new() { ["/"] = Html("Enterprise Open Source and Linux | Ubuntu", "Ubuntu is the modern, open source operating system on Linux.") },
        },
        new NetHost
        {
            Names = new() { "fedoraproject.org", "www.fedoraproject.org" },
            A = new() { "198.51.100.40" },
            RedirectHttp = true,
            Pages = new() { ["/"] = Html("Fedora Linux", "An innovative platform for hardware, clouds and containers.") },
        },
        new NetHost
        {
            Names = new() { "kernel.org", "www.kernel.org" },
            A = new() { "198.51.100.50" },
            RedirectHttp = true,
            Pages = new() { ["/"] = Html("The Linux Kernel Archives", "This site is operated by the Linux Kernel Organization.") },
        },
        new NetHost
        {
            Names = new() { "one.one.one.one" },
            A = new() { "1.1.1.1", "1.0.0.1" },
            Dns = true,
            RedirectHttp = true,
            Pages = new() { ["/"] = Html("1.1.1.1 — The free app that makes your Internet faster.", "Cloudflare DNS resolver.") },
        },
        new NetHost
        {
            Names = new() { "dns.google" },
            A = new() { "8.8.8.8", "8.8.4.4" },
            Dns = true,
            RedirectHttp = true,
            Pages = new() { ["/"] = Html("Google Public DNS", "Free, global DNS resolution service.") },
        },
    };

    private static string NormName(string name)
    {
        var n = name.ToLowerInvariant();
        return n.EndsWith('.') ? n[..^1] : n;
    }

    private static NetHost? InternetHostByName(string name)
    {
        var n = NormName(name);
        return Internet.FirstOrDefault(h => h.Names.Contains(n));
    }

    private static NetHost? InternetHostByIp(string ip) => Internet.FirstOrDefault(h => h.A.Contains(ip));

    // ---------- DNS ----------

    private static readonly Regex NameserverRe = new(@"^\s*nameserver\s+(\S+)", RegexOptions.CultureInvariant);

    /// <summary>The name server in /etc/resolv.conf (the first "nameserver ..." line), or null.</summary>
    public static string? Nameserver(Shell sh)
    {
        var conf = ReadSystemFile(sh, "/etc/resolv.conf");
        if (conf is null) return null;
        foreach (var line in conf.Split('\n'))
        {
            var m = NameserverRe.Match(line);
            if (m.Success) return m.Groups[1].Value;
        }
        return null;
    }

    /// <summary>Does the address answer DNS queries (and can it be reached)?</summary>
    public static bool IsDnsServer(Shell sh, string ip)
    {
        if (ip == "127.0.0.53") return UsesResolved(sh.Distro);
        if (Reach(sh, ip) != "ok") return false;
        if (ip == Gateway) return true;
        return InternetHostByIp(ip)?.Dns ?? false;
    }

    /// <summary>
    /// Asks a DNS server (by default the one in /etc/resolv.conf). null means the server could not be
    /// reached. DNS only knows the internet – not /etc/hosts and not names on the local network.
    /// </summary>
    public static DnsAnswer? DnsQuery(Shell sh, string name) => DnsQuery(sh, name, Nameserver(sh));

    public static DnsAnswer? DnsQuery(Shell sh, string name, string? server)
    {
        if (string.IsNullOrEmpty(server) || !IsDnsServer(sh, server)) return null;
        // The stub on 127.0.0.53 always answers, but needs the network to ask further.
        if (!LinkUp(sh)) return new DnsAnswer { Status = "SERVFAIL" };
        var n = NormName(name);
        if (n == "localhost") return new DnsAnswer { Status = "NOERROR", A = new() { "127.0.0.1" }, Aaaa = new() { "::1" } };
        var host = InternetHostByName(n);
        if (host is null) return new DnsAnswer { Status = "NXDOMAIN" };
        return new DnsAnswer { Status = "NOERROR", A = host.A, Aaaa = host.Aaaa ?? new List<string>() };
    }

    /// <summary>Reverse lookup (PTR) in DNS: IP address → name.</summary>
    public static string? DnsReverse(string ip)
    {
        if (ip == "127.0.0.1") return "localhost";
        return InternetHostByIp(ip)?.Names[0];
    }

    public static string? ReadSystemFile(Shell sh, string path)
    {
        var node = sh.Vfs.TryLookup(path, sh.RootUser());
        return node?.Type == "file" ? (node.Content ?? "") : null;
    }

    private static readonly Regex CommentRe = new("#.*", RegexOptions.CultureInvariant);
    private static readonly Regex WsRe = new(@"\s+", RegexOptions.CultureInvariant);

    /// <summary>The lines of /etc/hosts as [ip, names...].</summary>
    public static List<(string Ip, List<string> Names)> HostsEntries(Shell sh)
    {
        var content = ReadSystemFile(sh, "/etc/hosts") ?? "";
        var entries = new List<(string Ip, List<string> Names)>();
        foreach (var raw in content.Split('\n'))
        {
            var fields = WsRe.Split(CommentRe.Replace(raw, "", 1).Trim()).Where(f => f != "").ToList();
            if (fields.Count >= 2) entries.Add((fields[0], fields.Skip(1).ToList()));
        }
        return entries;
    }

    /// <summary>Looks up a name the way the system does: first /etc/hosts, then DNS. IPv4 only.</summary>
    public static Resolved ResolveHost(Shell sh, string name)
    {
        if (IsIPv4(name)) return new ResolvedOk { Ip = name, Name = name, Source = "literal" };
        var n = NormName(name);
        foreach (var e in HostsEntries(sh))
        {
            if (IsIPv4(e.Ip) && e.Names.Any(x => x.ToLowerInvariant() == n)) return new ResolvedOk { Ip = e.Ip, Name = name, Source = "hosts" };
        }
        var answer = DnsQuery(sh, n);
        if (answer is null || answer.Status == "SERVFAIL") return new ResolvedFail { Error = "tempfail" };
        if (answer.A.Count == 0) return new ResolvedFail { Error = "notfound" };
        return new ResolvedOk { Ip = answer.A[0], Name = name, Source = "dns" };
    }

    /// <summary>Text for a failed lookup, as glibc writes it.</summary>
    public static string ResolveErrorText(string error) =>
        error == "notfound" ? "Name or service not known" : "Temporary failure in name resolution";

    /// <summary>The name replies from an address are shown with (like ping does): /etc/hosts first, then DNS.</summary>
    public static string? ReverseName(Shell sh, string ip)
    {
        foreach (var e in HostsEntries(sh)) if (e.Ip == ip) return e.Names[0];
        if (ip == Gateway && UsesResolved(sh.Distro)) return "_gateway";
        return DnsReverse(ip);
    }

    // ---------- Reachability ----------

    /// <summary>Can the computer reach the address? "ok", "netunreach", "hostunreach" or "timeout".</summary>
    public static string Reach(Shell sh, string ip)
    {
        if (IsLocal(sh, ip)) return "ok";
        if (!LinkUp(sh)) return "netunreach";
        if (ip.StartsWith(LanPrefix, StringComparison.Ordinal)) return new[] { Gateway, ServerIp, MyIpAddress }.Contains(ip) ? "ok" : "hostunreach";
        return InternetHostByIp(ip) is not null ? "ok" : "timeout";
    }

    /// <summary>A number between 0 and 1 that is always the same for the same input.</summary>
    private static double Noise(string seed)
    {
        uint h = 2166136261;
        unchecked
        {
            foreach (char c in seed) h = (h ^ (uint)c) * 16777619u;
        }
        return (h % 10_000) / 10_000.0;
    }

    /// <summary>Round-trip time in milliseconds for a packet to the address.</summary>
    public static double Rtt(Shell sh, string ip, int seq)
    {
        var n = Noise($"{ip}#{seq}");
        if (IsLocal(sh, ip)) return 0.025 + n * 0.03;
        if (ip == Gateway) return 0.45 + n * 0.5;
        if (ip.StartsWith(LanPrefix, StringComparison.Ordinal)) return 0.3 + n * 0.4;
        var @base = 6 + Noise(ip) * 25;
        return @base + n * 2.5;
    }

    public static int Ttl(Shell sh, string ip)
    {
        if (IsLocal(sh, ip) || ip.StartsWith(LanPrefix, StringComparison.Ordinal)) return 64;
        return 50 + (int)Math.Floor(Noise($"ttl{ip}") * 9);
    }

    /// <summary>The way there (for traceroute): the routers the packet passes, the target last.</summary>
    public static List<string?> Hops(Shell sh, string ip)
    {
        if (IsLocal(sh, ip) || ip.StartsWith(LanPrefix, StringComparison.Ordinal)) return new List<string?> { ip };
        var path = new List<string?> { Gateway, "100.64.0.1", "198.51.100.1", null, "203.0.113.1" };
        if (Reach(sh, ip) == "ok") path.Add(ip);
        return path;
    }

    // ---------- Interfaces and routes ----------

    /// <summary>Link-local IPv6 address made from the MAC address (EUI-64).</summary>
    private static string LinkLocal(string mac)
    {
        var b = mac.Split(':').Select(x => (int)Js.ParseInt(x, 16)).ToArray();
        b[0] ^= 2;
        static string Hex(int x, int y) => ((x << 8) | y).ToString("x", CultureInfo.InvariantCulture);
        return $"fe80::{Hex(b[0], b[1])}:{Hex(b[2], 0xff)}:{Hex(0xfe, b[3])}:{Hex(b[4], b[5])}";
    }

    public static List<Iface> Interfaces(Shell sh)
    {
        var up = LinkUp(sh);
        var mac = MyMac(sh);
        return new List<Iface>
        {
            new()
            {
                Index = 1,
                Name = "lo",
                Flags = "LOOPBACK,UP,LOWER_UP",
                Mtu = 65536,
                Qdisc = "noqueue",
                State = "UNKNOWN",
                LinkType = "loopback",
                Mac = "00:00:00:00:00:00",
                Brd = "00:00:00:00:00:00",
                Inet = new() { new IfaceInet { Addr = "127.0.0.1", Prefix = 8, Scope = "host", Extra = "", Lft = "forever" } },
                Inet6 = new() { new IfaceInet6 { Addr = "::1", Prefix = 128, Scope = "host", Extra = "noprefixroute" } },
            },
            new()
            {
                Index = 2,
                Name = Iface,
                Flags = up ? "BROADCAST,MULTICAST,UP,LOWER_UP" : "BROADCAST,MULTICAST",
                Mtu = 1500,
                Qdisc = "fq_codel",
                State = up ? "UP" : "DOWN",
                LinkType = "ether",
                Mac = mac,
                Brd = "ff:ff:ff:ff:ff:ff",
                Inet = new() { new IfaceInet { Addr = MyIp(sh), Prefix = 24, Brd = "192.168.1.255", Scope = "global", Extra = "dynamic noprefixroute", Lft = "85934sec" } },
                Inet6 = up ? new() { new IfaceInet6 { Addr = LinkLocal(mac), Prefix = 64, Scope = "link", Extra = "noprefixroute" } } : new(),
            },
        };
    }

    public static List<string> Routes(Shell sh)
    {
        if (!LinkUp(sh)) return new List<string>();
        var src = MyIp(sh);
        return new List<string>
        {
            $"default via {Gateway} dev {Iface} proto dhcp src {src} metric 100",
            $"192.168.1.0/24 dev {Iface} proto kernel scope link src {src} metric 100",
        };
    }

    /// <summary>The ARP table: neighbours on the local network the computer has talked to.</summary>
    public static List<string> Neighbours(Shell sh)
    {
        if (!LinkUp(sh)) return new List<string>();
        var list = new List<string> { $"{Gateway} dev {Iface} lladdr {GatewayMac} REACHABLE" };
        if (IsServer(sh)) list.Add($"{MyIpAddress} dev {Iface} lladdr {MyMacAddr} STALE");
        else list.Add($"{ServerIp} dev {Iface} lladdr {ServerMac} STALE");
        return list;
    }

    // ---------- Ports and services ----------

    private static readonly Regex PortLongRe = new("--port[= ]([0-9]+)", RegexOptions.CultureInvariant);
    private static readonly Regex PortShortRe = new(@"-p\s*([0-9]+)", RegexOptions.CultureInvariant);

    /// <summary>Port number a myserver command listens on ("--port 8080").</summary>
    public static int MyserverPort(string cmd)
    {
        var m = PortLongRe.Match(cmd);
        if (!m.Success) m = PortShortRe.Match(cmd);
        return m.Success ? ToPort(Js.Number(m.Groups[1].Value)) : 8080;
    }

    /// <summary>A JS number used as a port, as an int (numbers that cannot be ports become -1 and never match).</summary>
    internal static int ToPort(double n) => double.IsNaN(n) || n != Math.Floor(n) || n < int.MinValue || n > int.MaxValue ? -1 : (int)n;

    /// <summary>Listening ports, read from the process table.</summary>
    public static List<Listener> Listeners(Shell sh)
    {
        var list = new List<Listener>();
        foreach (var p in sh.Proc.Procs)
        {
            var name = ProcsLib.ProcName(p);
            if (name == "sshd")
            {
                list.Add(new Listener { Proto = "tcp", Addr = "0.0.0.0", Port = 22, Proc = p, Fd = 3 });
                list.Add(new Listener { Proto = "tcp", Addr = "[::]", Port = 22, Proc = p, Fd = 4 });
            }
            else if (name == "myserver")
            {
                list.Add(new Listener { Proto = "tcp", Addr = "0.0.0.0", Port = MyserverPort(p.Cmd), Proc = p, Fd = 3 });
            }
            else if (name == "chronyd")
            {
                list.Add(new Listener { Proto = "udp", Addr = "127.0.0.1", Port = 323, Proc = p, Fd = 5 });
                list.Add(new Listener { Proto = "udp", Addr = "[::1]", Port = 323, Proc = p, Fd = 6 });
            }
        }
        return list.StableSort((a, b) =>
        {
            int c = a.Proto == b.Proto ? 0 : a.Proto == "udp" ? -1 : 1;
            if (c != 0) return c;
            c = (a.Addr.StartsWith('[') ? 1 : 0) - (b.Addr.StartsWith('[') ? 1 : 0);
            if (c != 0) return c;
            return a.Port.CompareTo(b.Port);
        });
    }

    public static readonly Dictionary<int, string> ServiceNames = new()
    {
        [22] = "ssh",
        [53] = "domain",
        [80] = "http",
        [443] = "https",
        [8080] = "http-alt",
    };

    /// <summary>What listens on a port at an address, if anything: "ssh", "http", "https", "dns", "myserver" or null.</summary>
    public static string? Service(Shell sh, string ip, int port)
    {
        if (IsLocal(sh, ip))
        {
            var l = Listeners(sh).FirstOrDefault(x => x.Proto == "tcp" && x.Port == port);
            if (l is null) return null;
            return ProcsLib.ProcName(l.Proc) == "sshd" ? "ssh" : "myserver";
        }
        if (ip == Gateway) return port == 80 ? "http" : port == 53 ? "dns" : null;
        if (ip == ServerIp) return port == 22 ? "ssh" : port == 80 ? "http" : null;
        var host = InternetHostByIp(ip);
        if (host is null) return null;
        if (port == 443) return "https";
        if (port == 80) return "http";
        if (port == 53 && host.Dns) return "dns";
        return null;
    }

    /// <summary>Tries to open a TCP connection: "ok", "refused", "timeout", "netunreach" or "hostunreach".</summary>
    public static string Connect(Shell sh, string ip, int port)
    {
        var r = Reach(sh, ip);
        if (r != "ok") return r;
        if (Service(sh, ip, port) is not null) return "ok";
        // Computers on the local network say no at once, servers on the internet have a firewall and do not answer at all.
        return IsLocal(sh, ip) || ip.StartsWith(LanPrefix, StringComparison.Ordinal) ? "refused" : "timeout";
    }

    // ---------- Web pages ----------

    private static readonly Dictionary<int, string> Reasons = new()
    {
        [200] = "OK",
        [301] = "Moved Permanently",
        [400] = "Bad Request",
        [404] = "Not Found",
    };

    public static int ByteLength(string s) => Js.Utf8Length(s);

    private static string HttpDate() =>
        DateTimeOffset.FromUnixTimeMilliseconds(Js.Now()).UtcDateTime.ToString("r", CultureInfo.InvariantCulture);

    private static readonly Dictionary<string, Page> MyserverPages = MakeMyserverPages();

    private static Dictionary<string, Page> MakeMyserverPages()
    {
        var pages = new Dictionary<string, Page>
        {
            ["/"] = Html("Hello from myserver!", "This page is served by the process <b>myserver</b> on port 8080 of your own computer."),
            ["/about.html"] = Html("About myserver", "myserver 1.0 is a tiny practice web server. Its log is server.log in your documents folder."),
            ["/report"] = Text("Report: 12 requests today, 3 errors, 1 slow request.\n"),
        };
        pages["/index.html"] = pages["/"];
        return pages;
    }

    private static readonly Dictionary<string, Page> ServerPages = new()
    {
        ["/"] = Html("server.lan", "The school server. Log in with ssh and your user name, e.g. ssh student@server.lan"),
        ["/hello.txt"] = Text("Hello from the server!\n"),
    };

    private static readonly Dictionary<string, Page> RouterPages = new()
    {
        ["/"] = Html("Router login", "Log in to configure your home router (192.168.1.1)."),
    };

    /// <summary>
    /// The answer to an HTTP request. Assumes Connect() gave "ok". When the service does not speak HTTP,
    /// Response is null and Error is "not-http", "tls-error" or "empty".
    /// </summary>
    public static (HttpResponse? Response, string? Error) HttpRequest(Shell sh, string ip, int port, bool https, string hostHeader, string path)
    {
        var svc = Service(sh, ip, port);
        if (svc == "ssh") return (null, "not-http");
        if (svc == "dns") return (null, "empty");
        if (https && svc != "https") return (null, "tls-error");
        var p = path.Split('?')[0];
        if (p == "") p = "/";

        if (svc == "myserver") return (Respond("HTTP/1.0", MyserverPages.GetValueOrDefault(p), new() { ("Server", "myserver/1.0") }), null);
        if (ip == ServerIp) return (Respond("HTTP/1.1", ServerPages.GetValueOrDefault(p), new() { ("Server", "nginx/1.26.3") }), null);
        if (ip == Gateway) return (Respond("HTTP/1.1", RouterPages.GetValueOrDefault(p), new() { ("Server", "lighttpd/1.4.76") }), null);

        var host = InternetHostByIp(ip)!;
        if (!https && svc == "https")
        {
            return (Respond("HTTP/1.1", Html("400 The plain HTTP request was sent to HTTPS port", "Use https:// instead."), new(), 400), null);
        }
        if (!https && host.RedirectHttp)
        {
            var location = $"https://{hostHeader}{p}";
            var body = "<html>\r\n<head><title>301 Moved Permanently</title></head>\r\n<body>\r\n<center><h1>301 Moved Permanently</h1></center>\r\n<hr><center>nginx</center>\r\n</body>\r\n</html>\r\n";
            return (new HttpResponse
            {
                Status = 301,
                Reason = Reasons[301],
                Version = "HTTP/1.1",
                Headers = new()
                {
                    ("Server", "nginx"),
                    ("Date", HttpDate()),
                    ("Content-Type", "text/html"),
                    ("Content-Length", Js.Num(ByteLength(body))),
                    ("Connection", "keep-alive"),
                    ("Location", location),
                },
                Body = body,
            }, null);
        }
        return (Respond(https ? "HTTP/2" : "HTTP/1.1", host.Pages.GetValueOrDefault(p), new()), null);
    }

    private static HttpResponse Respond(string version, Page? page, List<(string Key, string Value)> extra, int? status = null)
    {
        var st = status ?? (page is not null ? 200 : 404);
        var p = page ?? Html("404 Not Found", "The requested URL was not found on this server.");
        var headers = new List<(string Key, string Value)>
        {
            ("Content-Type", p.Type),
            ("Content-Length", Js.Num(ByteLength(p.Body))),
            ("Date", HttpDate()),
        };
        headers.AddRange(extra);
        var h2 = version == "HTTP/2";
        return new HttpResponse
        {
            Status = st,
            Reason = Reasons.GetValueOrDefault(st) ?? "",
            Version = version,
            Headers = h2 ? headers.Select(h => (h.Key.ToLowerInvariant(), h.Value)).ToList() : headers,
            Body = p.Body,
        };
    }
}
