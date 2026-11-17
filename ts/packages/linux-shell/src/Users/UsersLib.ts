// Port of Users/UsersLib.cs (src/shell/users.ts) – users and groups. Everything is read from /etc/passwd,
// /etc/group and /etc/shadow in the virtual file system, just like on a real system, so useradd, usermod,
// passwd etc. only have to change the files.

import { Js } from "../Js.js";
import type { Shell } from "../Shell/Shell.js";
import type { User } from "../Vfs/User.js";
import type { VFS } from "../Vfs/VFS.js";
import type { GroupEntry } from "./GroupEntry.js";
import type { PasswdEntry } from "./PasswdEntry.js";
import type { ShadowEntry } from "./ShadowEntry.js";
import type { UserDb } from "./UserDb.js";

export const Passwd = "/etc/passwd";
export const Group = "/etc/group";
export const Shadow = "/etc/shadow";

/** root as a constant – used to read the system files without asking the shell (avoids recursion). */
export const Root: User = { name: "root", uid: 0, groups: ["root"], home: "/root" };

// ---------- Parsing and writing the files ----------

function lines(text: string): string[] {
  return text.split("\n").filter((l) => l.trim() !== "" && !l.startsWith("#"));
}

/** Number(s) for ids. A non-numeric field (NaN in JS) becomes -1; C# kept ids as int ((int)n saturates). */
function id(s: string | undefined): number {
  const n = Js.number(s);
  return Number.isFinite(n) ? Math.max(-2147483648, Math.min(2147483647, Math.trunc(n))) : -1;
}

export function parsePasswd(text: string): PasswdEntry[] {
  const result: PasswdEntry[] = [];
  for (const l of lines(text)) {
    const f = l.split(":");
    if (f.length < 7 || f[0] === "") continue;
    result.push({
      name: f[0]!,
      password: f[1]!,
      uid: id(f[2]),
      gid: id(f[3]),
      gecos: f[4]!,
      home: f[5]!,
      shell: f.slice(6).join(":"),
    });
  }
  return result;
}

export function formatPasswd(list: PasswdEntry[]): string {
  return list.map((e) => [e.name, e.password, Js.num(e.uid), Js.num(e.gid), e.gecos, e.home, e.shell].join(":") + "\n").join("");
}

export function parseGroup(text: string): GroupEntry[] {
  const result: GroupEntry[] = [];
  for (const l of lines(text)) {
    const f = l.split(":");
    if (f.length < 3 || f[0] === "") continue;
    result.push({
      name: f[0]!,
      password: f[1]!,
      gid: id(f[2]),
      members: (f.length > 3 ? f[3]! : "").split(",").filter((m) => m !== ""),
    });
  }
  return result;
}

export function formatGroup(list: GroupEntry[]): string {
  return list.map((g) => `${g.name}:${g.password}:${Js.num(g.gid)}:${g.members.join(",")}\n`).join("");
}

export function parseShadow(text: string): ShadowEntry[] {
  const result: ShadowEntry[] = [];
  for (const l of lines(text)) {
    const f = l.split(":");
    if (f[0] === "") continue;
    const F = (i: number, def: string): string => (i < f.length ? f[i]! : def);
    result.push({
      name: f[0]!,
      hash: F(1, "!"),
      lastChange: F(2, ""),
      min: F(3, ""),
      max: F(4, ""),
      warn: F(5, ""),
      inactive: F(6, ""),
      expire: F(7, ""),
      reserved: F(8, ""),
    });
  }
  return result;
}

export function formatShadow(list: ShadowEntry[]): string {
  return list.map((s) => [s.name, s.hash, s.lastChange, s.min, s.max, s.warn, s.inactive, s.expire, s.reserved].join(":") + "\n").join("");
}

function readEtc(vfs: VFS, path: string): string | null {
  const node = vfs.tryLookup(path, Root);
  return node?.type === "file" ? (node.content ?? "") : null;
}

// ---------- Lookups (cached) ----------

