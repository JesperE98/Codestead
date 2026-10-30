using System.Runtime.CompilerServices;

namespace Codestead.Shell.Commands;

// Port of src/shell/commands/ssh.ts – ssh, ssh-keygen and ssh-copy-id. The server server.lan
// (192.168.1.10) is a small shell of its own (Debian) that lives in memory as long as the app is
// open. Commands sent with "ssh elev@server.lan COMMAND" really run there.

public static partial class SshCmd
{
    private static string Dim(Shell sh, string sv, string en) => $"{UtilCmd.Color.Dim}{sh.Msg(sv, en)}{UtilCmd.Color.Reset}\n";

    private const string HostFp = "SHA256:q7Jx3MmP0yZk8VbW1sTn4dLr9HcE2uFgA6oYiKjN5Rw";
    private const string HostKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHk3c2VydmVyLmxhbi1zaW11bGVyYWQtdsOkcmRueWNrZWw";

    // ---------- The server ----------

    private static readonly ConditionalWeakTable<Shell, Shell> Servers = new();

    private static string KeyFlag(Shell sh) => $"net:ssh-key:{sh.CurrentUser().Name}@{NetworkLib.ServerName}";

    private static bool HasKeyFlag(Shell sh) => sh.Flags.TryGetValue(KeyFlag(sh), out var v) && v;

