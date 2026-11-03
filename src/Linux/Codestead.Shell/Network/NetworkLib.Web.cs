namespace Codestead.Shell;

// NetworkLib: answering HTTP requests (curl/wget).

public static partial class NetworkLib
{
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
