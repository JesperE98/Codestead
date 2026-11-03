namespace Codestead.Shell;

// ServicesLib: the services that exist from the start, their unit files and the cron unit.

public static partial class ServicesLib
{
    // ---------- The services that exist from the start ----------

    private sealed class StartFailure
    {
        /// <summary>Output from the program before it crashed.</summary>
        public List<string> Log { get; set; } = new();
        public int Status { get; set; }
        public string StatusName { get; set; } = "";
        public bool Exec { get; set; }
    }

    private sealed class ServiceDef
    {
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        public string Exec { get; set; } = "";
        public string? Type { get; set; }
        public string? User { get; set; }
        public string? Reload { get; set; }
        public List<string>? Docs { get; set; }
        public string? After { get; set; }
        public string? Restart { get; set; }
        public bool RemainAfterExit { get; set; }
        /// <summary>The target in [Install]. Missing means the service is "static".</summary>
        public string? WantedBy { get; set; }
        public string? Alias { get; set; }
        /// <summary>The unit file lives in /etc/systemd/system (written by the administrator).</summary>
        public bool Admin { get; set; }
        /// <summary>PID the service gets at boot (the same as in the process table).</summary>
        public int? Pid { get; set; }
        /// <summary>Enabled from the start (has [Install]).</summary>
        public bool Enabled { get; set; }
        /// <summary>Static service that is still started at boot (as a dependency).</summary>
        public bool Boot { get; set; }
        /// <summary>Started by hand after boot (by the administrator).</summary>
        public bool Manual { get; set; }
        /// <summary>The program's own log lines when it starts.</summary>
        public List<string>? Log { get; set; }
        /// <summary>The program's own log lines when it is stopped.</summary>
        public List<string>? StopLog { get; set; }
        /// <summary>Check before start – returns a failure if the service crashes.</summary>
        public Func<Shell, StartFailure?>? Check { get; set; }
        /// <summary>Extra comment at the top of the unit file.</summary>
        public string? Comment { get; set; }
    }

    /// <summary>The configuration file reportd needs (and that is missing from the start).</summary>
    public const string ReportdConf = "/etc/reportd.conf";

    private const string ReportdExample = $"""
        # Example configuration for reportd.
        # Copy it to {ReportdConf} and change it as needed:
        #   sudo cp {ReportdConf}.example {ReportdConf}

        port = 9090
        report_dir = /var/lib/reportd
        interval = 1h

        """;

