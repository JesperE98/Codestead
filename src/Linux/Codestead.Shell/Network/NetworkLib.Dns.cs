namespace Codestead.Shell;

// NetworkLib: DNS, /etc/hosts and name lookups.

public static partial class NetworkLib
{
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
}
