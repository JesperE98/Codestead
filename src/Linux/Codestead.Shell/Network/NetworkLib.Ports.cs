namespace Codestead.Shell;

// NetworkLib: listening ports, the services behind them and TCP connections.

public static partial class NetworkLib
{
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
}