    private static List<ServiceDef> ServiceDefs(Distro distro)
    {
        var fam = distro.Family;
        var common = new List<ServiceDef>
        {
            new()
            {
                Name = "systemd-journald.service",
                Description = "Journal Service",
                Exec = "/usr/lib/systemd/systemd-journald",
                Type = "notify",
                Docs = new() { "man:systemd-journald.service(8)", "man:journald.conf(5)" },
                Pid = 312,
                Boot = true,
                Log = new() { "Journal started", "System Journal (/var/log/journal) is 24.0M, max 4.0G, 3.9G free." },
            },
            new()
            {
                Name = "systemd-udevd.service",
                Description = "Rule-based Manager for Device Events and Files",
                Exec = "/usr/lib/systemd/systemd-udevd",
                Type = "notify",
                Docs = new() { "man:systemd-udevd.service(8)", "man:udev(7)" },
                Pid = 341,
                Boot = true,
            },
            fam == "debian"
                ? new()
                {
                    Name = "dbus.service",
                    Description = "D-Bus System Message Bus",
                    Exec = "/usr/bin/dbus-daemon --system --address=systemd: --nofork",
                    Type = "notify",
                    User = "messagebus",
                    Docs = new() { "man:dbus-daemon(1)" },
                    Pid = 498,
                    Boot = true,
                }
                : new()
                {
                    Name = "dbus-broker.service",
                    Description = "D-Bus System Message Bus",
                    Exec = "/usr/bin/dbus-broker-launch --scope system",
                    Type = "notify",
                    User = "dbus",
                    Docs = new() { "man:dbus-broker-launch(1)" },
                    WantedBy = "multi-user.target",
                    Alias = "dbus.service",
                    Enabled = true,
                    Pid = 498,
                    Log = new() { "Ready" },
                },
            new()
            {
                Name = "systemd-logind.service",
                Description = "User Login Management",
                Exec = "/usr/lib/systemd/systemd-logind",
                Type = "notify",
                Docs = new() { "man:sd-login(3)", "man:systemd-logind.service(8)", "man:logind.conf(5)" },
                Pid = 520,
                Boot = true,
                Log = new() { "New seat seat0." },
            },
        };

        var network = distro.Id == "debian"
            ? new List<ServiceDef>
            {
                new()
                {
                    Name = "networking.service",
                    Description = "Raise network interfaces",
                    Exec = "/sbin/ifup -a --read-environment",
                    Type = "oneshot",
                    RemainAfterExit = true,
                    Docs = new() { "man:interfaces(5)" },
                    WantedBy = "multi-user.target",
                    Enabled = true,
                },
            }
            : fam == "arch"
                ? new List<ServiceDef>
                {
                    new()
                    {
                        Name = "systemd-networkd.service",
                        Description = "Network Configuration",
                        Exec = "/usr/lib/systemd/systemd-networkd",
                        Type = "notify",
                        User = "systemd-network",
                        Docs = new() { "man:systemd-networkd.service(8)" },
                        WantedBy = "multi-user.target",
                        Enabled = true,
                        Pid = 470,
                        Log = new() { "eth0: Link UP", "eth0: Gained carrier", "eth0: DHCPv4 address 192.168.1.42/24, gateway 192.168.1.1" },
                    },
                }
                : new List<ServiceDef>
                {
                    new()
                    {
                        Name = "NetworkManager.service",
                        Description = "Network Manager",
                        Exec = "/usr/sbin/NetworkManager --no-daemon",
                        Type = "dbus",
                        Reload = "/usr/bin/busctl call org.freedesktop.NetworkManager /org/freedesktop/NetworkManager org.freedesktop.NetworkManager Reload u 0",
                        Docs = new() { "man:NetworkManager(8)" },
                        WantedBy = "multi-user.target",
                        Enabled = true,
                        Pid = fam == "redhat" ? 560 : 590,
                        Log = new() { "<info>  NetworkManager is starting...", "<info>  device (eth0): state change: ip-config -> activated" },
                    },
                };

        var ssh = fam == "debian"
            ? new ServiceDef
            {
                Name = "ssh.service",
                Description = "OpenBSD Secure Shell server",
                Exec = "/usr/sbin/sshd -D",
                Type = "notify",
                Reload = "/bin/kill -HUP $MAINPID",
                Docs = new() { "man:sshd(8)", "man:sshd_config(5)" },
                After = "network.target auditd.service",
                Restart = "on-failure",
                WantedBy = "multi-user.target",
                Alias = "sshd.service",
                Enabled = true,
                Pid = 733,
                Log = new() { "Server listening on 0.0.0.0 port 22.", "Server listening on :: port 22." },
                StopLog = new() { "Received signal 15; terminating." },
            }
            : new ServiceDef
            {
                Name = "sshd.service",
                Description = fam == "arch" ? "OpenSSH Daemon" : "OpenSSH server daemon",
                Exec = "/usr/sbin/sshd -D",
                Type = "notify",
                Reload = "/bin/kill -HUP $MAINPID",
                Docs = new() { "man:sshd(8)", "man:sshd_config(5)" },
                After = "network.target",
                Restart = "on-failure",
                WantedBy = "multi-user.target",
                Enabled = true,
                Pid = 733,
                Log = new() { "Server listening on 0.0.0.0 port 22.", "Server listening on :: port 22." },
                StopLog = new() { "Received signal 15; terminating." },
            };

        List<ServiceDef> family;
        if (fam == "debian")
        {
            family = new List<ServiceDef>
            {
                new()
                {
                    Name = "cron.service",
                    Description = "Regular background program processing daemon",
                    Exec = "/usr/sbin/cron -f",
                    Docs = new() { "man:cron(8)" },
                    WantedBy = "multi-user.target",
                    Enabled = true,
                    Pid = 530,
                    Log = new() { "(CRON) INFO (pidfile fd = 3)", "(CRON) INFO (Running @reboot jobs)" },
                },
                new()
                {
                    Name = "rsyslog.service",
                    Description = "System Logging Service",
                    Exec = "/usr/sbin/rsyslogd -n",
                    Type = "notify",
                    User = "syslog",
                    Docs = new() { "man:rsyslogd(8)", "man:rsyslog.conf(5)" },
                    WantedBy = "multi-user.target",
                    Enabled = true,
                    Pid = 533,
                },
            };
            if (distro.Id == "ubuntu")
            {
                family.Add(new()
                {
                    Name = "snapd.service",
                    Description = "Snap Daemon",
                    Exec = "/usr/lib/snapd/snapd",
                    Type = "notify",
                    WantedBy = "multi-user.target",
                    Enabled = true,
                    Pid = 560,
                });
            }
        }
        else if (fam == "arch")
        {
            family = new List<ServiceDef>
            {
                new()
                {
                    Name = "systemd-timesyncd.service",
                    Description = "Network Time Synchronization",
                    Exec = "/usr/lib/systemd/systemd-timesyncd",
                    Type = "notify",
                    User = "systemd-timesync",
                    Docs = new() { "man:systemd-timesyncd.service(8)" },
                    WantedBy = "sysinit.target",
                    Enabled = true,
                    Pid = 531,
                    Log = new() { "Contacted time server 162.159.200.1:123 (0.arch.pool.ntp.org)." },
                },
            };
        }
        else
        {
            family = new List<ServiceDef>
            {
                new()
                {
                    Name = "firewalld.service",
                    Description = "firewalld - dynamic firewall daemon",
                    Exec = "/usr/bin/python3 -sP /usr/sbin/firewalld --nofork --nopid",
                    Type = "dbus",
                    Reload = "/bin/kill -HUP $MAINPID",
                    Docs = new() { "man:firewalld(1)" },
                    WantedBy = "multi-user.target",
                    Alias = "dbus-org.fedoraproject.FirewallD1.service",
                    Enabled = true,
                    Pid = 540,
                },
                new()
                {
                    Name = "chronyd.service",
                    Description = "NTP client/server",
                    Exec = "/usr/sbin/chronyd -F 2",
                    Type = "forking",
                    User = "chrony",
                    Docs = new() { "man:chronyd(8)", "man:chrony.conf(5)" },
                    WantedBy = "multi-user.target",
                    Enabled = true,
                    Pid = 545,
                    Log = new() { "chronyd version 4.8 starting (+CMDMON +NTP +REFCLOCK +RTC +PRIVDROP +SCFILTER +SIGND +NTS +SECHASH +IPV6 +DEBUG)" },
                },
                new()
                {
                    Name = "crond.service",
                    Description = "Command Scheduler",
                    Exec = "/usr/sbin/crond -n",
                    WantedBy = "multi-user.target",
                    Enabled = true,
                    Pid = 552,
                    Log = new() { "(CRON) STARTUP (1.7.2)", "(CRON) INFO (running with inotify support)" },
                },
            };
        }

        var own = new List<ServiceDef>
        {
            new()
            {
                Name = "reportd.service",
                Description = "Reportd report service",
                Exec = $"/usr/local/bin/reportd --config {ReportdConf}",
                Type = "notify",
                After = "network.target",
                WantedBy = "multi-user.target",
                Admin = true,
                Enabled = true,
                Pid = 655,
                Log = new() { $"Reading configuration from {ReportdConf}", "Report scheduler ready (interval 1h)" },
                Check = sh => sh.Vfs.TryLookup(ReportdConf, sh.RootUser())?.Type == "file"
                    ? null
                    : new StartFailure
                    {
                        Log = new()
                        {
                            $"error: cannot open config file {ReportdConf}: No such file or directory",
                            $"hint: an example configuration is installed as {ReportdConf}.example",
                        },
                        Status = 1,
                        StatusName = "FAILURE",
                    },
                Comment = "# reportd creates reports every hour. Installed by the administrator.",
            },
            new()
            {
                Name = "myserver.service",
                Description = "Myserver web server (practice server)",
                Exec = "/usr/local/bin/myserver --port 8080",
                Reload = "/bin/kill -HUP $MAINPID",
                After = "network.target",
                WantedBy = "multi-user.target",
                Admin = true,
                Manual = true,
                Pid = ProcsLib.ServerPid,
                Log = new() { "Reading configuration from /etc/myserver.conf", "Listening on port 8080" },
                StopLog = new() { "Shutting down, closing connections" },
                Comment = "# The practice server from the chapter about processes.",
            },
        };

        var all = new List<ServiceDef>();
        all.AddRange(common);
        all.AddRange(network);
        all.AddRange(family);
        all.Add(ssh);
        all.AddRange(own);
        return all;
    }

