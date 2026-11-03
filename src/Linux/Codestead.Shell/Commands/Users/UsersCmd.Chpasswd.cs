namespace Codestead.Shell.Commands;

// The chpasswd command: set passwords from "user:password" lines (needs root).

public static partial class UsersCmd
{
    private static readonly CommandDef Chpasswd = new()
    {
        Name = "chpasswd",
        Summary = "Sätter lösenord från rader \"användare:lösenord\" (kräver root)",
        SummaryEn = "Set passwords from \"user:password\" lines (needs root)",
        Man = """
        NAMN
               chpasswd - sätt lösenord för många användare på en gång

        SYNOPSIS
               echo 'ANVÄNDARE:LÖSENORD' | sudo chpasswd

        BESKRIVNING
               Läser rader på formen användare:lösenord från standard in.
               Praktiskt i skript.
        """,
        ManEn = """
        NAME
               chpasswd - update passwords in batch

        SYNOPSIS
               echo 'USER:PASSWORD' | sudo chpasswd

        DESCRIPTION
               Reads lines of the form user:password from standard input.
               Handy in scripts.
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            if (!IsRoot(sh))
            {
                ctx.Err("chpasswd: Permission denied.\nchpasswd: cannot lock /etc/shadow; try again later.\n");
                return 1;
            }
            int code = 0;
            var lines = (ctx.Stdin ?? "").Split('\n');
            for (int i = 0; i < lines.Length; i++)
            {
                var line = lines[i];
                if (line.Trim() == "") continue;
                int colon = line.IndexOf(':');
                var name = line.Slice(0, colon);
                if (colon < 0)
                {
                    ctx.Err($"chpasswd: line {i + 1}: missing new password\n");
                    code = 1;
                }
                else if (UsersLib.FindUser(sh, name) is null)
                {
                    ctx.Err($"chpasswd: line {i + 1}: user '{name}' does not exist\n");
                    code = 1;
                }
                else SetPassword(sh, name, line.Slice(colon + 1));
            }
            return code;
        },
    };
}
