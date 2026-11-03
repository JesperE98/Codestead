namespace Codestead.Shell.Commands;

// The reboot command: reboot the computer.

public static partial class SystemdCmd
{
    private static readonly CommandDef RebootCmd = new()
    {
        Name = "reboot",
        Summary = "Startar om datorn",
        SummaryEn = "Reboot the computer",
        Man = """
            NAMN
                   reboot - starta om datorn

            SYNOPSIS
                   sudo reboot

            BESKRIVNING
                   Samma sak som "systemctl reboot": alla tjänster stoppas och datorn
                   startar om. Efter omstarten körs bara de tjänster som är aktiverade
                   (enable). I simulatorn startar datorn om på ett ögonblick.
            """,
        ManEn = """
            NAME
                   reboot - reboot the computer

            SYNOPSIS
                   sudo reboot

            DESCRIPTION
                   Same as "systemctl reboot": all services are stopped and the
                   computer restarts. After the reboot only enabled services run.
                   In the simulator the reboot takes no time at all.
            """,
        Run = ctx =>
        {
            if (!IsRoot(ctx))
            {
                ctx.Err($"Call to Reboot failed: {Auth}\n");
                SudoTip(ctx);
                return 1;
            }
            return DoReboot(ctx);
        },
    };
}