    /// <summary>The server that belongs to the student's computer (created the first time it is needed).</summary>
    public static Shell ServerFor(Shell sh)
    {
        if (!Servers.TryGetValue(sh, out var server))
        {
            server = Shell.Create("debian");
            var distro = Js.Clone(server.Distro);
            distro.Hostname = NetworkLib.ServerName;
            server.Distro = distro;
            NetworkLib.MarkAsServer(server);
            var root = server.RootUser();
            server.Vfs.WriteFile("/etc/hostname", $"{NetworkLib.ServerName}\n", root);
            server.Vfs.WriteFile("/etc/hosts", $"127.0.0.1\tlocalhost\n127.0.1.1\t{NetworkLib.ServerName}.lan {NetworkLib.ServerName}\n::1\t\tlocalhost ip6-localhost ip6-loopback\n", root);
            server.Vfs.WriteFile("/home/elev/välkommen.txt", "Välkommen till servern! / Welcome to the server!\n", server.CurrentUser());
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
        var user = server.GetUser("elev");
        const string dir = "/home/elev/.ssh";
        if (server.Vfs.TryLookup(dir, user) is null) server.Vfs.Insert(dir, VfsLib.MakeDir("elev", Js.Oct(700), Js.Obj<FsNode>(), "elev"), user);
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

    private const string B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    private static string RandomB64(int n) =>
        string.Concat(Enumerable.Range(0, n).Select(_ => B64[(int)Math.Floor(Js.Random() * 64)]));

    /// <summary>The "randomart" ssh-keygen draws (the drunken bishop algorithm).</summary>
    private static string RandomArt(string type, double bits, string fp)
    {
        var field = new int[9, 17];
        int x = 8;
        int y = 4;
        foreach (char ch in fp.Slice(7))
        {
            int b = ch;
            for (int i = 0; i < 4; i++)
            {
                x = Math.Max(0, Math.Min(16, x + ((b & 1) != 0 ? 1 : -1)));
                y = Math.Max(0, Math.Min(8, y + ((b & 2) != 0 ? 1 : -1)));
                field[y, x]++;
                b >>= 2;
            }
        }
        const string chars = " .o+=*BOX@%&#/^";
        var rows = new List<string>();
        for (int ry = 0; ry < 9; ry++)
        {
            var row = new StringBuilder();
            for (int rx = 0; rx < 17; rx++)
                row.Append(rx == 8 && ry == 4 ? 'S' : rx == x && ry == y ? 'E' : chars[Math.Min(field[ry, rx], chars.Length - 1)]);
            rows.Add(row.ToString());
        }
        var title = $"[{type.ToUpperInvariant()} {Js.Num(bits)}]";
        var top = "+" + title.PadLeft((17 + title.Length) / 2, '-').PadRight(17, '-') + "+";
        return string.Join("\n", new[] { top }.Concat(rows.Select(r => $"|{r}|")).Append("+----[SHA256]-----+")) + "\n";
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
            ctx.Err(Dim(sh,
                local
                    ? "(Det här är din egen dator – sshd lyssnar, men i simulatorn kan du bara logga in på server.lan, 192.168.1.10.)"
                    : "(I simulatorn kan du bara logga in på server.lan, 192.168.1.10.)",
                local
                    ? "(This is your own computer – sshd is listening, but in the simulator you can only log in to server.lan, 192.168.1.10.)"
                    : "(In the simulator you can only log in to server.lan, 192.168.1.10.)"));
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
            io.Err($"{d.User}@{d.Host}'s password: {Dim(sh, "(simulatorn hoppar över lösenordet)", "(the simulator skips the password)")}");
        }
        if (d.User != "elev")
        {
            io.Err($"{d.User}@{d.Host}: Permission denied (publickey,password).\n");
            return false;
        }
        return true;
    }

    private static Dest ParseDest(string raw, string? loginName, Shell sh, double port)
    {
        var at = raw.LastIndexOf('@');
        var user = at >= 0 ? raw[..at] : (loginName ?? sh.CurrentUser().Name);
        return new Dest { User = user, Host = (at >= 0 ? raw[(at + 1)..] : raw).ToLowerInvariant(), Port = port };
    }

    private static readonly Regex ValueOptRe = new("^-[pliFoJLRDEWbcmQSweB]\\z", RegexOptions.CultureInvariant);
    private static readonly Regex PortOptRe = new("^-p[0-9]+\\z", RegexOptions.CultureInvariant);

    private static readonly CommandDef Ssh = new()
    {
        Name = "ssh",
        Summary = "Loggar in på eller kör kommandon på en annan dator",
        SummaryEn = "Log in to or run commands on another computer",
        Man = """
            NAMN
                   ssh - Secure Shell: logga in på en annan dator krypterat

            SYNOPSIS
                   ssh [-p PORT] [ANVÄNDARE@]VÄRD [KOMMANDO]

            BESKRIVNING
                   Ansluter till SSH-servern (sshd, port 22) på en annan dator. Med ett
                   KOMMANDO körs det på den andra datorn och resultatet visas här.
                   Första gången frågar ssh om du litar på datorns värdnyckel; svaret
                   sparas i ~/.ssh/known_hosts.

                   I simulatorn finns servern server.lan (192.168.1.10) med
                   användaren elev. Interaktiva inloggningar stöds inte – skriv
                   kommandot efter värden.

            FLAGGOR
                   -p PORT   anslut till en annan port än 22
                   -l NAMN   användarnamn (samma som NAMN@VÄRD)

            EXEMPEL
                   ssh elev@server.lan hostname
                   ssh elev@server.lan 'ls -l; cat välkommen.txt'
                   ssh elev@192.168.1.10 uptime
            """,
        ManEn = """
            NAME
                   ssh - Secure Shell: log in to another computer, encrypted

            SYNOPSIS
                   ssh [-p PORT] [USER@]HOST [COMMAND]

            DESCRIPTION
                   Connects to the SSH server (sshd, port 22) on another computer. With
                   a COMMAND, it runs on the other computer and the result is shown
                   here. The first time, ssh asks whether you trust the computer's host
                   key; the answer is saved in ~/.ssh/known_hosts.

                   The simulator has the server server.lan (192.168.1.10) with the user
                   elev. Interactive logins are not supported – put the command after
                   the host.

            OPTIONS
                   -p PORT   connect to a port other than 22
                   -l NAME   user name (same as NAME@HOST)

            EXAMPLES
                   ssh elev@server.lan hostname
                   ssh elev@server.lan 'ls -l; cat välkommen.txt'
                   ssh elev@192.168.1.10 uptime
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var args = new List<string>(ctx.Args);
            double port = 22;
            string? login = null;
            string? dest = null;
            while (args.Count > 0)
            {
                var a = args[0];
                args.RemoveAt(0);
                if (a == "-V")
                {
                    ctx.Err("OpenSSH_10.0p2, OpenSSL 3.5.1 1 Jul 2025\n");
                    return 0;
                }
                if (ValueOptRe.IsMatch(a))
                {
                    if (args.Count == 0)
                    {
                        ctx.Err($"ssh: option requires an argument -- {a[1]}\n");
                        return 255;
                    }
                    var v = args[0];
                    args.RemoveAt(0);
                    if (a == "-p") port = Js.Number(v);
                    if (a == "-l") login = v;
                    continue;
                }
                if (PortOptRe.IsMatch(a))
                {
                    port = Js.Number(a[2..]);
                    continue;
                }
                if (a.StartsWith('-')) continue;
                dest = a;
                break;
            }
            if (dest is null)
            {
                ctx.Err(
                    "usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [-b bind_address]\n           [-c cipher_spec] [-D [bind_address:]port] [-E log_file]\n           [-e escape_char] [-F configfile] [-I pkcs11] [-i identity_file]\n           [-J destination] [-L address] [-l login_name] [-m mac_spec]\n           [-O ctl_cmd] [-o option] [-P tag] [-p port] [-R address]\n           [-S ctl_path] [-W host:port] [-w local_tun[:remote_tun]]\n           destination [command [argument ...]]\n");
                return 255;
            }
            if (double.IsNaN(port) || double.IsInfinity(port) || port != Math.Floor(port) || port < 1 || port > 65535)
            {
                ctx.Err($"Bad port '{Js.Num(port)}'\n");
                return 255;
            }
            var d = ParseDest(dest, login, sh, port);
            var command = string.Join(" ", args);
            return SshConnect(ctx, d, io =>
            {
                if (!Authenticate(sh, d, io)) return 255;
                var server = ServerFor(sh);
                if (command.Trim() == "")
                {
                    io.Out(
                        $"Linux {NetworkLib.ServerName} {server.Distro.Kernel} #1 SMP PREEMPT_DYNAMIC Debian x86_64\n\n" +
                        "The programs included with the Debian GNU/Linux system are free software;\n" +
                        "the exact distribution terms for each program are described in the\n" +
                        "individual files in /usr/share/doc/*/copyright.\n\n" +
                        "Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent\npermitted by applicable law.\n" +
                        $"Last login: Thu Oct 29 18:03:12 2026 from {NetworkLib.MyIpAddress}\n");
                    io.Err(Dim(sh,
                        $"(I simulatorn kan du inte få ett interaktivt skal på servern. Skriv kommandot direkt efter värden, t.ex.  ssh {dest} 'ls -l')",
                        $"(The simulator can't give you an interactive shell on the server. Put the command right after the host, e.g.  ssh {dest} 'ls -l')"));
                    io.Err($"Connection to {d.Host} closed.\n");
                    return 0;
                }
                var result = server.Execute(command);
                server.Cancel();
                io.Out(result.Output);
                return result.ExitCode;
            });
        },
    };

    // ---------- ssh-keygen ----------

    private static readonly CommandDef SshKeygen = new()
    {
        Name = "ssh-keygen",
        Summary = "Skapar ett SSH-nyckelpar",
        SummaryEn = "Generate an SSH key pair",
        Man = """
            NAMN
                   ssh-keygen - skapa och hantera SSH-nycklar

            SYNOPSIS
                   ssh-keygen [-t ed25519|rsa] [-f FIL] [-N LÖSENFRAS] [-C KOMMENTAR]
                   ssh-keygen -R VÄRD

            BESKRIVNING
                   Skapar ett nyckelpar: en privat nyckel (t.ex. ~/.ssh/id_ed25519)
                   som aldrig får lämna datorn, och en publik nyckel (.pub) som du
                   lägger på servrar du vill logga in på, t.ex. med ssh-copy-id.

            FLAGGOR
                   -t TYP     nyckeltyp, ed25519 (standard) eller rsa
                   -f FIL     var den privata nyckeln sparas
                   -N FRAS    lösenfras ('' för ingen)
                   -C TEXT    kommentar i den publika nyckeln
                   -R VÄRD    ta bort VÄRD ur ~/.ssh/known_hosts

            EXEMPEL
                   ssh-keygen
                   ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519
            """,
        ManEn = """
            NAME
                   ssh-keygen - generate and manage SSH keys

            SYNOPSIS
                   ssh-keygen [-t ed25519|rsa] [-f FILE] [-N PASSPHRASE] [-C COMMENT]
                   ssh-keygen -R HOST

            DESCRIPTION
                   Creates a key pair: a private key (e.g. ~/.ssh/id_ed25519) that must
                   never leave the computer, and a public key (.pub) that you put on
                   servers you want to log in to, for example with ssh-copy-id.

            OPTIONS
                   -t TYPE    key type, ed25519 (default) or rsa
                   -f FILE    where the private key is saved
                   -N PHRASE  passphrase ('' for none)
                   -C TEXT    comment in the public key
                   -R HOST    remove HOST from ~/.ssh/known_hosts

            EXAMPLES
                   ssh-keygen
                   ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "qy", Values = "tfNCbR" });
            if (o.Error is not null)
            {
                ctx.Err($"ssh-keygen: {o.Error}\nusage: ssh-keygen [-q] [-a rounds] [-b bits] [-C comment] [-f output_keyfile]\n                  [-m format] [-N new_passphrase] [-O option]\n                  [-t dsa | ecdsa | ecdsa-sk | ed25519 | ed25519-sk | rsa]\n");
                return 1;
            }
            var user = sh.CurrentUser();
            if (o.Values.TryGetValue("R", out var removeHost))
            {
                var file = $"{SshDir(sh)}/known_hosts";
                var node = sh.Vfs.TryLookup(file, user);
                if (node is null)
                {
                    ctx.Err($"do_known_hosts: hostkeys_foreach failed for {file}: No such file or directory\n");
                    return 255;
                }
                var lines = (node.Content ?? "").Split('\n').Where(l => l != "").ToList();
                var keep = lines.Where(l => !l.Split(' ')[0].Split(',').Contains(removeHost)).ToList();
                sh.Vfs.WriteFile(file, string.Concat(keep.Select(l => l + "\n")), user);
                if (keep.Count != lines.Count)
                {
                    ctx.Out($"# Host {removeHost} found: line 1\n{file} updated.\nOriginal contents retained as {file}.old\n");
                    sh.Vfs.WriteFile(file + ".old", string.Concat(lines.Select(l => l + "\n")), user);
                }
                return 0;
            }
            var type = (o.Values.Get("t") ?? "ed25519").ToLowerInvariant();
            if (!new[] { "ed25519", "rsa", "ecdsa" }.Contains(type))
            {
                ctx.Err($"unknown key type {type}\n");
                return 1;
            }
            double bits = type == "rsa" ? Js.Number(o.Values.Get("b") ?? "3072") : 256;
            var defFile = $"{SshDir(sh)}/id_{type}";
            var quiet = o.Flags.Contains("q");
            var interactive = sh.CanAskInteractively() && ctx.IsTTY;
            var comment = o.Values.Get("C") ?? $"{user.Name}@{sh.Distro.Hostname}";

