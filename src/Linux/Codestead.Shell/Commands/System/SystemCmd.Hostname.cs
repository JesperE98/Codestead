namespace Codestead.Shell.Commands;

// The hostname command: show the system's host name.

public static partial class SystemCmd
{
    private static readonly CommandDef Hostname = new()
    {
        Name = "hostname",
        Summary = "Visar datorns namn",
        Run = ctx =>
        {
            if (ctx.Args.Contains("-I") || ctx.Args.Contains("--all-ip-addresses"))
            {
                ctx.Out(NetworkLib.MyIp(ctx.Sh) + " \n");
                return 0;
            }
            if (ctx.Args.Contains("-i") || ctx.Args.Contains("--ip-address"))
            {
                ctx.Out("127.0.1.1\n");
                return 0;
            }
            ctx.Out(ctx.Sh.Distro.Hostname + "\n");
            return 0;
        },
        Man = """
NAMN
       hostname - visa systemets värdnamn

BESKRIVNING
       Namnet finns också i filen /etc/hostname.

FLAGGOR
       -I       visa datorns IP-adresser (utom 127.0.0.1)
""",
        Builtin = false,
        SummaryEn = "Show the system's host name",
        ManEn = """
NAME
       hostname - show the system's host name

DESCRIPTION
       The name is also stored in the file /etc/hostname.

OPTIONS
       -I       show the computer's IP addresses (except 127.0.0.1)
""",
    };
}
