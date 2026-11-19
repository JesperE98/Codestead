// Port of Services/ServicesLib.cs (src/shell/services.ts) – the services of the simulated computer, a simplified
// model of systemd.
//
// Every service (unit) has a unit file in the virtual file system and a run state
// (active/inactive/failed) with a main process in the process table (`sh.proc`). Everything that
// happens is written to the journal, which `journalctl` reads. The state is saved in the shell
// (`sh.services`) together with the rest of the computer. The other parts of the static class are
// ServicesLib.*.ts, re-exported here.

import type { Distro } from "../Distros/Distro.js";
import { Js } from "../Js.js";
import type { Job } from "../Procs/Job.js";
import * as ProcsLib from "../Procs/ProcsLib.js";
import type { Shell } from "../Shell/Shell.js";
import type { User } from "../Vfs/User.js";
import { defFor, serviceDefs } from "./ServicesLib.Defs.js";
import { log } from "./ServicesLib.Journal.js";
import { startUnit, stopUnit, syncServices } from "./ServicesLib.StartStop.js";
import { enabledState, loadUnit, writeUnitFiles } from "./ServicesLib.UnitFiles.js";
import type { ServiceState } from "./ServiceState.js";

export * from "./ServicesLib.Defs.js";
export * from "./ServicesLib.Journal.js";
export * from "./ServicesLib.StartStop.js";
export * from "./ServicesLib.UnitFiles.js";

/** Unit files shipped with the packages. (In older Debian: /lib/systemd/system.) */
export const SystemUnitDir = "/usr/lib/systemd/system";
/** Unit files the administrator wrote or changed. Take precedence. */
export const AdminUnitDir = "/etc/systemd/system";

// ---------- Boot ----------

function hexId(): string {
  let s = "";
  for (let i = 0; i < 32; i++) s += Math.floor(Js.random() * 16).toString(16);
  return s;
}

export function systemdVersion(d: Distro): { major: number; full: string } {
  switch (d.id) {
    case "ubuntu":
      return { major: 255, full: "255.4-1ubuntu8.11" };
    case "debian":
      return { major: 257, full: "257.8-1~deb13u2" };
    case "arch":
      return { major: 258, full: "258.1-1-arch" };
    default:
      return { major: 258, full: "258-1.fc43" };
  }
}

/** The computer boots: the kernel, systemd and every service that should start at boot. */
function bootUp(sh: Shell, t0: number, mode: string, user: User | null): number {
  const st = sh.services;
  st.boots.push({ id: hexId(), start: t0 });
  const d = sh.distro;
  const k = (msg: string, prio = 6): void => log(sh, t0, "kernel", msg, { prio });
  k(`Linux version ${d.kernel} (simulated) #1 SMP PREEMPT_DYNAMIC`, 5);
  k(`Command line: BOOT_IMAGE=/boot/vmlinuz-${d.kernel} root=UUID=1234-abcd ro quiet`);
  k("ACPI BIOS Error (bug): Could not resolve symbol [\\_SB.PCI0.GPP0.SWUS], AE_NOT_FOUND (20240827/dswload2-162)", 3);
  k("ACPI Error: AE_NOT_FOUND, During name lookup/catalog (20240827/psobject-220)", 3);
  k("EXT4-fs (sda2): mounted filesystem with ordered data mode. Quota mode: none.");
  let t = t0 + 2153;
  log(
    sh,
    t,
    "systemd",
    `systemd ${systemdVersion(d).full} running in system mode (+PAM +AUDIT +SELINUX +APPARMOR +SECCOMP +GCRYPT -GNUTLS +OPENSSL +ACL +BLKID +CURL +ELFUTILS +FIDO2 +IDN2 -IDN +KMOD +LIBCRYPTSETUP +LIBFDISK +PCRE2 +PWQUALITY +P11KIT +QRENCODE +TPM2 +BZIP2 +LZ4 +XZ +ZLIB +ZSTD +BPF_FRAMEWORK +XKBCOMMON +UTMP +SYSVINIT +LIBARCHIVE)`,
  );
  log(sh, t, "systemd", "Detected virtualization kvm.");
  log(sh, t, "systemd", `Hostname set to <${d.hostname}>.`);
  for (const def of serviceDefs(d)) {
    const rt = st.units.get(def.name);
    if (!rt) continue;
    const wanted = def.boot || enabledState(sh, rt) === "enabled";
    if (!wanted) continue;
    t += 180;
    startUnit(sh, rt, t, mode, true);
  }
  // The student's own services that are enabled.
  for (const rt of [...st.units.values()]) {
    if (defFor(sh, rt.name) !== null || enabledState(sh, rt) !== "enabled") continue;
    t += 180;
    startUnit(sh, rt, t, mode, true);
  }
  t += 400;
  log(sh, t, "systemd", "Reached target multi-user.target - Multi-User System.");
  log(sh, t, "systemd", `Startup finished in 2.153s (kernel) + ${Js.toFixed((t - t0 - 2153) / 1000, 3)}s (userspace) = ${Js.toFixed((t - t0) / 1000, 3)}s.`);
  if (user !== null) {
    t += 20_000;
    log(sh, t, "systemd-logind", `New session 1 of user ${user.name}.`, { pid: 520, unit: "systemd-logind.service" });
    log(sh, t, "systemd", `Started session-1.scope - Session 1 of User ${user.name}.`);
  }
  return t;
}

