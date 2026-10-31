using Codestead.Shell.Commands;

namespace Codestead.Shell.Tests;

// Port of src/shell/services.test.ts
public class ServicesTests
{
    private static List<Proc> Procs(TestShell t, string name) => t.Sh.Proc.Procs.Where(p => p.Cmd.Contains(name)).ToList();

    private static string[] Lines(string s) => s.Trim().Split('\n');

    /// <summary>new Date(y, m, d, h, mi, s).getTime() (month 0-based, local time).</summary>
    private static long LocalMs(int y, int m, int d, int h = 0, int mi = 0, int s = 0) =>
        new DateTimeOffset(new DateTime(y, m + 1, d, h, mi, s, DateTimeKind.Local)).ToUnixTimeMilliseconds();

    // ---------- systemctl status ----------

    [Fact(DisplayName = "ssh heter olika i olika familjer")]
    public void SshNamesDifferPerFamily()
    {
        foreach (var (distro, name) in new[] { ("ubuntu", "ssh"), ("debian", "ssh"), ("arch", "sshd"), ("fedora", "sshd") })
        {
            var t = new TestShell(distro);
            var r = t.Run($"systemctl status {name}");
            Assert.True(r.ExitCode == 0, distro);
            Assert.Contains($"● {name}.service - ", r.Out);
            Assert.Contains("Active: active (running)", r.Out);
            Assert.Contains("Main PID: 733 (sshd)", r.Out);
            Assert.Contains("Server listening on 0.0.0.0 port 22.", r.Out);
        }
        // Debian has the alias sshd.service, Fedora has no ssh.service.
        Assert.Contains("● ssh.service", new TestShell("debian").Run("systemctl status sshd").Out);
        var fedora = new TestShell("fedora").Run("systemctl status ssh");
        Assert.Equal(4, fedora.ExitCode);
        Assert.Contains("Unit ssh.service could not be found.", fedora.Out);
    }

    [Fact(DisplayName = "statiska tjänster och översikten")]
    public void StaticServicesAndOverview()
    {
        var t = new TestShell("arch");
        Assert.Contains("systemd-journald.service; static)", t.Run("systemctl status systemd-journald").Out);
        var overview = t.Run("systemctl status").Out;
        Assert.Contains("State: degraded", overview);
        Assert.Contains("Failed: 1 units", overview);
        Assert.Equal("degraded\n", t.Run("systemctl is-system-running").Out);
    }

    [Fact(DisplayName = "cron finns i Debian och Fedora men inte i Arch")]
    public void CronInDebianAndFedora()
    {
        Assert.Equal("active\n", new TestShell("ubuntu").Run("systemctl is-active cron").Out);
        Assert.Equal("active\n", new TestShell("fedora").Run("systemctl is-active crond").Out);
        Assert.Contains(new TestShell("fedora").Sh.Proc.Procs, p => p.Cmd == "/usr/sbin/crond -n");
        var arch = new TestShell("arch").Run("systemctl is-active cronie");
        Assert.Equal("inactive\n", arch.Out);
        Assert.Equal(4, arch.ExitCode);
    }

    // ---------- den trasiga tjänsten reportd ----------

    [Fact(DisplayName = "syns i --failed och journalen förklarar felet")]
    public void ReportdFailedAndJournal()
    {
        var t = new TestShell();
        var failed = t.Run("systemctl --failed");
        Assert.Matches(@"● reportd\.service\s+loaded failed failed", failed.Out);
        Assert.Contains("1 loaded units listed.", failed.Out);
        var status = t.Run("systemctl status reportd");
        Assert.Equal(3, status.ExitCode);
        Assert.Contains("× reportd.service", status.Out);
        Assert.Contains("Active: failed (Result: exit-code)", status.Out);
        Assert.Contains("status=1/FAILURE", status.Out);
        var log = t.Run("journalctl -u reportd -b");
        Assert.Contains("error: cannot open config file /etc/reportd.conf: No such file or directory", log.Out);
        Assert.DoesNotContain("Report scheduler ready", log.Out);
        // Yesterday it worked.
        Assert.Contains("Report scheduler ready", t.Run("journalctl -u reportd -b -1").Out);
    }

