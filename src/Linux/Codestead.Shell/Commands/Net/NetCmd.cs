using static Codestead.Shell.NetworkLib;

namespace Codestead.Shell.Commands;

// Port of src/shell/commands/net.ts – network commands: ip, ping, ss, dig, host, nslookup, getent,
// traceroute, curl, wget and the practice server myserver. The network itself is in Network/ (NetworkLib).

public static partial class NetCmd
{
    private static void Note(CmdCtx ctx, string key, params (string Name, object? Value)[] args) =>
        ctx.Err($"{UtilCmd.Color.Dim}{ctx.Sh.Msg(key, args)}{UtilCmd.Color.Reset}\n");

    private static bool IsRoot(CmdCtx ctx) => ctx.Sh.CurrentUser().Uid == 0;

    private static bool IsInteger(double n) => !double.IsNaN(n) && !double.IsInfinity(n) && n == Math.Floor(n);

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

    private static string? Header(HttpResponse r, string name)
    {
        foreach (var (k, v) in r.Headers) if (k.ToLowerInvariant() == name) return v;
        return null;
    }

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

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new() { Ip, Ping, Ss, Dig, Host, Nslookup, Getent, Traceroute, Curl, Wget, Myserver };
}