function shutdown(sh: Shell, t: number, mode: string): void {
  for (const rt of [...sh.services.units.values()].reverse()) stopUnit(sh, rt, t, mode);
  log(sh, t, "systemd", "Reached target shutdown.target - System Shutdown.");
  log(sh, t, "systemd-shutdown", "Syncing filesystems and block devices.", { pid: 1 });
  log(sh, t, "kernel", "reboot: Restarting system");
  for (const rt of sh.services.units.values()) {
    rt.active = "inactive";
    rt.sub = "dead";
    rt.pid = null;
    rt.result = null;
  }
}

/** Creates the service model for a new (or old saved) computer. */
export function initialServices(sh: Shell): ServiceState {
  const st: ServiceState = { units: Js.obj(), journal: [], boots: [], job: 100, machineId: hexId() };
  sh.services = st;
  writeUnitFiles(sh);
  for (const def of serviceDefs(sh.distro)) loadUnit(sh, def.name);
  const student = sh.getUser(sh.world.user);
  const now = Js.now();
  const bootStart = now - (2 * 3600 + 14 * 60) * 1000;

  // The previous boot (yesterday) – only journal lines. reportd.conf existed then.
  const prevStart = bootStart - 24 * 3600 * 1000;
  let t = bootUp(sh, prevStart, "record", student);
  const server = st.units.get("myserver.service")!;
  t += 30_000;
  startUnit(sh, server, t, "record");
  shutdown(sh, prevStart + 9 * 3600 * 1000, "record");

  // This boot. The processes already exist in the process table.
  t = bootUp(sh, bootStart, "init", student);
  // The administrator started the exercise server by hand – but never enabled it.
  t += 10_000;
  log(sh, t, "sudo", `${student.name} : TTY=pts/0 ; PWD=/home/${student.name} ; USER=root ; COMMAND=/usr/bin/systemctl start myserver`, { pid: 1240 });
  startUnit(sh, server, t, "init", true);
  // Processes killed before the model existed (older saved terminals).
  syncServices(sh, now);
  return st;
}

/** Reboots the computer: every service is stopped, and the enabled ones start again. */
export function reboot(sh: Shell): void {
  const now = Js.now();
  syncServices(sh, now);
  shutdown(sh, now, "real");
  // Everything that is not a service disappears – except the base that always exists.
  const servicePids = new Set(serviceDefs(sh.distro).map((d) => d.pid ?? null));
  const base = ProcsLib.initialProcs(sh.distro, sh.world.user).procs.filter((p) => !servicePids.has(p.pid) && p.pid !== ProcsLib.RunawayPid);
  sh.proc.procs = base;
  sh.proc.jobs = [] as Job[];
  for (const rt of sh.services.units.values()) {
    rt.lastPid = null;
    rt.exitInfo = null;
    rt.since = null;
  }
  bootUp(sh, now + 3000, "real", sh.getUser(sh.world.user));
}
