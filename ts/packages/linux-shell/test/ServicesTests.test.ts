// Port of tests/Linux/Codestead.Shell.Tests/ServicesTests.cs (src/shell/services.test.ts).

import { describe, expect, it } from "vitest";
import * as SystemdCmd from "../src/Commands/Systemd/SystemdCmd.js";
import type { Proc } from "../src/Procs/Proc.js";
import * as ProcsLib from "../src/Procs/ProcsLib.js";
import { Shell } from "../src/Shell/Shell.js";
import { snapshotFromJson } from "../src/Shell/ShellSnapshot.js";
import { itNeeds, TestShell } from "./TestShell.js";

function procs(t: TestShell, name: string): Proc[] {
  return t.sh.proc.procs.filter((p) => p.cmd.includes(name));
}

function lines(s: string): string[] {
  return s.trim().split("\n");
}

/** new Date(y, m, d, h, mi, s).getTime() (month 0-based, local time). */
function localMs(y: number, m: number, d: number, h = 0, mi = 0, s = 0): number {
  return new Date(y, m, d, h, mi, s).getTime();
}

describe("ServicesTests", () => {
  // ---------- systemctl status ----------

  it("ssh heter olika i olika familjer", () => {
    for (const [distro, name] of [
      ["ubuntu", "ssh"],
      ["debian", "ssh"],
      ["arch", "sshd"],
      ["fedora", "sshd"],
    ] as const) {
      const t = new TestShell(distro);
      const r = t.run(`systemctl status ${name}`);
      expect(r.exitCode, distro).toBe(0);
      expect(r.out).toContain(`● ${name}.service - `);
      expect(r.out).toContain("Active: active (running)");
      expect(r.out).toContain("Main PID: 733 (sshd)");
      expect(r.out).toContain("Server listening on 0.0.0.0 port 22.");
    }
    // Debian has the alias sshd.service, Fedora has no ssh.service.
    expect(new TestShell("debian").run("systemctl status sshd").out).toContain("● ssh.service");
    const fedora = new TestShell("fedora").run("systemctl status ssh");
    expect(fedora.exitCode).toBe(4);
    expect(fedora.out).toContain("Unit ssh.service could not be found.");
  });

  it("statiska tjänster och översikten", () => {
    const t = new TestShell("arch");
    expect(t.run("systemctl status systemd-journald").out).toContain("systemd-journald.service; static)");
    const overview = t.run("systemctl status").out;
    expect(overview).toContain("State: degraded");
    expect(overview).toContain("Failed: 1 units");
    expect(t.run("systemctl is-system-running").out).toBe("degraded\n");
  });

  it("cron finns i Debian och Fedora men inte i Arch", () => {
    expect(new TestShell("ubuntu").run("systemctl is-active cron").out).toBe("active\n");
    expect(new TestShell("fedora").run("systemctl is-active crond").out).toBe("active\n");
    expect(new TestShell("fedora").sh.proc.procs.some((p) => p.cmd === "/usr/sbin/crond -n")).toBe(true);
    const arch = new TestShell("arch").run("systemctl is-active cronie");
    expect(arch.out).toBe("inactive\n");
    expect(arch.exitCode).toBe(4);
  });

  // ---------- den trasiga tjänsten reportd ----------

  it("syns i --failed och journalen förklarar felet", () => {
    const t = new TestShell();
    const failed = t.run("systemctl --failed");
    expect(failed.out).toMatch(/● reportd\.service\s+loaded failed failed/);
    expect(failed.out).toContain("1 loaded units listed.");
    const status = t.run("systemctl status reportd");
    expect(status.exitCode).toBe(3);
    expect(status.out).toContain("× reportd.service");
    expect(status.out).toContain("Active: failed (Result: exit-code)");
    expect(status.out).toContain("status=1/FAILURE");
    const log = t.run("journalctl -u reportd -b");
    expect(log.out).toContain("error: cannot open config file /etc/reportd.conf: No such file or directory");
    expect(log.out).not.toContain("Report scheduler ready");
    // Yesterday it worked.
    expect(t.run("journalctl -u reportd -b -1").out).toContain("Report scheduler ready");
  });

  it("-xeu ger förklaringar", () => {
    const t = new TestShell("debian");
    const r = t.run("journalctl -xeu reportd");
    expect(r.out).toContain("░░ Subject: Unit failed");
    expect(r.out).toContain("░░ The unit reportd.service has entered the 'failed' state with result 'exit-code'.");
    expect(r.out).toContain("░░ Support: https://www.debian.org/support");
  });

  itNeeds(["sudo", "cp"], "omstart kräver root, misslyckas utan konfiguration och lyckas efter rättningen", () => {
    const t = new TestShell("fedora");
    const noRoot = t.run("systemctl restart reportd");
    expect(noRoot.exitCode).toBe(1);
    expect(noRoot.out).toContain("Failed to restart reportd.service: Interactive authentication required.");
    const again = t.run("sudo systemctl restart reportd");
    expect(again.exitCode).toBe(1);
    expect(again.out).toContain("Job for reportd.service failed because the control process exited with error code.");
    expect(again.out).toContain("journalctl -xeu reportd.service");
    expect(procs(t, "reportd")).toHaveLength(0);

    expect(t.run("sudo cp /etc/reportd.conf.example /etc/reportd.conf").exitCode).toBe(0);
    const ok = t.run("sudo systemctl restart reportd");
    expect(ok.exitCode).toBe(0);
    expect(t.sh.services.units.get("reportd.service")!.active).toBe("active");
    expect(procs(t, "reportd")).toHaveLength(1);
    expect(t.run("systemctl is-active reportd").out).toBe("active\n");
    expect(t.run("systemctl --failed").out).toContain("0 loaded units listed.");
    const status = t.run("systemctl status reportd").out;
    expect(status).toContain("Active: active (running)");
    expect(status).toContain("Report scheduler ready (interval 1h)");
    expect(status).not.toContain("cannot open config file");
  });

  // ---------- myserver och processtabellen ----------

  itNeeds(["sudo"], "stop tar bort processen och start lägger tillbaka den med ny PID", () => {
    const t = new TestShell();
    expect(procs(t, "myserver")[0]!.pid).toBe(ProcsLib.ServerPid);
    expect(t.run("systemctl stop myserver").exitCode).toBe(1);
    expect(procs(t, "myserver")).toHaveLength(1);
    expect(t.run("sudo systemctl stop myserver").exitCode).toBe(0);
    expect(procs(t, "myserver")).toHaveLength(0);
    expect(t.run("systemctl status myserver").out).toContain("Active: inactive (dead)");
    expect(t.run("systemctl is-active myserver").exitCode).toBe(3);
    expect(t.run("sudo systemctl start myserver").exitCode).toBe(0);
    const proc = procs(t, "myserver")[0]!;
    expect(proc.pid).not.toBe(ProcsLib.ServerPid);
    expect(t.run("pgrep myserver").out).toBe(`${proc.pid}\n`);
    expect(t.run("systemctl status myserver").out).toContain(`Main PID: ${proc.pid} (myserver)`);
  });

  itNeeds(["sudo"], "systemd märker när processen dödas med kill", () => {
    const t = new TestShell("arch");
    t.run("sudo pkill myserver");
    const r = t.run("systemctl status myserver");
    expect(r.out).toContain("○ myserver.service");
    expect(r.out).toContain("Active: inactive (dead)");
    expect(r.out).toContain("myserver.service: Deactivated successfully.");
  });

  itNeeds(["sudo"], "enable, disable och is-enabled", () => {
    const t = new TestShell("debian");
    const sh = t.sh;
    const wants = "/etc/systemd/system/multi-user.target.wants/myserver.service";
    expect(t.run("systemctl is-enabled myserver").out).toBe("disabled\n");
    expect(t.run("systemctl enable myserver").out).toContain("Failed to enable unit: Interactive authentication required.");
    const r = t.run("sudo systemctl enable myserver");
    expect(r.out).toContain(`Created symlink ${wants} → /etc/systemd/system/myserver.service.`);
    expect(sh.vfs.tryLookup(wants, sh.rootUser())).not.toBeNull();
    expect(t.run("systemctl is-enabled myserver").out).toBe("enabled\n");
    expect(t.run("sudo systemctl enable myserver").out).toBe("");
    expect(t.run("sudo systemctl disable --now myserver").out).toContain(`Removed "${wants}".`);
    expect(sh.services.units.get("myserver.service")!.active).toBe("inactive");
    expect(t.run("systemctl is-enabled myserver").exitCode).toBe(1);
    expect(t.run("sudo systemctl enable --now myserver").exitCode).toBe(0);
    expect(sh.services.units.get("myserver.service")!.active).toBe("active");
    expect(t.run("systemctl is-enabled sshd").out).toBe("alias\n");
    expect(t.run("sudo systemctl enable systemd-logind").out).toContain("no installation config");
  });

  itNeeds(["sudo"], "reload kräver stöd och att tjänsten kör", () => {
    const t = new TestShell();
    expect(t.run("sudo systemctl reload myserver").exitCode).toBe(0);
    expect(t.run("journalctl -u myserver -n 2").out).toContain("Reloaded myserver.service");
    expect(t.run("sudo systemctl reload cron").out).toContain("Job type reload is not applicable");
    t.run("sudo systemctl stop myserver");
    expect(t.run("sudo systemctl reload myserver").out).toContain("is not active");
  });

  // ---------- journalctl ----------

  it("-p err visar bara fel", () => {
    const t = new TestShell();
    const sh = t.sh;
    const r = t.run("journalctl -p err -b");
    const ls = lines(r.out);
    expect(ls.length >= 3).toBe(true);
    expect(r.out).toContain("ACPI BIOS Error");
    expect(r.out).toContain("reportd");
    expect(r.out).not.toContain("Started");
    const cur = sh.services.boots.length - 1;
    const errs = sh.services.journal.filter((e) => e.boot === cur && e.prio <= 3);
    expect(ls.length).toBe(errs.length);
    expect(t.run("journalctl -p warning..warning -b").out).toContain("Failed with result 'exit-code'");
  });

  it("-n, -r, -f, -k, -g och -o cat", () => {
    const t = new TestShell();
    expect(lines(t.run("journalctl -n 3").out)).toHaveLength(3);
    expect(lines(t.run("journalctl -n").out)).toHaveLength(10);
    expect(t.run("journalctl -u ssh -n 1 -o cat").out).toBe("Started ssh.service - OpenBSD Secure Shell server.\n");
    const f = t.run("journalctl -f");
    expect(lines(f.out)).toHaveLength(11);
    expect(f.out).toContain("Ctrl+C");
    expect(t.run("journalctl -k").out).toMatch(/kernel: Linux version/);
    expect(t.run("journalctl -k").out).not.toContain("systemd[1]");
    expect(lines(t.run("journalctl -g listening -u ssh -b").out)).toHaveLength(2);
    const rev = lines(t.run("journalctl -r -u ssh -b").out);
    expect(rev[0]).toContain("Started ssh.service");
  });

  it("uppstarter, tider och fel", () => {
    const t = new TestShell();
    expect(lines(t.run("journalctl --list-boots").out)).toHaveLength(3);
    expect(t.run("journalctl -b -5").exitCode).toBe(1);
    expect(t.run("journalctl --since today -u nisse").out).toBe("-- No entries --\n");
    expect(t.run('journalctl --since "1 hour ago" -u reportd').out).toBe("-- No entries --\n");
    expect(t.run("journalctl --since igår").out).toContain("Failed to parse timestamp");
    expect(t.run("journalctl --nope").exitCode).toBe(1);
    expect(t.run("journalctl").out).toContain("-- Boot ");
  });

  it("parseSince", () => {
    const now = localMs(2026, 9, 30, 12, 30, 0);
    expect(SystemdCmd.parseSince("today", now)).toBe(localMs(2026, 9, 30));
    expect(SystemdCmd.parseSince("yesterday", now)).toBe(localMs(2026, 9, 29));
    expect(SystemdCmd.parseSince("10:15", now)).toBe(localMs(2026, 9, 30, 10, 15));
    expect(SystemdCmd.parseSince("2026-10-01 08:00", now)).toBe(localMs(2026, 9, 1, 8, 0));
    expect(SystemdCmd.parseSince("-2h", now)).toBe(now - 7_200_000);
    expect(SystemdCmd.parseSince("30 min ago", now)).toBe(now - 1_800_000);
    expect(SystemdCmd.parseSince("snart", now)).toBeNull();
  });

  // ---------- unit-filer ----------

  itNeeds(["ls", "sudo", "sed"], "cat, list-unit-files och daemon-reload", () => {
    const t = new TestShell("fedora");
    const sh = t.sh;
    const cat = t.run("systemctl cat sshd").out;
    expect(cat).toContain("# /usr/lib/systemd/system/sshd.service");
    expect(cat).toContain("ExecStart=/usr/sbin/sshd -D");
    expect(t.run("ls /etc/systemd/system").out).toContain("myserver.service");
    expect(t.run("systemctl list-unit-files").out).toMatch(/myserver\.service\s+disabled\s+disabled/);

    t.run('sudo sed -i "s/practice server/övning/" /etc/systemd/system/myserver.service');
    expect(t.run("systemctl status myserver").out).toContain("changed on disk. Run 'systemctl daemon-reload'");
    expect(t.run("systemctl daemon-reload").exitCode).toBe(1);
    t.run("sudo systemctl daemon-reload");
    const status = t.run("systemctl status myserver").out;
    expect(status).not.toContain("changed on disk");
    expect(status).toContain("myserver.service - Myserver web server (övning)");
    expect(sh.services.units.get("myserver.service")!.loaded).toContain("(övning)");
  });

  itNeeds(["echo", "sudo", "tee", "printf"], "egna tjänster: start och 203/EXEC", () => {
    const t = new TestShell();
    const sh = t.sh;
    t.run("echo '[Unit]' | sudo tee /etc/systemd/system/vila.service");
    t.run("echo 'Description=Sover länge' | sudo tee -a /etc/systemd/system/vila.service");
    t.run("echo '[Service]' | sudo tee -a /etc/systemd/system/vila.service");
    t.run("echo 'ExecStart=/usr/bin/sleep 1000' | sudo tee -a /etc/systemd/system/vila.service");
    expect(t.run("sudo systemctl start vila").exitCode).toBe(0);
    expect(sh.proc.procs.some((p) => p.cmd === "/usr/bin/sleep 1000")).toBe(true);
    expect(t.run("systemctl status vila").out).toContain("● vila.service - Sover länge");

    t.run("printf '[Service]\\nExecStart=/opt/finns-inte\\n' | sudo tee /etc/systemd/system/trasig.service");
    expect(t.run("sudo systemctl start trasig").exitCode).toBe(1);
    const status = t.run("systemctl status trasig").out;
    expect(status).toContain("status=203/EXEC");
    expect(t.run("journalctl -u trasig").out).toContain("Failed to locate executable /opt/finns-inte");
    expect(t.run("sudo systemctl start finns-inte").out).toContain("Unit finns-inte.service not found.");
  });

  // ---------- omstart och sparat tillstånd ----------

  itNeeds(["sudo", "sleep", "cp"], "bara aktiverade tjänster startar efter reboot", () => {
    const t = new TestShell("arch");
    const sh = t.sh;
    t.run("sudo pkill myserver");
    t.run("sleep 300 &");
    expect(t.run("reboot").exitCode).toBe(1);
    expect(t.run("sudo reboot").exitCode).toBe(0);
    expect(procs(t, "myserver")).toHaveLength(0);
    expect(sh.proc.jobs).toHaveLength(0);
    expect(procs(t, "/usr/sbin/sshd")).toHaveLength(1);
    expect(sh.services.units.get("reportd.service")!.active).toBe("failed");
    expect(sh.cwd).toBe("/home/elev");

    t.run("sudo systemctl enable myserver");
    t.run("sudo cp /etc/reportd.conf.example /etc/reportd.conf");
    t.run("sudo systemctl reboot");
    expect(procs(t, "myserver")[0]?.pid).toBe(ProcsLib.ServerPid);
    expect(sh.services.units.get("reportd.service")!.active).toBe("active");
    expect(lines(t.run("journalctl --list-boots").out)).toHaveLength(5); // header + 4 boots
    expect(t.run("journalctl -b -1 -n 1").out).toContain("reboot: Restarting system");
  });

  itNeeds(["sudo"], "tjänsterna sparas och gamla sparade terminaler får tjänster", () => {
    const t = new TestShell("debian");
    t.run("sudo systemctl stop ssh");
    const copy = Shell.restoreJson(t.sh.snapshotJson())!;
    expect(copy.services.units.get("ssh.service")!.active).toBe("inactive");
    expect(copy.execute("systemctl is-active ssh").output).toBe("inactive\n");

    // A terminal saved before systemd existed, where myserver had already been killed.
    const old = Shell.create("debian", "sv");
    old.execute("sudo pkill myserver");
    const snap = snapshotFromJson(old.snapshotJson())!;
    snap.services = null;
    const restored = Shell.restore(snap)!;
    expect(restored.services.units.get("myserver.service")!.active).toBe("inactive");
    expect(restored.services.units.get("ssh.service")!.active).toBe("active");
    expect(restored.execute("systemctl status reportd").exitCode).toBe(3);
  });

  // ---------- hostnamectl och systemd-analyze ----------

  itNeeds(["sudo"], "hostnamectl visar och byter namn", () => {
    const t = new TestShell("fedora");
    const sh = t.sh;
    const r = t.run("hostnamectl");
    expect(r.out).toContain("Static hostname: fedora");
    expect(r.out).toContain("Operating System: Fedora Linux 43 (Workstation Edition)");
    expect(t.run("hostnamectl set-hostname labb").exitCode).toBe(1);
    expect(t.run("sudo hostnamectl set-hostname labb").exitCode).toBe(0);
    expect(sh.vfs.readFile("/etc/hostname", sh.rootUser())).toBe("labb\n");
    expect(t.run("hostnamectl").out).toContain("Static hostname: labb");
  });

  it("systemd-analyze", () => {
    const t = new TestShell();
    expect(t.run("systemd-analyze").out).toMatch(/^Startup finished in 2\.153s \(kernel\) \+ [0-9.]+s \(userspace\)/);
    const blame = t.run("systemd-analyze blame").out;
    expect(blame).toContain("ssh.service");
    expect(blame).toContain("reportd.service");
  });

  itNeeds(["which", "man"], "kommandona kommer från paketet systemd", () => {
    const t = new TestShell("arch");
    expect(t.run("which systemctl journalctl").out).toBe("/usr/bin/systemctl\n/usr/bin/journalctl\n");
    expect(t.run("man journalctl").out).toContain("journalctl - läs systemd:s logg");
  });
});