            int Generate(string file, Sink io)
            {
                if (file.StartsWith(SshDir(sh) + "/", StringComparison.Ordinal) && !EnsureSshDir(sh, io, !quiet)) return 1;
                var fp = $"SHA256:{RandomB64(43)}";
                var pubBody =
                    type == "rsa"
                        ? $"ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQ{RandomB64(180)}"
                        : type == "ecdsa"
                            ? $"ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBB{RandomB64(86)}="
                            : $"ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI{RandomB64(43)}";
                var priv = $"-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\n{RandomB64(70)}\n{RandomB64(70)}\n(simulerad privat nyckel – visa den aldrig för någon!)\n-----END OPENSSH PRIVATE KEY-----\n";
                try
                {
                    var path = sh.Resolve(file);
                    sh.Vfs.WriteFile(path, priv, user);
                    sh.Vfs.Lookup(path, user).Mode = Js.Oct(600);
                    sh.Vfs.WriteFile(path + ".pub", $"{pubBody} {comment}\n", user);
                    sh.Vfs.Lookup(path + ".pub", user).Mode = Js.Oct(644);
                }
                catch (FsError e)
                {
                    io.Err($"Saving key \"{file}\" failed: {e.Message}\n");
                    return 1;
                }
                if (!quiet)
                {
                    io.Out(
                        $"Your identification has been saved in {file}\nYour public key has been saved in {file}.pub\n" +
                        $"The key fingerprint is:\n{fp} {comment}\nThe key's randomart image is:\n{RandomArt(type, bits, fp)}");
                }
                return 0;
            }

