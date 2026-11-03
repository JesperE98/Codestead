using static Codestead.Shell.NetworkLib;

namespace Codestead.Shell.Commands;

// The curl command: transfer data from or to a server (URL).

public static partial class NetCmd
{
    private static readonly Regex QuotedRe = new("'(.+?)'", RegexOptions.CultureInvariant);

    private static string StatusLine(HttpResponse r) =>
        r.Version == "HTTP/2" ? $"HTTP/2 {r.Status}" : $"{r.Version} {r.Status} {r.Reason}";

    private static string HeaderText(HttpResponse r) =>
        string.Join("\n", new[] { StatusLine(r) }.Concat(r.Headers.Select(h => $"{h.Key}: {h.Value}"))) + "\n\n";

    private static string ConnectError(string kind, string host, string port) => kind switch
    {
        "refused" or "netunreach" => $"curl: (7) Failed to connect to {host} port {port} after 0 ms: Couldn't connect to server",
        "hostunreach" => $"curl: (7) Failed to connect to {host} port {port} after 3071 ms: Couldn't connect to server",
        _ => $"curl: (28) Failed to connect to {host} port {port} after 134023 ms: Timeout was reached",
    };

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
}
