// Användare och grupper. Allt läses från /etc/passwd, /etc/group och /etc/shadow
// i det virtuella filsystemet – precis som på ett riktigt system – så att useradd,
// usermod, passwd m.fl. bara behöver ändra i filerna.

import { STUDENT } from './initfs';
import type { Shell } from './shell';
import type { User, VFS } from './vfs';

export interface PasswdEntry {
  name: string;
  password: string;
  uid: number;
  gid: number;
  gecos: string;
  home: string;
  shell: string;
}

export interface GroupEntry {
  name: string;
  password: string;
  gid: number;
  members: string[];
}

export interface ShadowEntry {
  name: string;
  /** Lösenordshash. "!" eller "*" först betyder låst/inget lösenord. */
  hash: string;
  /** Senaste lösenordsbyte, i dagar sedan 1970-01-01 (tom = aldrig). */
  lastChange: string;
  min: string;
  max: string;
  warn: string;
  inactive: string;
  expire: string;
  reserved: string;
}

export const PASSWD = '/etc/passwd';
export const GROUP = '/etc/group';
export const SHADOW = '/etc/shadow';

/** root som konstant – används för att läsa systemfilerna utan att fråga skalet (undviker rekursion). */
export const ROOT: User = { name: 'root', uid: 0, groups: ['root'], home: '/root' };

// ---------- Tolka och skriva filerna ----------

const lines = (text: string) => text.split('\n').filter((l) => l.trim() !== '' && !l.startsWith('#'));

export function parsePasswd(text: string): PasswdEntry[] {
  return lines(text).flatMap((l) => {
    const f = l.split(':');
    if (f.length < 7 || !f[0]) return [];
    return [{ name: f[0], password: f[1], uid: Number(f[2]), gid: Number(f[3]), gecos: f[4], home: f[5], shell: f.slice(6).join(':') }];
  });
}

export function formatPasswd(list: PasswdEntry[]): string {
  return list.map((e) => [e.name, e.password, e.uid, e.gid, e.gecos, e.home, e.shell].join(':') + '\n').join('');
}

export function parseGroup(text: string): GroupEntry[] {
  return lines(text).flatMap((l) => {
    const f = l.split(':');
    if (f.length < 3 || !f[0]) return [];
    return [{ name: f[0], password: f[1], gid: Number(f[2]), members: (f[3] ?? '').split(',').filter(Boolean) }];
  });
}

export function formatGroup(list: GroupEntry[]): string {
  return list.map((g) => `${g.name}:${g.password}:${g.gid}:${g.members.join(',')}\n`).join('');
}

export function parseShadow(text: string): ShadowEntry[] {
  return lines(text).flatMap((l) => {
    const f = l.split(':');
    if (!f[0]) return [];
    const [name, hash = '!', lastChange = '', min = '', max = '', warn = '', inactive = '', expire = '', reserved = ''] = f;
    return [{ name, hash, lastChange, min, max, warn, inactive, expire, reserved }];
  });
}

export function formatShadow(list: ShadowEntry[]): string {
  return list
    .map((s) => [s.name, s.hash, s.lastChange, s.min, s.max, s.warn, s.inactive, s.expire, s.reserved].join(':') + '\n')
    .join('');
}

function readEtc(vfs: VFS, path: string): string | undefined {
  const node = vfs.tryLookup(path, ROOT);
  return node?.type === 'file' ? (node.content ?? '') : undefined;
}

// ---------- Uppslag (med cache) ----------

interface Cache {
  passwdText: string | undefined;
  groupText: string | undefined;
  passwd: PasswdEntry[];
  group: GroupEntry[];
  users: Map<string, User>;
}

const caches = new WeakMap<VFS, Cache>();

/**
 * Tolkade /etc/passwd och /etc/group. getUser anropas väldigt ofta, så resultatet
 * sparas och tolkas bara om när filernas innehåll ändrats (strängjämförelsen är
 * billig eftersom samma sträng återanvänds tills någon skriver till filen).
 */
