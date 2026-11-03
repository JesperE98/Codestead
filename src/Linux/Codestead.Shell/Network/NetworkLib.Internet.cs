namespace Codestead.Shell;

// NetworkLib: the pretend internet – its hosts and their web pages.

public static partial class NetworkLib
{
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
}
