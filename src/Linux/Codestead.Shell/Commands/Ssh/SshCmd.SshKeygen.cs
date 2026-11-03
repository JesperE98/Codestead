namespace Codestead.Shell.Commands;

// The ssh-keygen command: generate an SSH key pair.

public static partial class SshCmd
{
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
                var priv = $"-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\n{RandomB64(70)}\n{RandomB64(70)}\n(simulated private key - never show it to anyone!)\n-----END OPENSSH PRIVATE KEY-----\n";
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
}