function cached(vfs: VFS): Cache {
  const passwdText = readEtc(vfs, PASSWD);
  const groupText = readEtc(vfs, GROUP);
  let c = caches.get(vfs);
  if (!c || c.passwdText !== passwdText || c.groupText !== groupText) {
    c = {
      passwdText,
      groupText,
      passwd: parsePasswd(passwdText ?? ''),
      group: parseGroup(groupText ?? ''),
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

export function findUser(sh: Shell, name: string): PasswdEntry | undefined {
  return passwdEntries(sh).find((e) => e.name === name);
}

export function findGroup(sh: Shell, name: string): GroupEntry | undefined {
  return groupEntries(sh).find((g) => g.name === name);
}

export function userExists(sh: Shell, name: string): boolean {
  return !!findUser(sh, name);
}

export function groupExists(sh: Shell, name: string): boolean {
  return !!findGroup(sh, name);
}

export function groupName(sh: Shell, gid: number): string {
  return groupEntries(sh).find((g) => g.gid === gid)?.name ?? String(gid);
}

export function gidOf(sh: Shell, group: string): number | undefined {
  return findGroup(sh, group)?.gid;
}

/** Används av Shell.getUser: bygger User-objektet från /etc/passwd och /etc/group. */
export function lookupUser(sh: Shell, name: string): User {
  const c = cached(sh.vfs);
  const hit = c.users.get(name);
  if (hit) return hit;
  const entry = c.passwd.find((e) => e.name === name);
  let user: User;
  if (entry) {
    const primary = c.group.find((g) => g.gid === entry.gid)?.name ?? String(entry.gid);
    const extra = c.group.filter((g) => g.gid !== entry.gid && g.members.includes(name)).map((g) => g.name);
    user = { name, uid: entry.uid, groups: [primary, ...extra.filter((g) => g !== primary)], home: entry.home };
  } else if (name === 'root') {
    user = ROOT;
  } else if (name === STUDENT) {
    // Reserv om någon har förstört /etc/passwd – eleven ska alltid kunna fortsätta.
    user = { name, uid: 1000, groups: [name, sh.distro.adminGroup], home: `/home/${name}` };
  } else {
    user = { name, uid: 65534, groups: [name], home: `/home/${name}` };
  }
  c.users.set(name, user);
  return user;
}

// ---------- Ändra filerna ----------

export interface UserDb {
  passwd: PasswdEntry[];
  group: GroupEntry[];
  shadow: ShadowEntry[];
}

/** En färsk kopia av databasen att ändra i. Spara med saveDb. */
export function loadDb(sh: Shell): UserDb {
  return {
    passwd: parsePasswd(readEtc(sh.vfs, PASSWD) ?? ''),
    group: parseGroup(readEtc(sh.vfs, GROUP) ?? ''),
    shadow: parseShadow(readEtc(sh.vfs, SHADOW) ?? ''),
  };
}

/** Skriver tillbaka filerna (bara de som ändrats, så att mtime stämmer). */
export function saveDb(sh: Shell, db: UserDb): void {
  const write = (path: string, text: string) => {
    if (readEtc(sh.vfs, path) !== text) sh.vfs.writeFile(path, text, ROOT);
  };
  write(PASSWD, formatPasswd(db.passwd));
  write(GROUP, formatGroup(db.group));
  write(SHADOW, formatShadow(db.shadow));
}

/** Dagar sedan 1970-01-01, som i /etc/shadow. */
export function today(): number {
  return Math.floor(Date.now() / 86_400_000);
}

export const UID_MIN = 1000;
export const UID_MAX = 60000;
export const SYS_UID_MIN = 100;
export const SYS_UID_MAX = 999;

/** Nästa lediga UID: ett mer än det högsta som används i intervallet (som useradd gör). */
export function nextId(used: number[], system: boolean): number {
  if (system) {
    for (let id = SYS_UID_MAX; id >= SYS_UID_MIN; id--) if (!used.includes(id)) return id;
    return SYS_UID_MAX;
  }
  const inRange = used.filter((n) => n >= UID_MIN && n <= UID_MAX);
  return inRange.length ? Math.max(...inRange) + 1 : UID_MIN;
}

export function validName(name: string): boolean {
  return /^[a-z_][a-z0-9_-]*\$?$/.test(name) && name.length <= 32;
}

// ---------- Lösenord ----------

const SALT_CHARS = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function digest(text: string, length: number): string {
  // Ingen riktig kryptografi – bara en deterministisk "hash" som ser ut som yescrypt.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let out = '';
  for (let round = 0; out.length < length; round++) {
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i) + round;
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ (c + h1), 0x5bd1e995) >>> 0;
    }
    out += SALT_CHARS[h1 % 64] + SALT_CHARS[h2 % 64] + SALT_CHARS[(h1 >>> 8) % 64];
  }
  return out.slice(0, length);
}

export function hashPassword(password: string, salt?: string): string {
  const s = salt ?? Array.from({ length: 22 }, () => SALT_CHARS[Math.floor(Math.random() * 64)]).join('');
  return `$y$j9T$${s}$${digest(s + password, 43)}`;
}

export function checkPassword(hash: string, password: string): boolean {
  const m = /^\$y\$j9T\$([^$]+)\$/.exec(hash);
  return !!m && hashPassword(password, m[1]) === hash;
}

/** "P" (har lösenord), "L" (låst) eller "NP" (inget lösenord). */
export function passwordStatus(hash: string): 'P' | 'L' | 'NP' {
  if (hash === '') return 'NP';
  if (hash.startsWith('!') || hash.startsWith('*')) return 'L';
  return 'P';
}

/** Lösenordsfältet i /etc/shadow, eller undefined om användaren saknas där. */
export function shadowHash(sh: Shell, name: string): string | undefined {
  return loadDb(sh).shadow.find((s) => s.name === name)?.hash;
}

/** Kollar ett lösenord mot /etc/shadow (används av su). */
export function verifyPassword(sh: Shell, name: string, password: string): boolean {
  const entry = loadDb(sh).shadow.find((s) => s.name === name);
  if (!entry) return false;
  if (entry.hash === '') return true;
  return checkPassword(entry.hash, password);
}

// ---------- Byta användare ----------

/**
 * Gör `name` till aktiv användare (su, sudo -i). `exit` tar en tillbaka.
 * Med login (su -, sudo -i) hamnar man i användarens hemkatalog.
 */
export function switchUser(sh: Shell, name: string, login: boolean, warn: (msg: string) => void): void {
  const entry = findUser(sh, name);
  const user = sh.getUser(name);
  sh.userStack.push(name);
  sh.env.USER = name;
  sh.env.LOGNAME = name;
  sh.env.HOME = user.home;
  if (entry?.shell) sh.env.SHELL = entry.shell;
  if (!login) return;
  const home = sh.vfs.tryLookup(user.home, user);
  if (home?.type === 'dir') sh.cwd = user.home;
  else warn(`cannot change directory to ${user.home}: No such file or directory`);
}

/** Skal som inte går att logga in med (systemanvändare). */
export function isNologin(shell: string): boolean {
  return /\/(nologin|false)$/.test(shell);
}
