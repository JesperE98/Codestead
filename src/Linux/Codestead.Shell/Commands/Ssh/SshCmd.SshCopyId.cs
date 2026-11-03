namespace Codestead.Shell.Commands;

// The ssh-copy-id command: install your public SSH key on a server.

public static partial class SshCmd
{
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
                   ssh-copy-id $USER@server.lan
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
                   ssh-copy-id $USER@server.lan
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
            var (d, configError) = ParseDest(o.Operands[0], null, sh, o.Values.Get("p") is string pv ? Js.Number(pv) : null);
            if (d is null)
            {
                ctx.Err(configError!);
                return 1;
            }
            ctx.Err($"/usr/bin/ssh-copy-id: INFO: Source of key(s) to be installed: \"{source}\"\n");
            return SshConnect(ctx, d, io =>
            {
                io.Err("/usr/bin/ssh-copy-id: INFO: attempting to log in with the new key(s), to filter out any that are already installed\n");
                var server = ServerFor(sh);
                var existing = server.Vfs.TryLookup($"{server.World.Home}/.ssh/authorized_keys", server.RootUser())?.Content ?? "";
                if (d.User == sh.World.User && existing.Contains(pub.Trim(), StringComparison.Ordinal))
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
}
