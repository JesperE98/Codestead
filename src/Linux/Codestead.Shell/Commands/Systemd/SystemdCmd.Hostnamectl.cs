namespace Codestead.Shell.Commands;

// The hostnamectl command: show or change the computer's hostname and system information.

public static partial class SystemdCmd
{
    private static readonly Regex HostnameRe = new(@"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,62})\z", RegexOptions.CultureInvariant);
    private static readonly Regex PrettyNameRe = new("PRETTY_NAME=\"([^\"]+)\"", RegexOptions.CultureInvariant);

    private static readonly CommandDef Hostnamectl = new()
    {
        Name = "hostnamectl",
        Summary = "Visar eller ändrar datorns namn och systeminformation",
        SummaryEn = "Show or change the computer's hostname and system information",
        Man = """
            NAMN
                   hostnamectl - visa eller ändra datorns namn

            SYNOPSIS
                   hostnamectl [status]
                   sudo hostnamectl set-hostname NAMN

            BESKRIVNING
                   Utan argument visas datorns namn, operativsystem, kärna och
                   arkitektur. set-hostname skriver det nya namnet till /etc/hostname.
            """,
        ManEn = """
            NAME
                   hostnamectl - show or change the computer's hostname

            SYNOPSIS
                   hostnamectl [status]
                   sudo hostnamectl set-hostname NAME

            DESCRIPTION
                   Without arguments the hostname, operating system, kernel and
                   architecture are shown. set-hostname writes the new name to
                   /etc/hostname.
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var ops = ctx.Args.Where(a => !a.StartsWith('-')).ToList();
            var verb = ops.Count > 0 ? ops[0] : "status";
            var root = sh.RootUser();
            var hostname = (sh.Vfs.TryLookup("/etc/hostname", root)?.Content ?? sh.Distro.Hostname).Trim();
            var arg1 = ops.Count > 1 ? ops[1] : null;
            if (verb == "hostname" && string.IsNullOrEmpty(arg1))
            {
                ctx.Out(hostname + "\n");
                return 0;
            }
            if (verb == "set-hostname" || verb == "hostname")
            {
                var name = arg1;
                if (string.IsNullOrEmpty(name))
                {
                    ctx.Err("Too few arguments.\n");
                    return 1;
                }
                if (!HostnameRe.IsMatch(name))
                {
                    ctx.Err($"Invalid static hostname '{name}'\n");
                    return 1;
                }
                if (!IsRoot(ctx))
                {
                    ctx.Err($"Could not set static hostname: {Auth}\n");
                    SudoTip(ctx);
                    return 1;
                }
                sh.Vfs.WriteFile("/etc/hostname", name + "\n", root);
                Tip(ctx, "systemd.hostnameSaved");
                return 0;
            }
            if (verb != "status")
            {
                ctx.Err($"Unknown command verb '{verb}'.\n");
                return 1;
            }
            var pm = PrettyNameRe.Match(sh.Distro.OsRelease);
            var pretty = pm.Success ? pm.Groups[1].Value : sh.Distro.Name;
            var boot = sh.Services.Boots.Count > 0 ? sh.Services.Boots[^1] : null;
            ctx.Out(
                $" Static hostname: {hostname}\n" +
                "       Icon name: computer-vm\n" +
                "         Chassis: vm\n" +
                $"      Machine ID: {sh.Services.MachineId}\n" +
                $"         Boot ID: {boot?.Id ?? ""}\n" +
                "  Virtualization: kvm\n" +
                $"Operating System: {pretty}\n" +
                $"          Kernel: Linux {sh.Distro.Kernel}\n" +
                "    Architecture: x86-64\n" +
                " Hardware Vendor: QEMU\n" +
                "  Hardware Model: Standard PC _Q35 + ICH9, 2009_\n");
            return 0;
        },
    };
}
