// Port of Commands/IndexCmd.cs (src/shell/commands/index.ts) – every command the simulator knows, looked up by name.
// Builtins always run; the others must exist as a file in $PATH, which means they are installed and removed with
// the package manager.

import type { CommandDef } from "../Types/CommandDef.js";
import { withDef } from "../Types/CommandDef.js";
import * as ArchiveCmd from "./Archive/ArchiveCmd.js";
import * as CronCmd from "./Cron/CronCmd.js";
import * as DisksCmd from "./Disks/DisksCmd.js";
import * as ExtrasCmd from "./Extras/ExtrasCmd.js";
import * as FileinfoCmd from "./Fileinfo/FileinfoCmd.js";
import * as FsCmd from "./Fs/FsCmd.js";
import * as GitCmd from "./Git/GitCmd.js";
import * as NetCmd from "./Net/NetCmd.js";
import * as PkgCmd from "./Pkg/PkgCmd.js";
import * as ProcsCmd from "./Procs/ProcsCmd.js";
import * as ReposCmd from "./Repos/ReposCmd.js";
import * as RunCmd from "./Run/RunCmd.js";
import * as ScriptCmd from "./Script/ScriptCmd.js";
import * as ShellsCmd from "./Shells/ShellsCmd.js";
import * as SshCmd from "./Ssh/SshCmd.js";
import * as SystemCmd from "./System/SystemCmd.js";
import * as SystemdCmd from "./Systemd/SystemdCmd.js";
import * as TextCmd from "./Text/TextCmd.js";
import * as TextprocCmd from "./Textproc/TextprocCmd.js";
import * as UniversalCmd from "./Universal/UniversalCmd.js";
import * as UsersCmd from "./Users/UsersCmd.js";

let table: Map<string, CommandDef> | null = null;

/** Every command by name (IndexCmd.Commands in C#), built on first use. */
export function commands(): Map<string, CommandDef> {
  return (table ??= build());
}

function build(): Map<string, CommandDef> {
  const all = new Map<string, CommandDef>();
  const add = (defs: Iterable<CommandDef>): void => {
    for (const def of defs) all.set(def.name, def);
  };

  add(FsCmd.all());
  // Links and file information (ln, readlink, realpath, stat, file, umask).
  add(FileinfoCmd.all());
  // Commands that run other commands (xargs, nohup, watch).
  add(RunCmd.all());
  add(TextCmd.all());
  add(SystemCmd.all());
  add(PkgCmd.all());
  add(ExtrasCmd.all());
  add(ScriptCmd.all());
  add(ProcsCmd.all());
  add(TextprocCmd.all());

  // Archives and compression (tar, gzip, zip ...) and du.
  add(ArchiveCmd.all());
  // Version control with git.
  add(GitCmd.all());

  // Services and logs (systemctl, journalctl, hostnamectl, systemd-analyze, reboot).
  add(SystemdCmd.all());
  // Other shells: zsh, fish, chsh and fish/zsh builtins.
  add(ShellsCmd.all());
  // Users and groups (useradd, passwd, adduser ...) plus who, w, last and getent.
  add(UsersCmd.all());
  // Networking (ip, ping, ss, dig, curl, wget, ssh ...).
  add(NetCmd.all());
  add(SshCmd.all());
  // Copying files over ssh (scp, rsync).
  add(SshCmd.transfer());
  // Scheduled jobs (crontab).
  add(CronCmd.all());

  // getent exists in both the users and the networking chapter: host names are looked up by the
  // networking version (which also knows DNS), everything else by the users version.
  const users = UsersCmd.all().find((d) => d.name === "getent");
  const net = NetCmd.all().find((d) => d.name === "getent");
  if (users !== undefined && net !== undefined) {
    const extra = "getent group sudo\n       getent hosts example.com";
    all.set(
      "getent",
      withDef(users, {
        man: users.man?.replaceAll("getent group sudo", extra),
        manEn: users.manEn?.replaceAll("getent group sudo", extra),
        run: (ctx) => (ctx.args.length > 0 && (ctx.args[0] === "hosts" || ctx.args[0] === "ahosts") ? net.run(ctx) : users.run(ctx)),
      }),
    );
  }

  // Disks and file systems: df, lsblk, blkid, mount, umount, findmnt, fdisk, mkfs ...
  add(DisksCmd.all());
  // Extra repositories (PPA, AUR, COPR) and universal package formats (Flatpak, Snap, AppImage).
  add(ReposCmd.all());
  add(UniversalCmd.all());
  return all;
}