    [Fact(DisplayName = "-xeu ger förklaringar")]
    public void XeuExplains()
    {
        var t = new TestShell("debian");
        var r = t.Run("journalctl -xeu reportd");
        Assert.Contains("░░ Subject: Unit failed", r.Out);
        Assert.Contains("░░ The unit reportd.service has entered the 'failed' state with result 'exit-code'.", r.Out);
        Assert.Contains("░░ Support: https://www.debian.org/support", r.Out);
    }

    [Fact(DisplayName = "omstart kräver root, misslyckas utan konfiguration och lyckas efter rättningen")]
    public void RestartNeedsRootAndConfig()
    {
        var t = new TestShell("fedora");
        var noRoot = t.Run("systemctl restart reportd");
        Assert.Equal(1, noRoot.ExitCode);
        Assert.Contains("Failed to restart reportd.service: Interactive authentication required.", noRoot.Out);
        var again = t.Run("sudo systemctl restart reportd");
        Assert.Equal(1, again.ExitCode);
        Assert.Contains("Job for reportd.service failed because the control process exited with error code.", again.Out);
        Assert.Contains("journalctl -xeu reportd.service", again.Out);
        Assert.Empty(Procs(t, "reportd"));

        Assert.Equal(0, t.Run("sudo cp /etc/reportd.conf.example /etc/reportd.conf").ExitCode);
        var ok = t.Run("sudo systemctl restart reportd");
        Assert.Equal(0, ok.ExitCode);
        Assert.Equal("active", t.Sh.Services.Units["reportd.service"].Active);
        Assert.Single(Procs(t, "reportd"));
        Assert.Equal("active\n", t.Run("systemctl is-active reportd").Out);
        Assert.Contains("0 loaded units listed.", t.Run("systemctl --failed").Out);
        var status = t.Run("systemctl status reportd").Out;
        Assert.Contains("Active: active (running)", status);
        Assert.Contains("Report scheduler ready (interval 1h)", status);
        Assert.DoesNotContain("cannot open config file", status);
    }

    // ---------- myserver och processtabellen ----------

    [Fact(DisplayName = "stop tar bort processen och start lägger tillbaka den med ny PID")]
    public void StopAndStartMyserver()
    {
        var t = new TestShell();
        Assert.Equal(ProcsLib.ServerPid, Procs(t, "myserver")[0].Pid);
        Assert.Equal(1, t.Run("systemctl stop myserver").ExitCode);
        Assert.Single(Procs(t, "myserver"));
        Assert.Equal(0, t.Run("sudo systemctl stop myserver").ExitCode);
        Assert.Empty(Procs(t, "myserver"));
        Assert.Contains("Active: inactive (dead)", t.Run("systemctl status myserver").Out);
        Assert.Equal(3, t.Run("systemctl is-active myserver").ExitCode);
        Assert.Equal(0, t.Run("sudo systemctl start myserver").ExitCode);
        var proc = Procs(t, "myserver")[0];
        Assert.NotEqual(ProcsLib.ServerPid, proc.Pid);
        Assert.Equal($"{proc.Pid}\n", t.Run("pgrep myserver").Out);
        Assert.Contains($"Main PID: {proc.Pid} (myserver)", t.Run("systemctl status myserver").Out);
    }

    [Fact(DisplayName = "systemd märker när processen dödas med kill")]
    public void NoticesKill()
    {
        var t = new TestShell("arch");
        t.Run("sudo pkill myserver");
        var r = t.Run("systemctl status myserver");
        Assert.Contains("○ myserver.service", r.Out);
        Assert.Contains("Active: inactive (dead)", r.Out);
        Assert.Contains("myserver.service: Deactivated successfully.", r.Out);
    }