interface Cache {
  passwdText: string | null;
  groupText: string | null;
  passwd: PasswdEntry[];
  group: GroupEntry[];
  users: Map<string, User>;
}

const caches = new WeakMap<VFS, Cache>();

/**
 * Parsed /etc/passwd and /etc/group. getUser is called very often, so the result is kept
 * and only parsed again when the contents of the files have changed.
 */
function cached(vfs: VFS): Cache {
  const passwdText = readEtc(vfs, Passwd);
  const groupText = readEtc(vfs, Group);
  let c = caches.get(vfs);
  if (!c || c.passwdText !== passwdText || c.groupText !== groupText) {
    c = {
      passwdText,
      groupText,
      passwd: parsePasswd(passwdText ?? ""),
      group: parseGroup(groupText ?? ""),
      users: new Map(),
    };
    caches.set(vfs, c);
  }
  return c;
}

export function passwdEntries(sh: Shell): PasswdEntry[] {
  return cached(sh.vfs).passwd;
}

export function groupEntries(sh: Shell): GroupEntry[] {
  return cached(sh.vfs).group;
}

export function findUser(sh: Shell, name: string): PasswdEntry | null {
  return passwdEntries(sh).find((e) => e.name === name) ?? null;
}

export function findGroup(sh: Shell, name: string): GroupEntry | null {
  return groupEntries(sh).find((g) => g.name === name) ?? null;
}

export function userExists(sh: Shell, name: string): boolean {
  return findUser(sh, name) !== null;
}

export function groupExists(sh: Shell, name: string): boolean {
  return findGroup(sh, name) !== null;
}

export function groupName(sh: Shell, gid: number): string {
  return groupEntries(sh).find((g) => g.gid === gid)?.name ?? Js.num(gid);
}

export function gidOf(sh: Shell, group: string): number | null {
  return findGroup(sh, group)?.gid ?? null;
}

/** Used by Shell.getUser: builds the User object from /etc/passwd and /etc/group. */
export function lookupUser(sh: Shell, name: string): User {
  const c = cached(sh.vfs);
  const hit = c.users.get(name);
  if (hit) return hit;
  const entry = c.passwd.find((e) => e.name === name);
  let user: User;
  if (entry) {
    const primary = c.group.find((g) => g.gid === entry.gid)?.name ?? Js.num(entry.gid);
    const extra = c.group.filter((g) => g.gid !== entry.gid && g.members.includes(name)).map((g) => g.name);
    const groups = [primary, ...extra.filter((g) => g !== primary)];
    user = { name, uid: entry.uid, groups, home: entry.home };
  } else if (name === "root") {
    user = Root;
  } else if (name === sh.world.user) {
    // Fallback if someone has destroyed /etc/passwd – the student must always be able to continue.
    user = { name, uid: 1000, groups: [name, sh.distro.adminGroup], home: `/home/${name}` };
  } else {
    user = { name, uid: 65534, groups: [name], home: `/home/${name}` };
  }
  c.users.set(name, user);
  return user;
}

// ---------- Changing the files ----------

/** A fresh copy of the database to change. Save with saveDb. */
export function loadDb(sh: Shell): UserDb {
  return {
    passwd: parsePasswd(readEtc(sh.vfs, Passwd) ?? ""),
    group: parseGroup(readEtc(sh.vfs, Group) ?? ""),
    shadow: parseShadow(readEtc(sh.vfs, Shadow) ?? ""),
  };
}

/** Writes the files back (only those that changed, so mtime stays correct). */
export function saveDb(sh: Shell, db: UserDb): void {
  const write = (path: string, text: string): void => {
    if (readEtc(sh.vfs, path) !== text) sh.vfs.writeFile(path, text, Root);
  };
  write(Passwd, formatPasswd(db.passwd));
  write(Group, formatGroup(db.group));
  write(Shadow, formatShadow(db.shadow));
}