    private static ServiceDef? DefFor(Shell sh, string name) => ServiceDefs(sh.Distro).Find(d => d.Name == name);

    private static string UnitFile(ServiceDef def)
    {
        var lines = new List<string>();
        if (!string.IsNullOrEmpty(def.Comment)) lines.Add(def.Comment);
        lines.Add("[Unit]");
        lines.Add($"Description={def.Description}");
        if (def.Docs is not null) lines.Add($"Documentation={string.Join(" ", def.Docs)}");
        if (!string.IsNullOrEmpty(def.After)) lines.Add($"After={def.After}");
        lines.Add("");
        lines.Add("[Service]");
        if (!string.IsNullOrEmpty(def.Type) && def.Type != "simple") lines.Add($"Type={def.Type}");
        if (def.RemainAfterExit) lines.Add("RemainAfterExit=yes");
        if (!string.IsNullOrEmpty(def.User)) lines.Add($"User={def.User}");
        lines.Add($"ExecStart={def.Exec}");
        if (!string.IsNullOrEmpty(def.Reload)) lines.Add($"ExecReload={def.Reload}");
        if (!string.IsNullOrEmpty(def.Restart)) lines.Add($"Restart={def.Restart}");
        if (!string.IsNullOrEmpty(def.WantedBy))
        {
            lines.Add("");
            lines.Add("[Install]");
            lines.Add($"WantedBy={def.WantedBy}");
            if (!string.IsNullOrEmpty(def.Alias)) lines.Add($"Alias={def.Alias}");
        }
        return string.Join("\n", lines) + "\n";
    }