    [Fact(DisplayName = "enable, disable och is-enabled")]
    public void EnableDisableIsEnabled()
    {
        var t = new TestShell("debian");
        var sh = t.Sh;
        const string wants = "/etc/systemd/system/multi-user.target.wants/myserver.service";
        Assert.Equal("disabled\n", t.Run("systemctl is-enabled myserver").Out);
        Assert.Contains("Failed to enable unit: Interactive authentication required.", t.Run("systemctl enable myserver").Out);
        var r = t.Run("sudo systemctl enable myserver");
        Assert.Contains($"Created symlink {wants} → /etc/systemd/system/myserver.service.", r.Out);
        Assert.NotNull(sh.Vfs.TryLookup(wants, sh.RootUser()));
        Assert.Equal("enabled\n", t.Run("systemctl is-enabled myserver").Out);
        Assert.Equal("", t.Run("sudo systemctl enable myserver").Out);
        Assert.Contains($"Removed \"{wants}\".", t.Run("sudo systemctl disable --now myserver").Out);
        Assert.Equal("inactive", sh.Services.Units["myserver.service"].Active);
        Assert.Equal(1, t.Run("systemctl is-enabled myserver").ExitCode);
        Assert.Equal(0, t.Run("sudo systemctl enable --now myserver").ExitCode);
        Assert.Equal("active", sh.Services.Units["myserver.service"].Active);
        Assert.Equal("alias\n", t.Run("systemctl is-enabled sshd").Out);
        Assert.Contains("no installation config", t.Run("sudo systemctl enable systemd-logind").Out);
    }

    [Fact(DisplayName = "reload kräver stöd och att tjänsten kör")]
    public void ReloadNeedsSupportAndRunning()
    {
        var t = new TestShell();
        Assert.Equal(0, t.Run("sudo systemctl reload myserver").ExitCode);
        Assert.Contains("Reloaded myserver.service", t.Run("journalctl -u myserver -n 2").Out);
        Assert.Contains("Job type reload is not applicable", t.Run("sudo systemctl reload cron").Out);
        t.Run("sudo systemctl stop myserver");
        Assert.Contains("is not active", t.Run("sudo systemctl reload myserver").Out);
    }

    // ---------- journalctl ----------

    [Fact(DisplayName = "-p err visar bara fel")]
    public void PrioErrShowsOnlyErrors()
    {
        var t = new TestShell();
        var sh = t.Sh;
        var r = t.Run("journalctl -p err -b");
        var lines = Lines(r.Out);
        Assert.True(lines.Length >= 3);
        Assert.Contains("ACPI BIOS Error", r.Out);
        Assert.Contains("reportd", r.Out);
        Assert.DoesNotContain("Started", r.Out);
        var cur = sh.Services.Boots.Count - 1;
        var errs = sh.Services.Journal.Where(e => e.Boot == cur && e.Prio <= 3).ToList();
        Assert.Equal(errs.Count, lines.Length);
        Assert.Contains("Failed with result 'exit-code'", t.Run("journalctl -p warning..warning -b").Out);
    }

    [Fact(DisplayName = "-n, -r, -f, -k, -g och -o cat")]
    public void JournalctlFlags()
    {
        var t = new TestShell();
        Assert.Equal(3, Lines(t.Run("journalctl -n 3").Out).Length);
        Assert.Equal(10, Lines(t.Run("journalctl -n").Out).Length);
        Assert.Equal("Started ssh.service - OpenBSD Secure Shell server.\n", t.Run("journalctl -u ssh -n 1 -o cat").Out);
        var f = t.Run("journalctl -f");
        Assert.Equal(11, Lines(f.Out).Length);
        Assert.Contains("Ctrl+C", f.Out);
        Assert.Matches("kernel: Linux version", t.Run("journalctl -k").Out);
        Assert.DoesNotContain("systemd[1]", t.Run("journalctl -k").Out);
        Assert.Equal(2, Lines(t.Run("journalctl -g listening -u ssh -b").Out).Length);
        var rev = Lines(t.Run("journalctl -r -u ssh -b").Out);
        Assert.Contains("Started ssh.service", rev[0]);
    }

    [Fact(DisplayName = "uppstarter, tider och fel")]
    public void BootsTimesErrors()
    {
        var t = new TestShell();
        Assert.Equal(3, Lines(t.Run("journalctl --list-boots").Out).Length);
        Assert.Equal(1, t.Run("journalctl -b -5").ExitCode);
        Assert.Equal("-- No entries --\n", t.Run("journalctl --since today -u nisse").Out);
        Assert.Equal("-- No entries --\n", t.Run("journalctl --since \"1 hour ago\" -u reportd").Out);
        Assert.Contains("Failed to parse timestamp", t.Run("journalctl --since igår").Out);
        Assert.Equal(1, t.Run("journalctl --nope").ExitCode);
        Assert.Contains("-- Boot ", t.Run("journalctl").Out);
    }

