namespace Codestead.Shell.Commands;

// The ssh command: log in to or run commands on another computer.

public static partial class SshCmd
{
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

                   I simulatorn finns servern server.lan (192.168.1.10) med samma
                   användare som på din egen dator ($USER). Interaktiva inloggningar
                   stöds inte – skriv kommandot efter värden.

            FLAGGOR
                   -p PORT   anslut till en annan port än 22
                   -l NAMN   användarnamn (samma som NAMN@VÄRD)

            ~/.ssh/config
                   Ge datorer korta namn. Efter

                       Host srv
                           HostName 192.168.1.10
                           User elev

                   räcker det att skriva ssh srv (och scp fil srv:). Filen får
                   bara du kunna skriva i (chmod 600).

            EXEMPEL
                   ssh $USER@server.lan hostname
                   ssh $USER@server.lan 'ls -l; cat *.txt'
                   ssh $USER@192.168.1.10 uptime
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

                   The simulator has the server server.lan (192.168.1.10) with the same
                   user as on your own computer ($USER). Interactive logins are not
                   supported – put the command after the host.

            OPTIONS
                   -p PORT   connect to a port other than 22
                   -l NAME   user name (same as NAME@HOST)

            ~/.ssh/config
                   Give computers short names. After

                       Host srv
                           HostName 192.168.1.10
                           User student

                   it is enough to type ssh srv (and scp file srv:). Only you may be
                   able to write to the file (chmod 600).

            EXAMPLES
                   ssh $USER@server.lan hostname
                   ssh $USER@server.lan 'ls -l; cat *.txt'
                   ssh $USER@192.168.1.10 uptime
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var args = new List<string>(ctx.Args);
            double? port = null;
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
            if (port is double p && (double.IsNaN(p) || double.IsInfinity(p) || p != Math.Floor(p) || p < 1 || p > 65535))
            {
                ctx.Err($"Bad port '{Js.Num(p)}'\n");
                return 255;
            }
            var (d, configError) = ParseDest(dest, login, sh, port);
            if (d is null)
            {
                ctx.Err(configError!);
                return 255;
            }
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
                    io.Err(Dim(sh, "ssh.noInteractiveShell", ("dest", dest)));
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
}
