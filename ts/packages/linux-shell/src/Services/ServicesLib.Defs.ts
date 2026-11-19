// Port of Services/ServicesLib.Defs.cs – ServicesLib: the services that exist from the start, their unit files
// and the cron unit.

import type { Distro } from "../Distros/Distro.js";
import * as PackagesLib from "../Packages/PackagesLib.js";
import * as ProcsLib from "../Procs/ProcsLib.js";
import type { Shell } from "../Shell/Shell.js";
import * as VfsLib from "../Vfs/VfsLib.js";
import { SystemUnitDir } from "./ServicesLib.js";
import { syncServices } from "./ServicesLib.StartStop.js";
import { ensureDir } from "./ServicesLib.UnitFiles.js";

// ---------- The services that exist from the start ----------

export interface StartFailure {
  /** Output from the program before it crashed. */
  log: string[];
  status: number;
  statusName: string;
  exec?: boolean;
}

export interface ServiceDef {
  name: string;
  description: string;
  exec: string;
  type?: string | null;
  user?: string | null;
  reload?: string | null;
  docs?: string[] | null;
  after?: string | null;
  restart?: string | null;
  remainAfterExit?: boolean;
  /** The target in [Install]. Missing means the service is "static". */
  wantedBy?: string | null;
  alias?: string | null;
  /** The unit file lives in /etc/systemd/system (written by the administrator). */
  admin?: boolean;
  /** PID the service gets at boot (the same as in the process table). */
  pid?: number | null;
  /** Enabled from the start (has [Install]). */
  enabled?: boolean;
  /** Static service that is still started at boot (as a dependency). */
  boot?: boolean;
  /** Started by hand after boot (by the administrator). */
  manual?: boolean;
  /** The program's own log lines when it starts. */
  log?: string[] | null;
  /** The program's own log lines when it is stopped. */
  stopLog?: string[] | null;
  /** Check before start – returns a failure if the service crashes. */
  check?: ((sh: Shell) => StartFailure | null) | null;
  /** Extra comment at the top of the unit file. */
  comment?: string | null;
}

/** The configuration file reportd needs (and that is missing from the start). */
export const ReportdConf = "/etc/reportd.conf";

export const ReportdExample = `# Example configuration for reportd.
# Copy it to ${ReportdConf} and change it as needed:
#   sudo cp ${ReportdConf}.example ${ReportdConf}

port = 9090
report_dir = /var/lib/reportd
interval = 1h
`;