    [Fact(DisplayName = "parseSince")]
    public void ParseSince()
    {
        var now = LocalMs(2026, 9, 30, 12, 30, 0);
        Assert.Equal(LocalMs(2026, 9, 30), SystemdCmd.ParseSince("today", now));
        Assert.Equal(LocalMs(2026, 9, 29), SystemdCmd.ParseSince("yesterday", now));
        Assert.Equal(LocalMs(2026, 9, 30, 10, 15), SystemdCmd.ParseSince("10:15", now));
        Assert.Equal(LocalMs(2026, 9, 1, 8, 0), SystemdCmd.ParseSince("2026-10-01 08:00", now));
        Assert.Equal(now - 7_200_000, SystemdCmd.ParseSince("-2h", now));
        Assert.Equal(now - 1_800_000, SystemdCmd.ParseSince("30 min ago", now));
        Assert.Null(SystemdCmd.ParseSince("snart", now));
    }

    // ---------- unit-filer ----------

    [Fact(DisplayName = "cat, list-unit-files och daemon-reload")]
    public void CatListUnitFilesDaemonReload()
    {
        var t = new TestShell("fedora");
        var sh = t.Sh;
        var cat = t.Run("systemctl cat sshd").Out;
        Assert.Contains("# /usr/lib/systemd/system/sshd.service", cat);
        Assert.Contains("ExecStart=/usr/sbin/sshd -D", cat);
        Assert.Contains("myserver.service", t.Run("ls /etc/systemd/system").Out);
        Assert.Matches(@"myserver\.service\s+disabled\s+disabled", t.Run("systemctl list-unit-files").Out);

        t.Run("sudo sed -i \"s/practice server/övning/\" /etc/systemd/system/myserver.service");
        Assert.Contains("changed on disk. Run 'systemctl daemon-reload'", t.Run("systemctl status myserver").Out);
        Assert.Equal(1, t.Run("systemctl daemon-reload").ExitCode);
        t.Run("sudo systemctl daemon-reload");
        var status = t.Run("systemctl status myserver").Out;
        Assert.DoesNotContain("changed on disk", status);
        Assert.Contains("myserver.service - Myserver web server (övning)", status);
        Assert.Contains("(övning)", sh.Services.Units["myserver.service"].Loaded);
    }

    [Fact(DisplayName = "egna tjänster: start och 203/EXEC")]
    public void OwnServicesStartAndExecFailure()
    {
        var t = new TestShell();
        var sh = t.Sh;
        t.Run("echo '[Unit]' | sudo tee /etc/systemd/system/vila.service");
        t.Run("echo 'Description=Sover länge' | sudo tee -a /etc/systemd/system/vila.service");
        t.Run("echo '[Service]' | sudo tee -a /etc/systemd/system/vila.service");
        t.Run("echo 'ExecStart=/usr/bin/sleep 1000' | sudo tee -a /etc/systemd/system/vila.service");
        Assert.Equal(0, t.Run("sudo systemctl start vila").ExitCode);
        Assert.Contains(sh.Proc.Procs, p => p.Cmd == "/usr/bin/sleep 1000");
        Assert.Contains("● vila.service - Sover länge", t.Run("systemctl status vila").Out);

        t.Run("printf '[Service]\\nExecStart=/opt/finns-inte\\n' | sudo tee /etc/systemd/system/trasig.service");
        Assert.Equal(1, t.Run("sudo systemctl start trasig").ExitCode);
        var status = t.Run("systemctl status trasig").Out;
        Assert.Contains("status=203/EXEC", status);
        Assert.Contains("Failed to locate executable /opt/finns-inte", t.Run("journalctl -u trasig").Out);
        Assert.Contains("Unit finns-inte.service not found.", t.Run("sudo systemctl start finns-inte").Out);
    }

    // ---------- omstart och sparat tillstånd ----------

