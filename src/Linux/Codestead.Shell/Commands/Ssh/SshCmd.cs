using System.Runtime.CompilerServices;

namespace Codestead.Shell.Commands;

// Port of src/shell/commands/ssh.ts – ssh, ssh-keygen and ssh-copy-id. The server server.lan
// (192.168.1.10) is a small shell of its own (Debian) that lives in memory as long as the app is
// open. Commands sent with "ssh student@server.lan COMMAND" really run there (the student's own user name).

public static partial class SshCmd
{
    private static string Dim(Shell sh, string key, params (string Name, object? Value)[] args) => $"{UtilCmd.Color.Dim}{sh.Msg(key, args)}{UtilCmd.Color.Reset}\n";

    private const string HostFp = "SHA256:q7Jx3MmP0yZk8VbW1sTn4dLr9HcE2uFgA6oYiKjN5Rw";
    private const string HostKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHk3c2VydmVyLmxhbi1zaW11bGVyYWQtdsOkcmRueWNrZWw";

    // ---------- The server ----------

    private static readonly ConditionalWeakTable<Shell, Shell> Servers = new();

    private static string KeyFlag(Shell sh) => $"net:ssh-key:{sh.CurrentUser().Name}@{NetworkLib.ServerName}";

    private static bool HasKeyFlag(Shell sh) => sh.Flags.TryGetValue(KeyFlag(sh), out var v) && v;

    /// <summary>The server that belongs to the student's computer (created the first time it is needed).</summary>
    public static Shell ServerFor(Shell sh)
    {
        // The server speaks the student's language too: same user name, files in the same language.
        if (Servers.TryGetValue(sh, out var cached) && cached.World != sh.World) Servers.Remove(sh);
        if (!Servers.TryGetValue(sh, out var server))
        {
            server = Shell.Create("debian", sh.World.Lang);
            var distro = Js.Clone(server.Distro);
            distro.Hostname = NetworkLib.ServerName;
            server.Distro = distro;
            NetworkLib.MarkAsServer(server);
            var root = server.RootUser();
            server.Vfs.WriteFile("/etc/hostname", $"{NetworkLib.ServerName}\n", root);
            server.Vfs.WriteFile("/etc/hosts", $"127.0.0.1\tlocalhost\n127.0.1.1\t{NetworkLib.ServerName}.lan {NetworkLib.ServerName}\n::1\t\tlocalhost ip6-localhost ip6-loopback\n", root);
            server.Vfs.WriteFile($"{server.World.Home}/{server.World["welcomeFile"]}", server.World.File("welcome"), server.CurrentUser());
            server.Proc.Procs = server.Proc.Procs.Where(p => p.Pid != ProcsLib.RunawayPid).ToList();
            Servers.AddOrUpdate(sh, server);
        }
        server.Lang = sh.Lang;
        // The key ssh-copy-id installed (the flag is saved, the server's file system is not).
        var pub = PublicKey(sh);
        if (HasKeyFlag(sh) && pub is not null) AddAuthorizedKey(server, pub);
        return server;
    }

    private static void AddAuthorizedKey(Shell server, string pub)
    {
        var name = server.World.User;
        var user = server.GetUser(name);
        var dir = $"{server.World.Home}/.ssh";
        if (server.Vfs.TryLookup(dir, user) is null) server.Vfs.Insert(dir, VfsLib.MakeDir(name, Js.Oct(700), Js.Obj<FsNode>(), name), user);
        var file = $"{dir}/authorized_keys";
        var existing = server.Vfs.TryLookup(file, user)?.Content ?? "";
        if (!existing.Contains(pub.Trim(), StringComparison.Ordinal)) server.Vfs.WriteFile(file, existing + pub.Trim() + "\n", user);
    }

    // ---------- Keys ----------

    private static string SshDir(Shell sh) => $"{sh.CurrentUser().Home}/.ssh";

    private static string? PublicKey(Shell sh, string? path = null)
    {
        var user = sh.CurrentUser();
        var paths = !string.IsNullOrEmpty(path)
            ? new List<string> { path.EndsWith(".pub", StringComparison.Ordinal) ? path : path + ".pub" }
            : new[] { "id_ed25519.pub", "id_ecdsa.pub", "id_rsa.pub" }.Select(n => $"{SshDir(sh)}/{n}").ToList();
        foreach (var p in paths)
        {
            var node = sh.Vfs.TryLookup(sh.Resolve(p), user);
            if (node?.Type == "file" && !string.IsNullOrEmpty(node.Content)) return node.Content;
        }
        return null;
    }

    private static bool HasPrivateKey(Shell sh) =>
        new[] { "id_ed25519", "id_ecdsa", "id_rsa" }.Any(n => sh.Vfs.TryLookup($"{SshDir(sh)}/{n}", sh.CurrentUser())?.Type == "file");