export function serviceDefs(distro: Distro): ServiceDef[] {
  const fam = distro.family;
  const common: ServiceDef[] = [
    {
      name: "systemd-journald.service",
      description: "Journal Service",
      exec: "/usr/lib/systemd/systemd-journald",
      type: "notify",
      docs: ["man:systemd-journald.service(8)", "man:journald.conf(5)"],
      pid: 312,
      boot: true,
      log: ["Journal started", "System Journal (/var/log/journal) is 24.0M, max 4.0G, 3.9G free."],
    },
    {
      name: "systemd-udevd.service",
      description: "Rule-based Manager for Device Events and Files",
      exec: "/usr/lib/systemd/systemd-udevd",
      type: "notify",
      docs: ["man:systemd-udevd.service(8)", "man:udev(7)"],
      pid: 341,
      boot: true,
    },
    fam === "debian"
      ? {
          name: "dbus.service",
          description: "D-Bus System Message Bus",
          exec: "/usr/bin/dbus-daemon --system --address=systemd: --nofork",
          type: "notify",
          user: "messagebus",
          docs: ["man:dbus-daemon(1)"],
          pid: 498,
          boot: true,
        }
      : {
          name: "dbus-broker.service",
          description: "D-Bus System Message Bus",
          exec: "/usr/bin/dbus-broker-launch --scope system",
          type: "notify",
          user: "dbus",
          docs: ["man:dbus-broker-launch(1)"],
          wantedBy: "multi-user.target",
          alias: "dbus.service",
          enabled: true,
          pid: 498,
          log: ["Ready"],
        },
    {
      name: "systemd-logind.service",
      description: "User Login Management",
      exec: "/usr/lib/systemd/systemd-logind",
      type: "notify",
      docs: ["man:sd-login(3)", "man:systemd-logind.service(8)", "man:logind.conf(5)"],
      pid: 520,
      boot: true,
      log: ["New seat seat0."],
    },
  ];

  const network: ServiceDef[] =
    distro.id === "debian"
      ? [
          {
            name: "networking.service",
            description: "Raise network interfaces",
            exec: "/sbin/ifup -a --read-environment",
            type: "oneshot",
            remainAfterExit: true,
            docs: ["man:interfaces(5)"],
            wantedBy: "multi-user.target",
            enabled: true,
          },
        ]
      : fam === "arch"
        ? [
            {
              name: "systemd-networkd.service",
              description: "Network Configuration",
              exec: "/usr/lib/systemd/systemd-networkd",
              type: "notify",
              user: "systemd-network",
              docs: ["man:systemd-networkd.service(8)"],
              wantedBy: "multi-user.target",
              enabled: true,
              pid: 470,
              log: ["eth0: Link UP", "eth0: Gained carrier", "eth0: DHCPv4 address 192.168.1.42/24, gateway 192.168.1.1"],
            },
          ]
        : [
            {
              name: "NetworkManager.service",
              description: "Network Manager",
              exec: "/usr/sbin/NetworkManager --no-daemon",
              type: "dbus",
              reload: "/usr/bin/busctl call org.freedesktop.NetworkManager /org/freedesktop/NetworkManager org.freedesktop.NetworkManager Reload u 0",
              docs: ["man:NetworkManager(8)"],
              wantedBy: "multi-user.target",
              enabled: true,
              pid: fam === "redhat" ? 560 : 590,
              log: ["<info>  NetworkManager is starting...", "<info>  device (eth0): state change: ip-config -> activated"],
            },
          ];

  const ssh: ServiceDef =
    fam === "debian"
      ? {
          name: "ssh.service",
          description: "OpenBSD Secure Shell server",
          exec: "/usr/sbin/sshd -D",
          type: "notify",
          reload: "/bin/kill -HUP $MAINPID",
          docs: ["man:sshd(8)", "man:sshd_config(5)"],
          after: "network.target auditd.service",
          restart: "on-failure",
          wantedBy: "multi-user.target",
          alias: "sshd.service",
          enabled: true,
          pid: 733,
          log: ["Server listening on 0.0.0.0 port 22.", "Server listening on :: port 22."],
          stopLog: ["Received signal 15; terminating."],
        }
      : {
          name: "sshd.service",
          description: fam === "arch" ? "OpenSSH Daemon" : "OpenSSH server daemon",
          exec: "/usr/sbin/sshd -D",
          type: "notify",
          reload: "/bin/kill -HUP $MAINPID",
          docs: ["man:sshd(8)", "man:sshd_config(5)"],
          after: "network.target",
          restart: "on-failure",
          wantedBy: "multi-user.target",
          enabled: true,
          pid: 733,
          log: ["Server listening on 0.0.0.0 port 22.", "Server listening on :: port 22."],
          stopLog: ["Received signal 15; terminating."],
        };

  let family: ServiceDef[];
  if (fam === "debian") {
    family = [
      {
        name: "cron.service",
        description: "Regular background program processing daemon",
        exec: "/usr/sbin/cron -f",
        docs: ["man:cron(8)"],
        wantedBy: "multi-user.target",
        enabled: true,
        pid: 530,
        log: ["(CRON) INFO (pidfile fd = 3)", "(CRON) INFO (Running @reboot jobs)"],
      },
      {
        name: "rsyslog.service",
        description: "System Logging Service",
        exec: "/usr/sbin/rsyslogd -n",
        type: "notify",
        user: "syslog",
        docs: ["man:rsyslogd(8)", "man:rsyslog.conf(5)"],
        wantedBy: "multi-user.target",
        enabled: true,
        pid: 533,
      },
    ];
    if (distro.id === "ubuntu") {
      family.push({
        name: "snapd.service",
        description: "Snap Daemon",
        exec: "/usr/lib/snapd/snapd",
        type: "notify",
        wantedBy: "multi-user.target",
        enabled: true,
        pid: 560,
      });
    }
  } else if (fam === "arch") {
    family = [
      {
        name: "systemd-timesyncd.service",
        description: "Network Time Synchronization",
        exec: "/usr/lib/systemd/systemd-timesyncd",
        type: "notify",
        user: "systemd-timesync",
        docs: ["man:systemd-timesyncd.service(8)"],
        wantedBy: "sysinit.target",
        enabled: true,
        pid: 531,
        log: ["Contacted time server 162.159.200.1:123 (0.arch.pool.ntp.org)."],
      },
    ];
  } else {
    family = [
      {
        name: "firewalld.service",
        description: "firewalld - dynamic firewall daemon",
        exec: "/usr/bin/python3 -sP /usr/sbin/firewalld --nofork --nopid",
        type: "dbus",
        reload: "/bin/kill -HUP $MAINPID",
        docs: ["man:firewalld(1)"],
        wantedBy: "multi-user.target",
        alias: "dbus-org.fedoraproject.FirewallD1.service",
        enabled: true,
        pid: 540,
      },
      {
        name: "chronyd.service",
        description: "NTP client/server",
        exec: "/usr/sbin/chronyd -F 2",
        type: "forking",
        user: "chrony",
        docs: ["man:chronyd(8)", "man:chrony.conf(5)"],
        wantedBy: "multi-user.target",
        enabled: true,
        pid: 545,
        log: ["chronyd version 4.8 starting (+CMDMON +NTP +REFCLOCK +RTC +PRIVDROP +SCFILTER +SIGND +NTS +SECHASH +IPV6 +DEBUG)"],
      },
      {
        name: "crond.service",
        description: "Command Scheduler",
        exec: "/usr/sbin/crond -n",
        wantedBy: "multi-user.target",
        enabled: true,
        pid: 552,
        log: ["(CRON) STARTUP (1.7.2)", "(CRON) INFO (running with inotify support)"],
      },
    ];
  }

  const own: ServiceDef[] = [
    {
      name: "reportd.service",
      description: "Reportd report service",
      exec: `/usr/local/bin/reportd --config ${ReportdConf}`,
      type: "notify",
      after: "network.target",
      wantedBy: "multi-user.target",
      admin: true,
      enabled: true,
      pid: 655,
      log: [`Reading configuration from ${ReportdConf}`, "Report scheduler ready (interval 1h)"],
      check: (sh) =>
        sh.vfs.tryLookup(ReportdConf, sh.rootUser())?.type === "file"
          ? null
          : {
              log: [`error: cannot open config file ${ReportdConf}: No such file or directory`, `hint: an example configuration is installed as ${ReportdConf}.example`],
              status: 1,
              statusName: "FAILURE",
            },
      comment: "# reportd creates reports every hour. Installed by the administrator.",
    },
    {
      name: "myserver.service",
      description: "Myserver web server (practice server)",
      exec: "/usr/local/bin/myserver --port 8080",
      reload: "/bin/kill -HUP $MAINPID",
      after: "network.target",
      wantedBy: "multi-user.target",
      admin: true,
      manual: true,
      pid: ProcsLib.ServerPid,
      log: ["Reading configuration from /etc/myserver.conf", "Listening on port 8080"],
      stopLog: ["Shutting down, closing connections"],
      comment: "# The practice server from the chapter about processes.",
    },
  ];

  return [...common, ...network, ...family, ssh, ...own];
}