/** Days since 1970-01-01, as in /etc/shadow. */
export function today(): number {
  return Math.floor(Js.now() / 86_400_000);
}

export const UidMin = 1000;
export const UidMax = 60000;
export const SysUidMin = 100;
export const SysUidMax = 999;

/** The next free UID: one more than the highest one used in the range (like useradd). */
export function nextId(used: number[], system: boolean): number {
  if (system) {
    for (let i = SysUidMax; i >= SysUidMin; i--) if (!used.includes(i)) return i;
    return SysUidMax;
  }
  const inRange = used.filter((n) => n >= UidMin && n <= UidMax);
  return inRange.length > 0 ? Math.max(...inRange) + 1 : UidMin;
}

const validNameRe = /^[a-z_][a-z0-9_-]*\$?$/;

export function validName(name: string): boolean {
  return validNameRe.test(name) && name.length <= 32;
}

// ---------- Passwords ----------

const saltChars = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function digest(text: string, length: number): string {
  // No real cryptography – just a deterministic "hash" that looks like yescrypt. (uint arithmetic in C#.)
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let out = "";
  for (let round = 0; out.length < length; round++) {
    for (let i = 0; i < text.length; i++) {
      const c = (text.charCodeAt(i) + round) >>> 0;
      h1 = Math.imul((h1 ^ c) >>> 0, 0x01000193) >>> 0;
      h2 = Math.imul((h2 ^ ((c + h1) >>> 0)) >>> 0, 0x5bd1e995) >>> 0;
    }
    out += saltChars[h1 % 64]! + saltChars[h2 % 64]! + saltChars[(h1 >>> 8) % 64]!;
  }
  return out.slice(0, length);
}

export function hashPassword(password: string, salt: string | null = null): string {
  const s = salt ?? Array.from({ length: 22 }, () => saltChars[Math.floor(Js.random() * 64)]!).join("");
  return `$y$j9T$${s}$${digest(s + password, 43)}`;
}

const hashRe = /^\$y\$j9T\$([^$]+)\$/;

export function checkPassword(hash: string, password: string): boolean {
  const m = hashRe.exec(hash);
  return m !== null && hashPassword(password, m[1]!) === hash;
}

/** "P" (has a password), "L" (locked) or "NP" (no password). */
export function passwordStatus(hash: string): "P" | "L" | "NP" {
  if (hash === "") return "NP";
  if (hash.startsWith("!") || hash.startsWith("*")) return "L";
  return "P";
}

/** The password field in /etc/shadow, or null if the user is missing there. */
export function shadowHash(sh: Shell, name: string): string | null {
  return loadDb(sh).shadow.find((s) => s.name === name)?.hash ?? null;
}

/** Checks a password against /etc/shadow (used by su). */
export function verifyPassword(sh: Shell, name: string, password: string): boolean {
  const entry = loadDb(sh).shadow.find((s) => s.name === name);
  if (!entry) return false;
  if (entry.hash === "") return true;
  return checkPassword(entry.hash, password);
}

// ---------- Switching user ----------

/**
 * Makes name the active user (su, sudo -i). `exit` takes you back.
 * With login (su -, sudo -i) you end up in the user's home directory.
 */
export function switchUser(sh: Shell, name: string, login: boolean, warn: (msg: string) => void): void {
  const entry = findUser(sh, name);
  const user = sh.getUser(name);
  sh.userStack.push(name);
  sh.env.set("USER", name);
  sh.env.set("LOGNAME", name);
  sh.env.set("HOME", user.home);
  if (entry?.shell) sh.env.set("SHELL", entry.shell);
  if (!login) return;
  const home = sh.vfs.tryLookup(user.home, user);
  if (home?.type === "dir") sh.cwd = user.home;
  else warn(`cannot change directory to ${user.home}: No such file or directory`);
}

const nologinRe = /\/(nologin|false)$/;

/** Shells you cannot log in with (system users). */
export function isNologin(shell: string): boolean {
  return nologinRe.test(shell);
}
