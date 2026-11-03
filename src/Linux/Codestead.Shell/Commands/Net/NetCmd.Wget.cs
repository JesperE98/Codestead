using static Codestead.Shell.NetworkLib;

namespace Codestead.Shell.Commands;

// The wget command: download files from the web.

public static partial class NetCmd
{
    private static readonly Regex AnySchemeRe = new("^[A-Za-z0-9_]+://", RegexOptions.CultureInvariant);

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
}
