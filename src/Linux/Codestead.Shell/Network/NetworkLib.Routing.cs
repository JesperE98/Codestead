namespace Codestead.Shell;

// NetworkLib: reachability (ping/traceroute timing), interfaces, routes and neighbours.

public static partial class NetworkLib
{
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
}
