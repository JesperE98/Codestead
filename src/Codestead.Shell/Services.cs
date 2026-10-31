namespace Codestead.Shell;

// Port of src/shell/services.ts – the services of the simulated computer, a simplified model of systemd.
//
// Every service (unit) has a unit file in the virtual file system and a run state
// (active/inactive/failed) with a main process in the process table (`sh.Proc`). Everything that
// happens is written to the journal, which `journalctl` reads. The state is saved in the shell
// (`sh.Services`) together with the rest of the computer.

/// <summary>Explanation shown with `journalctl -x` (the `x` field of a journal entry).</summary>
public partial class JournalCatalog
{
    public string Subject { get; set; } = "";
    public List<string> Body { get; set; } = new();
}

public partial class JournalEntry
{
    /// <summary>Time (ms since 1970).</summary>
    public long T { get; set; }
    /// <summary>Which boot the line belongs to (index in `Boots`).</summary>
    public int Boot { get; set; }
    /// <summary>The program that wrote the line, e.g. "systemd", "sshd" or "kernel".</summary>
    public string Ident { get; set; } = "";
    public int? Pid { get; set; }
    /// <summary>0 = emerg … 3 = err, 4 = warning, 5 = notice, 6 = info, 7 = debug.</summary>
    public int Prio { get; set; }
    public string Msg { get; set; } = "";
    /// <summary>The service the line is about (for `journalctl -u`).</summary>
    public string? Unit { get; set; }
    /// <summary>Explanation shown with `journalctl -x`.</summary>
    public JournalCatalog? X { get; set; }
}

public partial class UnitRt
{
    public string Name { get; set; } = "";
    /// <summary>The unit file that was loaded.</summary>
    public string Path { get; set; } = "";
    /// <summary>The unit file's content at the last load (daemon-reload).</summary>
    public string Loaded { get; set; } = "";
    /// <summary>"active", "inactive" or "failed".</summary>
    public string Active { get; set; } = "inactive";
    /// <summary>"running", "dead", "exited" or "failed".</summary>
    public string Sub { get; set; } = "dead";
    /// <summary>When the state last changed.</summary>
    public long? Since { get; set; }
    /// <summary>When the service last started (for "Duration").</summary>
    public long? StartedAt { get; set; }
    /// <summary>The main process while the service runs.</summary>
    public int? Pid { get; set; }
    /// <summary>The latest main process, after the service stopped.</summary>
    public int? LastPid { get; set; }
    /// <summary>Why the service failed, e.g. "exit-code".</summary>
    public string? Result { get; set; }
    /// <summary>E.g. "code=exited, status=1/FAILURE".</summary>
    public string? ExitInfo { get; set; }
}

/// <summary>One boot ({ id, start }).</summary>
public partial class BootRecord
{
    public string Id { get; set; } = "";
    public long Start { get; set; }
}

public partial class ServiceState
{
    public OrderedDictionary<string, UnitRt> Units { get; set; } = Js.Obj<UnitRt>();
    public List<JournalEntry> Journal { get; set; } = new();
    /// <summary>All boots; the last one is the current one.</summary>
    public List<BootRecord> Boots { get; set; } = new();
    /// <summary>Running number for jobs (shown with journalctl -x).</summary>
    public int Job { get; set; }
    public string MachineId { get; set; } = "";
}

public partial class ParsedUnit
{
    public string Description { get; set; } = "";
    public List<string> Docs { get; set; } = new();
    /// <summary>"simple", "exec", "notify", "forking", "oneshot" or "dbus".</summary>
    public string Type { get; set; } = "simple";
    public string Exec { get; set; } = "";
    public string? Reload { get; set; }
    public string? User { get; set; }
    public bool RemainAfterExit { get; set; }
    public List<string> WantedBy { get; set; } = new();
    public List<string> Alias { get; set; } = new();
}

public partial class StartResult
{
    public bool Ok { get; set; }
}

public partial class LinkChange
{
    public List<string> Created { get; set; } = new();
    public List<string> Removed { get; set; } = new();
}

