// Port of Commands/Users/UsersCmd.cs (src/shell/commands/users.ts).
// User management: useradd, usermod, userdel, groupadd, groupdel, gpasswd, passwd, chpasswd, chage,
// adduser/deluser/addgroup/delgroup (Debian), chgrp, who, w, last and getent.
// Everything reads and writes /etc/passwd, /etc/group and /etc/shadow via Users/ (UsersLib).
// This is the group's root file: the shared helpers and the list of the group's commands.

import { Js } from "../../Js.js";
import type { Shell } from "../../Shell/Shell.js";
import type { MsgArgs } from "../../ShellI18n.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import type { Sink } from "../../Types/Sink.js";
import type { GroupEntry } from "../../Users/GroupEntry.js";
import type { PasswdEntry } from "../../Users/PasswdEntry.js";
import type { ShadowEntry } from "../../Users/ShadowEntry.js";
import type { UserDb } from "../../Users/UserDb.js";
import * as UsersLib from "../../Users/UsersLib.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { addgroup, adduser } from "./UsersCmd.Adduser.js";
import { chage } from "./UsersCmd.Chage.js";
import { chgrp } from "./UsersCmd.Chgrp.js";
import { chpasswd } from "./UsersCmd.Chpasswd.js";
import { delgroup } from "./UsersCmd.Delgroup.js";
import { deluser } from "./UsersCmd.Deluser.js";
import { getent } from "./UsersCmd.Getent.js";
import { gpasswd } from "./UsersCmd.Gpasswd.js";
import { groupadd } from "./UsersCmd.Groupadd.js";
import { groupdel } from "./UsersCmd.Groupdel.js";
import { last } from "./UsersCmd.Last.js";
import { passwd } from "./UsersCmd.Passwd.js";
import { useradd } from "./UsersCmd.Useradd.js";
import { userdel } from "./UsersCmd.Userdel.js";
import { usermod } from "./UsersCmd.Usermod.js";
import { w } from "./UsersCmd.W.js";
import { who } from "./UsersCmd.Who.js";

export * from "./UsersCmd.Adduser.js";
export * from "./UsersCmd.Chage.js";
export * from "./UsersCmd.Chgrp.js";
export * from "./UsersCmd.Chpasswd.js";
export * from "./UsersCmd.Delgroup.js";
export * from "./UsersCmd.Deluser.js";
export * from "./UsersCmd.Getent.js";
export * from "./UsersCmd.Gpasswd.js";
export * from "./UsersCmd.Groupadd.js";
export * from "./UsersCmd.Groupdel.js";
export * from "./UsersCmd.Last.js";
export * from "./UsersCmd.Passwd.js";
export * from "./UsersCmd.Useradd.js";
export * from "./UsersCmd.Userdel.js";
export * from "./UsersCmd.Usermod.js";
export * from "./UsersCmd.W.js";
export * from "./UsersCmd.Who.js";

// ---------- Helpers ----------

export function dim(sh: Shell, key: string, args?: MsgArgs): string {
  return `${UtilCmd.Color.dim}${sh.msg(key, args)}${UtilCmd.Color.reset}\n`;
}

export function isRoot(sh: Shell): boolean {
  return sh.currentUser().uid === 0;
}

/** Like shadow-utils: "useradd: Permission denied." followed by the file not being lockable. */
export function denied(ctx: CmdCtx, file = "/etc/passwd"): number {
  ctx.err(`${ctx.name}: Permission denied.\n${ctx.name}: cannot lock ${file}; try again later.\n`);
  if (ctx.isTTY) ctx.err(dim(ctx.sh, "users.needsRoot"));
  return 1;
}

/** Defaults that differ between the families (/etc/default/useradd and /etc/login.defs). */
export function defaults(sh: Shell): { createHome: boolean; shell: string; homeMode: number; lockedHash: string } {
  const fam = sh.distro.family;
  return {
    // Fedora creates the home directory even without -m (CREATE_HOME yes).
    createHome: fam === "redhat",
    shell: fam === "debian" ? "/bin/sh" : fam === "arch" ? "/usr/bin/bash" : "/bin/bash",
    homeMode: fam === "debian" ? Js.oct(750) : Js.oct(700),
    lockedHash: fam === "redhat" ? "!!" : "!",
  };
}

export function shadowFor(db: UserDb, name: string): ShadowEntry {
  let s = db.shadow.find((e) => e.name === name);
  if (s === undefined) {
    s = { name, hash: "!", lastChange: Js.num(UsersLib.today()), min: "0", max: "99999", warn: "7", inactive: "", expire: "", reserved: "" };
    db.shadow.push(s);
  }
  return s;
}