export function defFor(sh: Shell, name: string): ServiceDef | null {
  return serviceDefs(sh.distro).find((d) => d.name === name) ?? null;
}

export function unitFile(def: ServiceDef): string {
  const lines: string[] = [];
  if (def.comment) lines.push(def.comment);
  lines.push("[Unit]");
  lines.push(`Description=${def.description}`);
  if (def.docs) lines.push(`Documentation=${def.docs.join(" ")}`);
  if (def.after) lines.push(`After=${def.after}`);
  lines.push("");
  lines.push("[Service]");
  if (def.type && def.type !== "simple") lines.push(`Type=${def.type}`);
  if (def.remainAfterExit) lines.push("RemainAfterExit=yes");
  if (def.user) lines.push(`User=${def.user}`);
  lines.push(`ExecStart=${def.exec}`);
  if (def.reload) lines.push(`ExecReload=${def.reload}`);
  if (def.restart) lines.push(`Restart=${def.restart}`);
  if (def.wantedBy) {
    lines.push("");
    lines.push("[Install]");
    lines.push(`WantedBy=${def.wantedBy}`);
    if (def.alias) lines.push(`Alias=${def.alias}`);
  }
  return lines.join("\n") + "\n";
}

/**
 * cronie on Arch: the package brings its own service (not enabled, like every Arch package). Called when
 * the package is installed or removed.
 */
export function cronieUnit(sh: Shell, installed: boolean): void {
  const path = `${SystemUnitDir}/cronie.service`;
  const root = sh.rootUser();
  if (!installed) {
    if (sh.vfs.tryLookup(path, root) !== null) sh.vfs.remove(path, root);
    if (sh.vfs.tryLookup("/usr/bin/crond", root) !== null) sh.vfs.remove("/usr/bin/crond", root);
    return;
  }
  // The daemon itself (the service starts it).
  PackagesLib.installCommand(sh, "crond");
  ensureDir(sh, SystemUnitDir).children!.set(
    "cronie.service",
    VfsLib.makeFile(
      unitFile({
        name: "cronie.service",
        description: "Command Scheduler",
        exec: "/usr/bin/crond -n",
        reload: "/usr/bin/kill -HUP $MAINPID",
        wantedBy: "multi-user.target",
      }),
    ),
  );
  syncServices(sh);
}

/** The cron service of the distribution: cron (Debian/Ubuntu), crond (Fedora) or cronie (Arch). */
export function cronUnit(d: Distro): string {
  return d.family === "debian" ? "cron.service" : d.family === "redhat" ? "crond.service" : "cronie.service";
}