    private static bool EnsureSshDir(Shell sh, Sink io, bool announce)
    {
        var dir = SshDir(sh);
        var user = sh.CurrentUser();
        if (sh.Vfs.TryLookup(dir, user) is not null) return true;
        try
        {
            sh.Vfs.Insert(dir, VfsLib.MakeDir(user.Name, Js.Oct(700), Js.Obj<FsNode>(), user.Groups.FirstOrDefault()), user);
            if (announce) io.Out($"Created directory '{dir}'.\n");
            return true;
        }
        catch (FsError e)
        {
            io.Err($"{dir}: {e.Message}\n");
            return false;
        }
    }

    // ---------- known_hosts and login ----------

    private sealed class Dest
    {
        public string User { get; init; } = "";
        public string Host { get; init; } = "";
        public double Port { get; init; }
    }

    private static string HostKeyName(Dest d) => d.Port == 22 ? d.Host : $"[{d.Host}]:{Js.Num(d.Port)}";

    private static bool IsKnown(Shell sh, Dest d)
    {
        var content = sh.Vfs.TryLookup($"{SshDir(sh)}/known_hosts", sh.CurrentUser())?.Content ?? "";
        return content.Split('\n').Any(l => l.Split(' ')[0].Split(',').Contains(HostKeyName(d)));
    }

    private static readonly Dictionary<string, string> Why = new()
    {
        ["refused"] = "Connection refused",
        ["timeout"] = "Connection timed out",
        ["netunreach"] = "Network is unreachable",
        ["hostunreach"] = "No route to host",
    };

    /// <summary>
    /// Connects to the server: name lookup, TCP, host key (asks "yes/no" the first time) and then
    /// <paramref name="then"/>. Returns the exit code, or 0 if a question is waiting.
    /// </summary>
    private static int SshConnect(CmdCtx ctx, Dest d, Func<Sink, int> then)
    {
        var sh = ctx.Sh;
        var resolved = NetworkLib.ResolveHost(sh, d.Host);
        if (resolved is not ResolvedOk r)
        {
            ctx.Err($"ssh: Could not resolve hostname {d.Host}: {NetworkLib.ResolveErrorText(((ResolvedFail)resolved).Error)}\n");
            return 255;
        }
        var port = NetworkLib.ToPort(d.Port);
        var c = NetworkLib.Connect(sh, r.Ip, port);
        if (c != "ok")
        {
            ctx.Err($"ssh: connect to host {d.Host} port {Js.Num(d.Port)}: {Why[c]}\n");
            return 255;
        }
        if (NetworkLib.Service(sh, r.Ip, port) != "ssh")
        {
            ctx.Err($"kex_exchange_identification: Connection closed by remote host\nConnection closed by {r.Ip} port {Js.Num(d.Port)}\n");
            return 255;
        }
        if (r.Ip != NetworkLib.ServerIp)
        {
            var local = NetworkLib.IsLocal(sh, r.Ip);
            ctx.Err(local ? Dim(sh, "ssh.ownComputerOnlyServer") : Dim(sh, "ssh.onlyServer"));
            return 255;
        }
        if (IsKnown(sh, d)) return then(ctx);
        if (!sh.CanAskInteractively() || !ctx.IsTTY)
        {
            ctx.Err("Host key verification failed.\n");
            return 255;
        }
        var shown = r.Ip == d.Host ? d.Host : $"{d.Host} ({r.Ip})";
        ctx.Out($"The authenticity of host '{shown}' can't be established.\nED25519 key fingerprint is {HostFp}.\nThis key is not known by any other names.\n");
        int Answer(string text, Sink io)
        {
            var a = text.Trim();
            if (a == "yes" || a == HostFp)
            {
                if (!EnsureSshDir(sh, io, false)) return 255;
                try
                {
                    sh.Vfs.WriteFile($"{SshDir(sh)}/known_hosts", $"{HostKeyName(d)} {HostKey}\n", sh.CurrentUser(), true);
                }
                catch (FsError e)
                {
                    io.Err($"{SshDir(sh)}/known_hosts: {e.Message}\n");
                }
                io.Err($"Warning: Permanently added '{HostKeyName(d)}' (ED25519) to the list of known hosts.\n");
                return then(io);
            }
            if (a == "no")
            {
                io.Err("Host key verification failed.\n");
                return 255;
            }
            sh.AskText("Please type 'yes', 'no' or the fingerprint: ", Answer);
            return 0;
        }
        sh.AskText("Are you sure you want to continue connecting (yes/no/[fingerprint])? ", Answer);
        return 0;
    }

    /// <summary>Password or key. False if the login is denied.</summary>
    private static bool Authenticate(Shell sh, Dest d, Sink io)
    {
        var keyLogin = HasKeyFlag(sh) && HasPrivateKey(sh);
        if (!keyLogin)
        {
            io.Err($"{d.User}@{d.Host}'s password: {Dim(sh, "common.skipsPassword")}");
        }
        if (d.User != sh.World.User)
        {
            io.Err($"{d.User}@{d.Host}: Permission denied (publickey,password).\n");
            return false;
        }
        return true;
    }