    /// <summary>
    /// cronie on Arch: the package brings its own service (not enabled, like every Arch package). Called when
    /// the package is installed or removed.
    /// </summary>
    public static void CronieUnit(Shell sh, bool installed)
    {
        var path = $"{SystemUnitDir}/cronie.service";
        var root = sh.RootUser();
        if (!installed)
        {
            if (sh.Vfs.TryLookup(path, root) is not null) sh.Vfs.Remove(path, root);
            if (sh.Vfs.TryLookup("/usr/bin/crond", root) is not null) sh.Vfs.Remove("/usr/bin/crond", root);
            return;
        }
        // The daemon itself (the service starts it).
        PackagesLib.InstallCommand(sh, "crond");
        EnsureDir(sh, SystemUnitDir).Children!["cronie.service"] = VfsLib.MakeFile(UnitFile(new ServiceDef
        {
            Name = "cronie.service",
            Description = "Command Scheduler",
            Exec = "/usr/bin/crond -n",
            Reload = "/usr/bin/kill -HUP $MAINPID",
            WantedBy = "multi-user.target",
        }));
        SyncServices(sh);
    }

    /// <summary>The cron service of the distribution: cron (Debian/Ubuntu), crond (Fedora) or cronie (Arch).</summary>
    public static string CronUnit(Distro d) => d.Family switch
    {
        "debian" => "cron.service",
        "redhat" => "crond.service",
        _ => "cronie.service",
    };
}
