namespace Codestead.Shell;

// Port of src/shell/services.ts – the services of the simulated computer, a simplified model of systemd.
//
// Every service (unit) has a unit file in the virtual file system and a run state
// (active/inactive/failed) with a main process in the process table (`sh.Proc`). Everything that
// happens is written to the journal, which `journalctl` reads. The state is saved in the shell
// (`sh.Services`) together with the rest of the computer.

public static partial class ServicesLib
{
    /// <summary>Unit files shipped with the packages. (In older Debian: /lib/systemd/system.)</summary>
    public const string SystemUnitDir = "/usr/lib/systemd/system";
    /// <summary>Unit files the administrator wrote or changed. Take precedence.</summary>
    public const string AdminUnitDir = "/etc/systemd/system";

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