    // ---------- ~/.ssh/config ----------

    /// <summary>What ~/.ssh/config says about a host (null = not set).</summary>
    private sealed class HostConfig
    {
        public string? HostName { get; set; }
        public string? User { get; set; }
        public double? Port { get; set; }
    }

    /// <summary>Options ssh knows but the simulator only accepts (they change nothing here).</summary>
    private static readonly HashSet<string> AcceptedOptions = new(StringComparer.OrdinalIgnoreCase)
    {
        "identityfile", "identitiesonly", "forwardagent", "serveraliveinterval", "serveralivecountmax", "addkeystoagent",
        "stricthostkeychecking", "userknownhostsfile", "compression", "proxyjump", "localforward", "remoteforward",
        "loglevel", "connecttimeout", "preferredauthentications", "passwordauthentication", "hostkeyalias", "include",
        "requesttty", "setenv", "sendenv", "controlmaster", "controlpath", "controlpersist", "visualhostkey",
    };

    private static readonly Regex ConfigLineRe = new(@"^\s*(\S+?)(?:\s*=\s*|\s+)(.*?)\s*$", RegexOptions.CultureInvariant);

    private static bool HostMatches(string pattern, string host)
    {
        var re = new Regex("^" + Regex.Escape(pattern).Replace("\\*", ".*").Replace("\\?", ".") + "$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        return re.IsMatch(host);
    }

    /// <summary>
    /// Reads ~/.ssh/config for <paramref name="host"/>. Like ssh, the first value found wins, and the file is
    /// refused if others may write to it. Returns an error message (for stderr) when ssh would stop.
    /// </summary>
    private static (HostConfig Config, string? Error) ConfigFor(Shell sh, string host)
    {
        var cfg = new HostConfig();
        var user = sh.CurrentUser();
        var path = $"{SshDir(sh)}/config";
        var node = sh.Vfs.TryLookup(path, user);
        if (node?.Type != "file") return (cfg, null);
        if ((node.Mode & Js.Oct(22)) != 0 || (node.Owner != user.Name && node.Owner != "root"))
            return (cfg, $"Bad owner or permissions on {path}\n");
        bool active = true;
        var bad = new List<string>();
        var lines = (node.Content ?? "").Split('\n');
        for (int i = 0; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            if (line == "" || line.StartsWith('#')) continue;
            var m = ConfigLineRe.Match(line);
            var key = m.Success ? m.Groups[1].Value : line;
            var value = m.Success ? m.Groups[2].Value.Trim('"') : "";
            switch (key.ToLowerInvariant())
            {
                case "host":
                {
                    var patterns = value.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    active = patterns.Any(p => !p.StartsWith('!') && HostMatches(p, host)) && !patterns.Any(p => p.StartsWith('!') && HostMatches(p[1..], host));
                    break;
                }
                case "match":
                    active = value.Trim().Equals("all", StringComparison.OrdinalIgnoreCase);
                    break;
                case "hostname":
                    if (active) cfg.HostName ??= value;
                    break;
                case "user":
                    if (active) cfg.User ??= value;
                    break;
                case "port":
                {
                    var port = Js.Number(value);
                    if (double.IsNaN(port) || port < 1 || port > 65535 || port != Math.Floor(port))
                        return (cfg, $"{path} line {i + 1}: Badly formatted port number.\n");
                    if (active) cfg.Port ??= port;
                    break;
                }
                default:
                    if (!AcceptedOptions.Contains(key)) bad.Add($"{path}: line {i + 1}: Bad configuration option: {key.ToLowerInvariant()}\n");
                    break;
            }
        }
        if (bad.Count > 0) return (cfg, string.Concat(bad) + $"{path}: terminating, {bad.Count} bad configuration options\n");
        return (cfg, null);
    }

    /// <summary>
    /// [user@]host with ~/.ssh/config applied: a short name (Host) becomes its HostName, and User and Port
    /// come from the file unless they were given on the command line.
    /// </summary>
    private static (Dest? Dest, string? Error) ParseDest(string raw, string? loginName, Shell sh, double? port)
    {
        var at = raw.LastIndexOf('@');
        var name = at >= 0 ? raw[(at + 1)..] : raw;
        var (cfg, error) = ConfigFor(sh, name);
        if (error is not null) return (null, error);
        var user = at >= 0 ? raw[..at] : (loginName ?? cfg.User ?? sh.CurrentUser().Name);
        return (new Dest { User = user, Host = (cfg.HostName ?? name).ToLowerInvariant(), Port = port ?? cfg.Port ?? 22 }, null);
    }

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new() { Ssh, SshKeygen, SshCopyId };
}