/** Creates the home directory and copies the files from /etc/skel into it. */
export function makeHome(sh: Shell, ctx: Sink, prog: string, entry: PasswdEntry, group: string): void {
  const vfs = sh.vfs;
  if (vfs.tryLookup(entry.home, UsersLib.Root) !== null) {
    ctx.err(`${prog}: warning: the home directory ${entry.home} already exists.\n${prog}: Not copying any file from skel directory into it.\n`);
    return;
  }
  try {
    vfs.mkdir(entry.home, UsersLib.Root);
  } catch (e) {
    if (!(e instanceof FsError)) throw e;
    ctx.err(`${prog}: cannot create directory ${entry.home}: ${e.message}\n`);
    return;
  }
  const home = vfs.lookup(entry.home, UsersLib.Root);
  home.owner = entry.name;
  home.group = group;
  home.mode = defaults(sh).homeMode;
  const skel = vfs.tryLookup("/etc/skel", UsersLib.Root);
  const chownTree = (n: FsNode): void => {
    n.owner = entry.name;
    n.group = group;
    n.mtime = Js.now();
    for (const c of (n.children ?? Js.obj<FsNode>()).values()) chownTree(c);
  };
  for (const [name, node] of skel?.children ?? Js.obj<FsNode>()) {
    const copy = VfsLib.cloneNode(node);
    chownTree(copy);
    home.children!.set(name, copy);
  }
}

export function removeTree(sh: Shell, path: string): boolean {
  try {
    sh.vfs.remove(path, UsersLib.Root);
    return true;
  } catch (e) {
    if (!(e instanceof FsError)) throw e;
    return false;
  }
}

export interface NewUser {
  name: string;
  uid: number | null;
  /** Primary group (name or number). Missing: a private group with the same name is created. */
  group: string | null;
  groups: string[];
  comment: string;
  home: string | null;
  shell: string;
  createHome: boolean;
  system: boolean;
}

/** Adds the user to the database (and maybe the home directory). Returns null on error. */
export function createUser(sh: Shell, io: Sink, prog: string, opts: NewUser): { entry: PasswdEntry; group: GroupEntry } | null {
  const db = UsersLib.loadDb(sh);
  const uids = db.passwd.map((e) => e.uid);
  const uid = opts.uid ?? UsersLib.nextId(uids, opts.system);
  if (opts.uid !== null && uids.includes(opts.uid)) {
    io.err(`${prog}: UID ${opts.uid} is not unique\n`);
    return null;
  }
  let group: GroupEntry | undefined;
  if (opts.group !== null) {
    group = db.group.find((g) => g.name === opts.group || Js.num(g.gid) === opts.group);
    if (group === undefined) {
      io.err(`${prog}: group '${opts.group}' does not exist\n`);
      return null;
    }
  } else {
    const gids = db.group.map((g) => g.gid);
    const gid = gids.includes(uid) ? UsersLib.nextId(gids, opts.system) : uid;
    group = { name: opts.name, password: "x", gid, members: [] };
    db.group.push(group);
  }
  for (const g of opts.groups) {
    const ge = db.group.find((e) => e.name === g);
    if (ge !== undefined && !ge.members.includes(opts.name)) ge.members.push(opts.name);
  }
  const entry: PasswdEntry = {
    name: opts.name,
    password: "x",
    uid,
    gid: group.gid,
    gecos: opts.comment,
    home: opts.home ?? `/home/${opts.name}`,
    shell: opts.shell,
  };
  db.passwd.push(entry);
  db.shadow = db.shadow.filter((s) => s.name !== opts.name);
  db.shadow.push({
    name: opts.name,
    hash: defaults(sh).lockedHash,
    lastChange: Js.num(UsersLib.today()),
    min: opts.system ? "" : "0",
    max: opts.system ? "" : "99999",
    warn: opts.system ? "" : "7",
    inactive: "",
    expire: "",
    reserved: "",
  });
  UsersLib.saveDb(sh, db);
  if (opts.createHome) makeHome(sh, io, prog, entry, group.name);
  return { entry, group };
}

export function checkGroups(io: Sink, sh: Shell, prog: string, list: string[]): boolean {
  for (const g of list) {
    if (UsersLib.findGroup(sh, g) === null) {
      io.err(`${prog}: group '${g}' does not exist\n`);
      return false;
    }
  }
  return true;
}

export function splitList(s: string | null | undefined): string[] {
  return (s ?? "").split(",").filter((x) => x !== "");
}

/** Number(s) as an int for ids; NaN becomes -1 (JS would keep NaN). */
export function toId(n: number): number {
  return Number.isFinite(n) ? Math.trunc(n) : -1;
}

export function isInteger(n: number): boolean {
  return Number.isFinite(n) && Math.floor(n) === n;
}

/**
 * Date.parse(s): ISO dates without time are UTC, with time (and no zone) local. The C# emulated JavaScript's
 * Date.parse (and fell back to .NET's DateTime.TryParse for other formats); here it is Date.parse itself.
 */
export function dateParse(s: string): number {
  return Date.parse(s);
}

/** Math.floor(Date.parse(s) / 86_400_000) */
export function daysOf(s: string): number {
  return Math.floor(dateParse(s) / 86_400_000);
}

export function stripBang(hash: string): string {
  return hash.startsWith("!") ? hash.slice(1) : hash;
}