            int AskPassphrase(string file, Sink io)
            {
                if (o.Values.ContainsKey("N") || !interactive) return Generate(file, io);
                sh.AskText($"Enter passphrase for \"{file}\" (empty for no passphrase): ", (first, _) =>
                {
                    sh.AskText("Enter same passphrase again: ", (second, io2) =>
                    {
                        if (first != second)
                        {
                            io2.Err("Passphrases do not match.  Try again.\n");
                            return 1;
                        }
                        return Generate(file, io2);
                    });
                    return 0;
                });
                return 0;
            }

            int CheckExisting(string file, Sink io)
            {
                if (sh.Vfs.TryLookup(sh.Resolve(file), user) is null) return AskPassphrase(file, io);
                if (!interactive)
                {
                    io.Err($"{file} already exists.\n");
                    return 1;
                }
                io.Out($"{file} already exists.\n");
                sh.Ask("Overwrite (y/n)? ", false, (yes, io2) => yes ? AskPassphrase(file, io2) : 1);
                return 0;
            }

            if (!quiet) ctx.Out($"Generating public/private {type} key pair.\n");
            if (o.Values.ContainsKey("f") || !interactive) return CheckExisting(o.Values.Get("f") ?? defFile, ctx);
            sh.AskText($"Enter file in which to save the key ({defFile}): ", (text, io) => CheckExisting(text.Trim() is { Length: > 0 } t ? t : defFile, io));
            return 0;
        },
    };

    // ---------- ssh-copy-id ----------

    private static readonly CommandDef SshCopyId = new()
    {
        Name = "ssh-copy-id",
        Summary = "Lägger din publika SSH-nyckel på en server",
        SummaryEn = "Install your public SSH key on a server",
        Man = """
            NAMN
                   ssh-copy-id - lägg din publika nyckel på en server

            SYNOPSIS
                   ssh-copy-id [-i NYCKEL.pub] ANVÄNDARE@VÄRD

            BESKRIVNING
                   Lägger till din publika nyckel i ~/.ssh/authorized_keys på servern.
                   Sedan loggar ssh in med nyckeln i stället för med lösenord.

            EXEMPEL
                   ssh-keygen
                   ssh-copy-id elev@server.lan
            """,
        ManEn = """
            NAME
                   ssh-copy-id - install your public key on a server

            SYNOPSIS
                   ssh-copy-id [-i KEY.pub] USER@HOST

            DESCRIPTION
                   Appends your public key to ~/.ssh/authorized_keys on the server.
                   After that, ssh logs in with the key instead of a password.

            EXAMPLES
                   ssh-keygen
                   ssh-copy-id elev@server.lan
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "fn", Values = "ip" });
            if (o.Error is not null || string.IsNullOrEmpty(o.Operands.At(0)))
            {
                ctx.Err("Usage: /usr/bin/ssh-copy-id [-h|-?|-f|-n|-s|-x] [-i [identity_file]] [-p port] [-F alternative ssh_config file] [-t target_path] [[-o <ssh -o options>] ...] [user@]hostname\n");
                return 1;
            }
            var identity = o.Values.Get("i");
            var pub = PublicKey(sh, identity);
            var source = !string.IsNullOrEmpty(identity) ? (identity.EndsWith(".pub", StringComparison.Ordinal) ? identity : identity + ".pub") : $"{SshDir(sh)}/id_ed25519.pub";
            if (pub is null)
            {
                ctx.Err("/usr/bin/ssh-copy-id: ERROR: No identities found\n");
                return 1;
            }
            var d = ParseDest(o.Operands[0], null, sh, Js.Number(o.Values.Get("p") ?? "22"));
            ctx.Err($"/usr/bin/ssh-copy-id: INFO: Source of key(s) to be installed: \"{source}\"\n");
            return SshConnect(ctx, d, io =>
            {
                io.Err("/usr/bin/ssh-copy-id: INFO: attempting to log in with the new key(s), to filter out any that are already installed\n");
                var server = ServerFor(sh);
                var existing = server.Vfs.TryLookup("/home/elev/.ssh/authorized_keys", server.RootUser())?.Content ?? "";
                if (d.User == "elev" && existing.Contains(pub.Trim(), StringComparison.Ordinal))
                {
                    io.Err("\n/usr/bin/ssh-copy-id: WARNING: All keys were skipped because they already exist on the remote system.\n\t\t(if you think this is a mistake, you may want to use -f option)\n\n");
                    return 0;
                }
                io.Err("/usr/bin/ssh-copy-id: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the new keys\n");
                if (!Authenticate(sh, d, io)) return 1;
                AddAuthorizedKey(server, pub);
                sh.Flags[KeyFlag(sh)] = true;
                io.Out($"\nNumber of key(s) added: 1\n\nNow try logging into the machine, with: \"ssh '{d.User}@{d.Host}'\"\nand check to make sure that only the key(s) you wanted were added.\n\n");
                return 0;
            });
        },
    };

    public static List<CommandDef> All { get; } = new() { Ssh, SshKeygen, SshCopyId };
}