public static partial class ServicesLib
{
    /// <summary>Unit files shipped with the packages. (In older Debian: /lib/systemd/system.)</summary>
    public const string SystemUnitDir = "/usr/lib/systemd/system";
    /// <summary>Unit files the administrator wrote or changed. Take precedence.</summary>
    public const string AdminUnitDir = "/etc/systemd/system";

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

    // ---------- Unit files ----------

    private static readonly Regex SectionRe = new(@"^\[(.+)\]\z", RegexOptions.CultureInvariant);
    private static readonly Regex WhitespaceRe = new(@"\s+", RegexOptions.CultureInvariant);
    private static readonly Regex ExecPrefixRe = new(@"^[-@:+!]+", RegexOptions.CultureInvariant);
    private static readonly Regex TruthyRe = new(@"^(yes|true|1|on)\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>Reads the most important settings from a unit file.</summary>
    public static ParsedUnit ParseUnit(string text)
    {
        var values = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        var section = "";
        foreach (var raw in text.Split('\n'))
        {
            var line = raw.Trim();
            if (line == "" || line.StartsWith('#') || line.StartsWith(';')) continue;
            var sec = SectionRe.Match(line);
            if (sec.Success)
            {
                section = sec.Groups[1].Value;
                continue;
            }
            var eq = line.IndexOf('=');
            if (eq < 0) continue;
            var key = $"{section}.{line[..eq].Trim()}";
            if (!values.TryGetValue(key, out var list)) values[key] = list = new List<string>();
            list.Add(line[(eq + 1)..].Trim());
        }
        string? Last(string k) => values.TryGetValue(k, out var v) && v.Count > 0 ? v[^1] : null;
        List<string> ListOf(string k) => (values.TryGetValue(k, out var v) ? v : new List<string>())
            .SelectMany(x => WhitespaceRe.Split(x)).Where(x => x != "").ToList();
        var type = Last("Service.Type") ?? "simple";
        var wantedBy = ListOf("Install.WantedBy");
        wantedBy.AddRange(ListOf("Install.RequiredBy"));
        return new ParsedUnit
        {
            Description = Last("Unit.Description") ?? "",
            Docs = ListOf("Unit.Documentation"),
            Type = type,
            Exec = ExecPrefixRe.Replace(Last("Service.ExecStart") ?? "", "", 1),
            Reload = Last("Service.ExecReload"),
            User = Last("Service.User"),
            RemainAfterExit = TruthyRe.IsMatch(Last("Service.RemainAfterExit") ?? ""),
            WantedBy = wantedBy,
            Alias = ListOf("Install.Alias"),
        };
    }

    private static FsNode EnsureDir(Shell sh, string path)
    {
        var root = sh.RootUser();
        var cur = "";
        var node = sh.Vfs.Root;
        foreach (var seg in path.Split('/').Where(s => s != ""))
        {
            cur += "/" + seg;
            if (!node.Children!.TryGetValue(seg, out var next))
            {
                next = VfsLib.MakeDir("root", Js.Oct(755));
                node.Children[seg] = next;
            }
            node = next;
        }
        return sh.Vfs.Lookup(cur == "" ? "/" : cur, root);
    }

    private static string WantsPath(string target, string unit) => $"{AdminUnitDir}/{target}.wants/{unit}";

    private static void WriteUnitFiles(Shell sh)
    {
        var sys = EnsureDir(sh, SystemUnitDir);
        var admin = EnsureDir(sh, AdminUnitDir);
        foreach (var def in ServiceDefs(sh.Distro))
        {
            var dir = def.Admin ? admin : sys;
            dir.Children![def.Name] = VfsLib.MakeFile(UnitFile(def));
            if (def.Enabled && !string.IsNullOrEmpty(def.WantedBy))
            {
                var wants = EnsureDir(sh, $"{AdminUnitDir}/{def.WantedBy}.wants");
                wants.Children![def.Name] = VfsLib.MakeFile(UnitFile(def));
            }
        }
        var etc = sh.Vfs.Lookup("/etc", sh.RootUser());
        if (!etc.Children!.ContainsKey("reportd.conf.example")) etc.Children["reportd.conf.example"] = VfsLib.MakeFile(ReportdExample);
    }

    /// <summary>Finds the unit file of a service (the administrator's copy wins over the package's).</summary>
    private static (string Path, string Content)? FindUnitFile(Shell sh, string name)
    {
        foreach (var dir in new[] { AdminUnitDir, SystemUnitDir })
        {
            var node = sh.Vfs.TryLookup($"{dir}/{name}", sh.RootUser());
            if (node?.Type == "file") return ($"{dir}/{name}", node.Content ?? "");
        }
        return null;
    }

    /// <summary>Loads (or reloads) a service from its unit file.</summary>
    private static UnitRt? LoadUnit(Shell sh, string name)
    {
        var file = FindUnitFile(sh, name);
        var st = sh.Services;
        if (file is null) return null;
        if (st.Units.TryGetValue(name, out var existing))
        {
            existing.Path = file.Value.Path;
            existing.Loaded = file.Value.Content;
            return existing;
        }
        var rt = new UnitRt { Name = name, Path = file.Value.Path, Loaded = file.Value.Content, Active = "inactive", Sub = "dead" };
        st.Units[name] = rt;
        return rt;
    }

    private static readonly Regex DigitsRe = new(@"^[0-9]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex HasSuffixRe = new(@"\.[a-z]+\z", RegexOptions.CultureInvariant);

    /// <summary>Translates "myserver", "sshd" (alias) or "myserver.service" to a loaded service.</summary>
    public static UnitRt? ResolveUnit(Shell sh, string arg)
    {
        var st = sh.Services;
        if (DigitsRe.IsMatch(arg))
        {
            var n = Js.Number(arg);
            return st.Units.Values.FirstOrDefault(u => u.Pid is int p && p == n);
        }
        var name = HasSuffixRe.IsMatch(arg) ? arg : $"{arg}.service";
        if (!name.EndsWith(".service", StringComparison.Ordinal)) return null;
        if (st.Units.TryGetValue(name, out var found)) return found;
        foreach (var u in st.Units.Values) if (ParseUnit(u.Loaded).Alias.Contains(name)) return u;
        return LoadUnit(sh, name);
    }

    /// <summary>The full name of the service for error messages ("myserver" → "myserver.service").</summary>
    public static string UnitName(string arg) => HasSuffixRe.IsMatch(arg) ? arg : $"{arg}.service";

    public static ParsedUnit UnitInfo(UnitRt rt) => ParseUnit(rt.Loaded);

    /// <summary>Has the unit file changed since it was loaded?</summary>
    public static bool ChangedOnDisk(Shell sh, UnitRt rt)
    {
        var file = FindUnitFile(sh, rt.Name);
        return file is not null && file.Value.Content != rt.Loaded;
    }

    /// <summary>"enabled", "disabled", "static" or "alias".</summary>
    public static string EnabledState(Shell sh, UnitRt rt, string? asked = null)
    {
        if (!string.IsNullOrEmpty(asked) && UnitName(asked) != rt.Name) return "alias";
        var info = UnitInfo(rt);
        if (info.WantedBy.Count == 0) return "static";
        return info.WantedBy.Any(t => sh.Vfs.TryLookup(WantsPath(t, rt.Name), sh.RootUser()) is not null) ? "enabled" : "disabled";
    }

    /// <summary>"preset" in the status output: Debian enables new services, Arch and Fedora do not.</summary>
    public static string PresetState(Shell sh) => sh.Distro.Family == "debian" ? "enabled" : "disabled";

    // ---------- The journal ----------

    private const int JournalMax = 3000;

    public static int CurrentBoot(Shell sh) => sh.Services.Boots.Count - 1;

    /// <summary>log(sh, t, ident, msg, opts) – the optional fields of the entry are named parameters.</summary>
    public static void Log(Shell sh, long t, string ident, string msg, int? pid = null, int? prio = null, string? unit = null, JournalCatalog? x = null)
    {
        var st = sh.Services;
        st.Journal.Add(new JournalEntry
        {
            T = t,
            Boot = CurrentBoot(sh),
            Ident = ident,
            Prio = prio ?? 6,
            Msg = msg,
            Unit = unit,
            X = x,
            Pid = pid ?? (ident == "systemd" ? 1 : null),
        });
        if (st.Journal.Count > JournalMax) st.Journal.RemoveRange(0, st.Journal.Count - JournalMax);
    }

    private static string IdentOf(string exec) => exec.Split(' ')[0].Split('/').Last();

    private static JournalCatalog SubjectStarted(string unit, int job) => new()
    {
        Subject = $"A start job for unit {unit} has finished successfully",
        Body = new() { $"A start job for unit {unit} has finished successfully.", "", $"The job identifier is {job}." },
    };

    // ---------- Processes ----------

    private static string Hhmm(long t)
    {
        var d = Js.LocalDate(t);
        return $"{d.Hour:00}:{d.Minute:00}";
    }

    private static Proc NewProc(int pid, string user, string cmd, long t) => new()
    {
        Pid = pid,
        Ppid = 1,
        User = user,
        Cmd = cmd,
        Cpu = 0,
        Mem = 0.2,
        Vsz = 20_000 + ((long)pid * 7919 % 300_000),
        Rss = 4_000 + ((long)pid * 104_729 % 40_000),
        Tty = "?",
        Stat = "Ss",
        Start = Hhmm(t),
        Time = "0:00",
    };

    private static bool HasProc(Shell sh, int? pid) => pid is not null && sh.Proc.Procs.Any(p => p.Pid == pid);

    private static int PickPid(Shell sh, int? wanted = null)
    {
        if (wanted is int w && !HasProc(sh, w) && !sh.Proc.Jobs.Any(j => j.Pid == w)) return w;
        return sh.Proc.NextPid++;
    }

    // ---------- Start and stop ----------

    // How a start happens (the `mode` parameter):
    // - "real": for real – the process is added to the process table.
    // - "init": when the model is created – existing processes in the table are taken over.
    // - "record": only journal lines (for the previous boot).

    public static StartResult StartUnit(Shell sh, UnitRt rt, long t, string mode = "real", bool atBoot = false)
    {
        var st = sh.Services;
        if (rt.Active == "active") return new StartResult { Ok = true };
        // A new start must come after the unit's earlier journal lines, even within the same millisecond
        // (fast machines) – otherwise `systemctl status` would show lines from the previous, failed start.
        var lastOwn = st.Journal.Where(e => e.Unit == rt.Name).Select(e => e.T).DefaultIfEmpty(long.MinValue).Max();
        if (lastOwn >= t) t = lastOwn + 1;
        var info = UnitInfo(rt);
        var def = DefFor(sh, rt.Name);
        var desc = info.Description != "" ? $"{rt.Name} - {info.Description}" : rt.Name;
        var job = ++st.Job;
        var ident = IdentOf(info.Exec);
        var user = info.User ?? "root";

        // What can go wrong: the program does not exist, or (for our own services) a check.
        StartFailure? failure = null;
        if (mode != "record")
        {
            if (def?.Check is not null) failure = def.Check(sh);
            else if (def is null)
            {
                var bin0 = info.Exec.Split(' ')[0];
                var path = bin0.Contains('/') ? bin0 : $"/usr/bin/{bin0}";
                var node = bin0 != "" ? sh.Vfs.TryLookup(path, sh.RootUser()) : null;
                if (node is null || node.Type != "file" || (node.Mode & Js.Oct(111)) == 0)
                {
                    failure = new StartFailure { Log = new(), Status = 203, StatusName = "EXEC", Exec = true };
                }
            }
        }

        if (info.Type != "simple" && info.Type != "exec") Log(sh, t, "systemd", $"Starting {desc}...", unit: rt.Name);
        int pid = mode == "record"
            ? def?.Pid ?? 900 + job
            : mode == "init"
                ? def?.Pid ?? PickPid(sh)
                : PickPid(sh, atBoot ? def?.Pid : null);

        if (failure is not null)
        {
            var bin = info.Exec.Split(' ')[0];
            if (bin == "") bin = "(none)";
            if (failure.Exec)
            {
                Log(sh, t, "systemd", $"{rt.Name}: Failed to locate executable {bin}: No such file or directory", unit: rt.Name, prio: 3, pid: pid);
                Log(sh, t, "systemd", $"{rt.Name}: Failed at step EXEC spawning {bin}: No such file or directory", unit: rt.Name, prio: 3, pid: pid);
            }
            else
            {
                foreach (var line in failure.Log) Log(sh, t, ident, line, unit: rt.Name, pid: pid, prio: line.StartsWith("error", StringComparison.Ordinal) ? 3 : 6);
            }
            var exitInfo = $"code=exited, status={failure.Status}/{failure.StatusName}";
            Log(sh, t, "systemd", $"{rt.Name}: Main process exited, {exitInfo}", unit: rt.Name, prio: 5, x: new JournalCatalog
            {
                Subject = "Unit process exited",
                Body = new() { $"An ExecStart= process belonging to unit {rt.Name} has exited.", "", $"The process' exit code is 'exited' and its exit status is {failure.Status}." },
            });
            Log(sh, t, "systemd", $"{rt.Name}: Failed with result 'exit-code'.", unit: rt.Name, prio: 4, x: new JournalCatalog
            {
                Subject = "Unit failed",
                Body = new() { $"The unit {rt.Name} has entered the 'failed' state with result 'exit-code'." },
            });
            Log(sh, t, "systemd", $"Failed to start {desc}.", unit: rt.Name, prio: 3, x: new JournalCatalog
            {
                Subject = $"A start job for unit {rt.Name} has failed",
                Body = new() { $"A start job for unit {rt.Name} has finished with a failure.", "", $"The job identifier is {job} and the job result is failed." },
            });
            rt.Active = "failed";
            rt.Sub = "failed";
            rt.Since = t;
            rt.StartedAt = t;
            rt.Pid = null;
            rt.LastPid = pid;
            rt.Result = "exit-code";
            rt.ExitInfo = exitInfo;
            return new StartResult { Ok = false };
        }

        if (info.Type == "oneshot")
        {
            foreach (var line in def?.Log ?? new List<string>()) Log(sh, t, ident, line, unit: rt.Name, pid: pid);
            if (info.RemainAfterExit)
            {
                Log(sh, t, "systemd", $"Finished {desc}.", unit: rt.Name, x: SubjectStarted(rt.Name, job));
                rt.Active = "active";
                rt.Sub = "exited";
            }
            else
            {
                Log(sh, t, "systemd", $"{rt.Name}: Deactivated successfully.", unit: rt.Name);
                Log(sh, t, "systemd", $"Finished {desc}.", unit: rt.Name, x: SubjectStarted(rt.Name, job));
                rt.Active = "inactive";
                rt.Sub = "dead";
            }
            rt.Since = t;
            rt.StartedAt = t;
            rt.Pid = null;
            rt.LastPid = pid;
            rt.Result = null;
            rt.ExitInfo = "code=exited, status=0/SUCCESS";
            return new StartResult { Ok = true };
        }

        if (mode != "record")
        {
            var template = ProcsLib.InitialProcs(sh.Distro, sh.World.User).Procs.Find(p => p.Pid == pid && p.Cmd == info.Exec);
            if (mode == "real" || (!HasProc(sh, pid) && template is null))
            {
                if (!HasProc(sh, pid))
                {
                    Proc proc;
                    if (template is not null && mode == "real")
                    {
                        // { ...template, start, time } – the template is a fresh object, so it can be changed.
                        template.Start = Hhmm(t);
                        template.Time = "0:00";
                        proc = template;
                    }
                    else proc = NewProc(pid, user, info.Exec, t);
                    sh.Proc.Procs.Add(proc);
                }
            }
        }
        void Started() => Log(sh, t, "systemd", $"Started {desc}.", unit: rt.Name, x: SubjectStarted(rt.Name, job));
        if (info.Type == "simple" || info.Type == "exec") Started();
        foreach (var line in def?.Log ?? new List<string>()) Log(sh, t, ident, line, unit: rt.Name, pid: pid);
        if (info.Type != "simple" && info.Type != "exec") Started();
        rt.Active = "active";
        rt.Sub = "running";
        rt.Since = t;
        rt.StartedAt = t;
        rt.Pid = pid;
        rt.LastPid = null;
        rt.Result = null;
        rt.ExitInfo = null;
        return new StartResult { Ok = true };
    }

    public static void StopUnit(Shell sh, UnitRt rt, long t, string mode = "real")
    {
        if (rt.Active != "active") return;
        var info = UnitInfo(rt);
        var def = DefFor(sh, rt.Name);
        var desc = info.Description != "" ? $"{rt.Name} - {info.Description}" : rt.Name;
        Log(sh, t, "systemd", $"Stopping {desc}...", unit: rt.Name);
        if (rt.Pid is int mainPid)
        {
            foreach (var line in def?.StopLog ?? new List<string>()) Log(sh, t, IdentOf(info.Exec), line, unit: rt.Name, pid: mainPid);
            if (mode != "record") sh.Proc.Procs = sh.Proc.Procs.Where(p => p.Pid != mainPid).ToList();
        }
        Log(sh, t, "systemd", $"{rt.Name}: Deactivated successfully.", unit: rt.Name);
        Log(sh, t, "systemd", $"Stopped {desc}.", unit: rt.Name);
        var lastPid = rt.Pid ?? rt.LastPid;
        var exitInfo = rt.Pid is not null ? "code=killed, signal=TERM" : rt.ExitInfo;
        rt.Active = "inactive";
        rt.Sub = "dead";
        rt.Since = t;
        rt.LastPid = lastPid;
        rt.Pid = null;
        rt.Result = null;
        rt.ExitInfo = exitInfo;
    }

    /// <summary>
    /// Reconciles the services with the process table: if the main process has been killed
    /// (e.g. with `sudo pkill myserver`) the service is no longer running.
    /// </summary>
    public static void SyncServices(Shell sh, long? t = null)
    {
        var now = t ?? Js.Now();
        foreach (var rt in sh.Services.Units.Values)
        {
            if (rt.Active != "active" || rt.Pid is null || HasProc(sh, rt.Pid)) continue;
            Log(sh, now, "systemd", $"{rt.Name}: Deactivated successfully.", unit: rt.Name);
            rt.Active = "inactive";
            rt.Sub = "dead";
            rt.Since = now;
            rt.LastPid = rt.Pid;
            rt.Pid = null;
            rt.ExitInfo = "code=killed, signal=TERM";
        }
    }

    /// <summary>Re-reads all unit files (systemctl daemon-reload).</summary>
    public static void DaemonReload(Shell sh)
    {
        var st = sh.Services;
        var names = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        void Add(string n)
        {
            if (seen.Add(n)) names.Add(n);
        }
        foreach (var k in st.Units.Keys) Add(k);
        foreach (var dir in new[] { SystemUnitDir, AdminUnitDir })
        {
            var node = sh.Vfs.TryLookup(dir, sh.RootUser());
            if (node?.Children is null) continue;
            foreach (var (name, child) in node.Children)
                if (child.Type == "file" && name.EndsWith(".service", StringComparison.Ordinal)) Add(name);
        }
        foreach (var name in names)
        {
            if (LoadUnit(sh, name) is not null) continue;
            // The unit file was removed: forget the service unless it is running.
            if (st.Units[name].Active != "active") st.Units.Remove(name);
        }
    }

    // ---------- Enable and disable ----------

    public static LinkChange EnableUnit(Shell sh, UnitRt rt)
    {
        var info = UnitInfo(rt);
        var change = new LinkChange();
        foreach (var target in info.WantedBy)
        {
            var path = WantsPath(target, rt.Name);
            if (sh.Vfs.TryLookup(path, sh.RootUser()) is not null) continue;
            var dir = EnsureDir(sh, $"{AdminUnitDir}/{target}.wants");
            // The virtual file system has no symbolic links – a copy of the unit file has to do.
            dir.Children![rt.Name] = VfsLib.MakeFile(FindUnitFile(sh, rt.Name)?.Content ?? rt.Loaded);
            change.Created.Add($"{path} → {rt.Path}");
        }
        return change;
    }

    public static LinkChange DisableUnit(Shell sh, UnitRt rt)
    {
        var info = UnitInfo(rt);
        var change = new LinkChange();
        foreach (var target in info.WantedBy)
        {
            var path = WantsPath(target, rt.Name);
            if (sh.Vfs.TryLookup(path, sh.RootUser()) is null) continue;
            sh.Vfs.Remove(path, sh.RootUser());
            change.Removed.Add(path);
        }
        return change;
    }

    // ---------- Boot ----------

    private static string HexId()
    {
        var s = new StringBuilder();
        for (int i = 0; i < 32; i++) s.Append(((int)Math.Floor(Js.Random() * 16)).ToString("x", CultureInfo.InvariantCulture));
        return s.ToString();
    }

    public static (int Major, string Full) SystemdVersion(Distro d) => d.Id switch
    {
        "ubuntu" => (255, "255.4-1ubuntu8.11"),
        "debian" => (257, "257.8-1~deb13u2"),
        "arch" => (258, "258.1-1-arch"),
        _ => (258, "258-1.fc43"),
    };

    /// <summary>The computer boots: the kernel, systemd and every service that should start at boot.</summary>
    private static long BootUp(Shell sh, long t0, string mode, User? user)
    {
        var st = sh.Services;
        st.Boots.Add(new BootRecord { Id = HexId(), Start = t0 });
        var d = sh.Distro;
        void K(string msg, int prio = 6) => Log(sh, t0, "kernel", msg, prio: prio);
        K($"Linux version {d.Kernel} (simulated) #1 SMP PREEMPT_DYNAMIC", 5);
        K($"Command line: BOOT_IMAGE=/boot/vmlinuz-{d.Kernel} root=UUID=1234-abcd ro quiet");
        K("ACPI BIOS Error (bug): Could not resolve symbol [\\_SB.PCI0.GPP0.SWUS], AE_NOT_FOUND (20240827/dswload2-162)", 3);
        K("ACPI Error: AE_NOT_FOUND, During name lookup/catalog (20240827/psobject-220)", 3);
        K("EXT4-fs (sda2): mounted filesystem with ordered data mode. Quota mode: none.");
        var t = t0 + 2153;
        Log(sh, t, "systemd", $"systemd {SystemdVersion(d).Full} running in system mode (+PAM +AUDIT +SELINUX +APPARMOR +SECCOMP +GCRYPT -GNUTLS +OPENSSL +ACL +BLKID +CURL +ELFUTILS +FIDO2 +IDN2 -IDN +KMOD +LIBCRYPTSETUP +LIBFDISK +PCRE2 +PWQUALITY +P11KIT +QRENCODE +TPM2 +BZIP2 +LZ4 +XZ +ZLIB +ZSTD +BPF_FRAMEWORK +XKBCOMMON +UTMP +SYSVINIT +LIBARCHIVE)");
        Log(sh, t, "systemd", "Detected virtualization kvm.");
        Log(sh, t, "systemd", $"Hostname set to <{d.Hostname}>.");
        foreach (var def in ServiceDefs(d))
        {
            if (!st.Units.TryGetValue(def.Name, out var rt)) continue;
            var wanted = def.Boot || EnabledState(sh, rt) == "enabled";
            if (!wanted) continue;
            t += 180;
            StartUnit(sh, rt, t, mode, true);
        }
        // The student's own services that are enabled.
        foreach (var rt in st.Units.Values.ToList())
        {
            if (DefFor(sh, rt.Name) is not null || EnabledState(sh, rt) != "enabled") continue;
            t += 180;
            StartUnit(sh, rt, t, mode, true);
        }
        t += 400;
        Log(sh, t, "systemd", "Reached target multi-user.target - Multi-User System.");
        Log(sh, t, "systemd", $"Startup finished in 2.153s (kernel) + {Js.ToFixed((t - t0 - 2153) / 1000.0, 3)}s (userspace) = {Js.ToFixed((t - t0) / 1000.0, 3)}s.");
        if (user is not null)
        {
            t += 20_000;
            Log(sh, t, "systemd-logind", $"New session 1 of user {user.Name}.", pid: 520, unit: "systemd-logind.service");
            Log(sh, t, "systemd", $"Started session-1.scope - Session 1 of User {user.Name}.");
        }
        return t;
    }

    private static void Shutdown(Shell sh, long t, string mode)
    {
        foreach (var rt in sh.Services.Units.Values.Reverse().ToList()) StopUnit(sh, rt, t, mode);
        Log(sh, t, "systemd", "Reached target shutdown.target - System Shutdown.");
        Log(sh, t, "systemd-shutdown", "Syncing filesystems and block devices.", pid: 1);
        Log(sh, t, "kernel", "reboot: Restarting system");
        foreach (var rt in sh.Services.Units.Values)
        {
            rt.Active = "inactive";
            rt.Sub = "dead";
            rt.Pid = null;
            rt.Result = null;
        }
    }

    /// <summary>Creates the service model for a new (or old saved) computer.</summary>
    public static ServiceState InitialServices(Shell sh)
    {
        var st = new ServiceState { Units = Js.Obj<UnitRt>(), Journal = new(), Boots = new(), Job = 100, MachineId = HexId() };
        sh.Services = st;
        WriteUnitFiles(sh);
        foreach (var def in ServiceDefs(sh.Distro)) LoadUnit(sh, def.Name);
        var student = sh.GetUser(sh.World.User);
        var now = Js.Now();
        var bootStart = now - (2 * 3600 + 14 * 60) * 1000L;

        // The previous boot (yesterday) – only journal lines. reportd.conf existed then.
        var prevStart = bootStart - 24 * 3600 * 1000L;
        var t = BootUp(sh, prevStart, "record", student);
        var server = st.Units["myserver.service"];
        t += 30_000;
        StartUnit(sh, server, t, "record");
        Shutdown(sh, prevStart + 9 * 3600 * 1000L, "record");

        // This boot. The processes already exist in the process table.
        t = BootUp(sh, bootStart, "init", student);
        // The administrator started the exercise server by hand – but never enabled it.
        t += 10_000;
        Log(sh, t, "sudo", $"{student.Name} : TTY=pts/0 ; PWD=/home/{student.Name} ; USER=root ; COMMAND=/usr/bin/systemctl start myserver", pid: 1240);
        StartUnit(sh, server, t, "init", true);
        // Processes killed before the model existed (older saved terminals).
        SyncServices(sh, now);
        return st;
    }

    /// <summary>Reboots the computer: every service is stopped, and the enabled ones start again.</summary>
    public static void Reboot(Shell sh)
    {
        var now = Js.Now();
        SyncServices(sh, now);
        Shutdown(sh, now, "real");
        // Everything that is not a service disappears – except the base that always exists.
        var servicePids = new HashSet<int?>(ServiceDefs(sh.Distro).Select(d => d.Pid));
        var @base = ProcsLib.InitialProcs(sh.Distro, sh.World.User).Procs.Where(p => !servicePids.Contains(p.Pid) && p.Pid != ProcsLib.RunawayPid).ToList();
        sh.Proc.Procs = @base;
        sh.Proc.Jobs = new List<Job>();
        foreach (var rt in sh.Services.Units.Values)
        {
            rt.LastPid = null;
            rt.ExitInfo = null;
            rt.Since = null;
        }
        BootUp(sh, now + 3000, "real", sh.GetUser(sh.World.User));
    }
}