// ---------- userdel ----------

export function deleteUser(sh: Shell, io: Sink, prog: string, name: string, removeHome: boolean, force: boolean): number {
  const db = UsersLib.loadDb(sh);
  const entry = db.passwd.find((e) => e.name === name);
  if (entry === undefined) {
    io.err(`${prog}: user '${name}' does not exist\n`);
    return 6;
  }
  if (sh.userStack.includes(name) && !force) {
    io.err(`${prog}: user ${name} is currently used by process 1290\n`);
    return 8;
  }
  db.passwd = db.passwd.filter((e) => e.name !== name);
  db.shadow = db.shadow.filter((s) => s.name !== name);
  for (const g of db.group) g.members = g.members.filter((m) => m !== name);
  // The private group is removed if nobody else uses it.
  const own = db.group.find((g) => g.gid === entry.gid && g.name === name);
  if (own !== undefined && own.members.length === 0 && !db.passwd.some((e) => e.gid === own.gid)) db.group = db.group.filter((g) => g !== own);
  UsersLib.saveDb(sh, db);
  if (removeHome) {
    if (sh.distro.family === "debian") io.err(`${prog}: ${name} mail spool (/var/mail/${name}) not found\n`);
    if (!removeTree(sh, entry.home)) io.err(`${prog}: ${name} home directory (${entry.home}) not found\n`);
  }
  return 0;
}

// ---------- groupadd, groupdel, gpasswd ----------

export function addGroup(sh: Shell, io: Sink, prog: string, name: string, system: boolean, gidArg: string | null = null): number {
  if (!UsersLib.validName(name)) {
    io.err(`${prog}: '${name}' is not a valid group name\n`);
    return 3;
  }
  const db = UsersLib.loadDb(sh);
  if (db.group.some((g) => g.name === name)) {
    io.err(`${prog}: group '${name}' already exists\n`);
    return 9;
  }
  const gids = db.group.map((g) => g.gid);
  const gid = gidArg !== null ? Js.number(gidArg) : UsersLib.nextId(gids, system);
  if (!isInteger(gid)) {
    io.err(`${prog}: invalid group ID '${gidArg}'\n`);
    return 3;
  }
  if (gidArg !== null && gids.includes(toId(gid))) {
    io.err(`${prog}: GID '${Js.num(gid)}' already exists\n`);
    return 4;
  }
  db.group.push({ name, password: "x", gid: toId(gid), members: [] });
  UsersLib.saveDb(sh, db);
  return 0;
}

export function delGroup(sh: Shell, io: Sink, prog: string, name: string): number {
  const db = UsersLib.loadDb(sh);
  const group = db.group.find((g) => g.name === name);
  if (group === undefined) {
    io.err(`${prog}: group '${name}' does not exist\n`);
    return 6;
  }
  const user = db.passwd.find((e) => e.gid === group.gid);
  if (user !== undefined) {
    io.err(`${prog}: cannot remove the primary group of user '${user.name}'\n`);
    return 8;
  }
  db.group = db.group.filter((g) => g !== group);
  UsersLib.saveDb(sh, db);
  return 0;
}

// ---------- passwd, chpasswd, chage ----------

/** Asks for the new password twice and saves it. done() is called afterwards. */
export function askNewPassword(sh: Shell, name: string, done: (ok: boolean, io: Sink) => number): void {
  sh.askText(
    "New password: ",
    (first) => {
      sh.askText(
        "Retype new password: ",
        (second, io) => {
          const redhat = sh.distro.family === "redhat";
          if (first !== second || first === "") {
            io.err(first === "" ? "No password has been supplied.\n" : "Sorry, passwords do not match.\n");
            io.err(`passwd: Authentication token manipulation error\n${redhat ? "" : "passwd: password unchanged\n"}`);
            return done(false, io);
          }
          setPassword(sh, name, first);
          io.out(redhat ? "passwd: all authentication tokens updated successfully.\n" : "passwd: password updated successfully\n");
          return done(true, io);
        },
        true,
      );
      return 0;
    },
    true,
  );
}

export function setPassword(sh: Shell, name: string, password: string): void {
  const db = UsersLib.loadDb(sh);
  const s = shadowFor(db, name);
  s.hash = UsersLib.hashPassword(password);
  s.lastChange = Js.num(UsersLib.today());
  UsersLib.saveDb(sh, db);
}

export const Months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------- who, w, last ----------

/** The time the student "logged in" today. */
export const LoginTime = "08:12";

/** The user logged in at the terminal – not the one you switched to with su. */
export function loginName(sh: Shell): string {
  return sh.userStack.length > 0 ? sh.userStack[0]! : sh.world.user;
}

/** The group's commands, in the C# order. */
export function all(): CommandDef[] {
  return [useradd, usermod, userdel, groupadd, groupdel, gpasswd, passwd, chpasswd, chage, adduser, deluser, addgroup, delgroup, chgrp, who, w, last, getent];
}