    [Fact(DisplayName = "bara aktiverade tjänster startar efter reboot")]
    public void OnlyEnabledServicesStartAfterReboot()
    {
        var t = new TestShell("arch");
        var sh = t.Sh;
        t.Run("sudo pkill myserver");
        t.Run("sleep 300 &");
        Assert.Equal(1, t.Run("reboot").ExitCode);
        Assert.Equal(0, t.Run("sudo reboot").ExitCode);
        Assert.Empty(Procs(t, "myserver"));
        Assert.Empty(sh.Proc.Jobs);
        Assert.Single(Procs(t, "/usr/sbin/sshd"));
        Assert.Equal("failed", sh.Services.Units["reportd.service"].Active);
        Assert.Equal("/home/elev", sh.Cwd);

        t.Run("sudo systemctl enable myserver");
        t.Run("sudo cp /etc/reportd.conf.example /etc/reportd.conf");
        t.Run("sudo systemctl reboot");
        Assert.Equal(ProcsLib.ServerPid, Procs(t, "myserver").FirstOrDefault()?.Pid);
        Assert.Equal("active", sh.Services.Units["reportd.service"].Active);
        Assert.Equal(5, Lines(t.Run("journalctl --list-boots").Out).Length); // header + 4 boots
        Assert.Contains("reboot: Restarting system", t.Run("journalctl -b -1 -n 1").Out);
    }

    [Fact(DisplayName = "tjänsterna sparas och gamla sparade terminaler får tjänster")]
    public void ServicesAreSavedAndOldSnapshotsGetServices()
    {
        var t = new TestShell("debian");
        t.Run("sudo systemctl stop ssh");
        var copy = Shell.RestoreJson(t.Sh.SnapshotJson())!;
        Assert.Equal("inactive", copy.Services.Units["ssh.service"].Active);
        Assert.Equal("inactive\n", copy.Execute("systemctl is-active ssh").Output);

        // A terminal saved before systemd existed, where myserver had already been killed.
        var old = Shell.Create("debian", "sv");
        old.Execute("sudo pkill myserver");
        var snap = Js.Parse<ShellSnapshot>(old.SnapshotJson())!;
        snap.Services = null;
        var restored = Shell.Restore(snap)!;
        Assert.Equal("inactive", restored.Services.Units["myserver.service"].Active);
        Assert.Equal("active", restored.Services.Units["ssh.service"].Active);
        Assert.Equal(3, restored.Execute("systemctl status reportd").ExitCode);
    }

    // ---------- hostnamectl och systemd-analyze ----------

    [Fact(DisplayName = "hostnamectl visar och byter namn")]
    public void Hostnamectl()
    {
        var t = new TestShell("fedora");
        var sh = t.Sh;
        var r = t.Run("hostnamectl");
        Assert.Contains("Static hostname: fedora", r.Out);
        Assert.Contains("Operating System: Fedora Linux 43 (Workstation Edition)", r.Out);
        Assert.Equal(1, t.Run("hostnamectl set-hostname labb").ExitCode);
        Assert.Equal(0, t.Run("sudo hostnamectl set-hostname labb").ExitCode);
        Assert.Equal("labb\n", sh.Vfs.ReadFile("/etc/hostname", sh.RootUser()));
        Assert.Contains("Static hostname: labb", t.Run("hostnamectl").Out);
    }

    [Fact(DisplayName = "systemd-analyze")]
    public void SystemdAnalyze()
    {
        var t = new TestShell();
        Assert.Matches(@"^Startup finished in 2\.153s \(kernel\) \+ [0-9.]+s \(userspace\)", t.Run("systemd-analyze").Out);
        var blame = t.Run("systemd-analyze blame").Out;
        Assert.Contains("ssh.service", blame);
        Assert.Contains("reportd.service", blame);
    }

    [Fact(DisplayName = "kommandona kommer från paketet systemd")]
    public void CommandsComeFromSystemdPackage()
    {
        var t = new TestShell("arch");
        Assert.Equal("/usr/bin/systemctl\n/usr/bin/journalctl\n", t.Run("which systemctl journalctl").Out);
        Assert.Contains("journalctl - läs systemd:s logg", t.Run("man journalctl").Out);
    }
}
