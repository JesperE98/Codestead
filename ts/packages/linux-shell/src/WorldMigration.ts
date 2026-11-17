// Port of WorldMigration.cs – changing the language of a computer that is already in use (see World.ts): when the
// student switches language, the exercise files, the folders and the user are renamed and the untouched files get
// the text of the new language. What the student has written or changed stays as it is, and so do git repositories
// (renaming or rewriting tracked files would show up as changes in git).
//
// Terminals saved before the world existed are Swedish and use the old program names (minserver,
// rapportd); migrateLegacy brings them up to date first.

import * as UniversalCmd from "./Commands/Universal/UniversalCmd.js";
import * as InitfsLib from "./InitfsLib.js";
import { Js, type Obj } from "./Js.js";
import * as ParserLib from "./Parser/ParserLib.js";
import type { Shell } from "./Shell/Shell.js";
import { snapshotFromJson, snapshotToJson, type ShellSnapshot } from "./Shell/ShellSnapshot.js";
import type { FsNode } from "./Vfs/FsNode.js";
import { World } from "./World.js";

/** The world of terminals saved before there was one. */
export const LegacyWorld = "sv";

/** dictionary.TryAdd(key, value) */
function tryAdd(d: Map<string, string>, key: string, value: string): void {
  if (!d.has(key)) d.set(key, value);
}

/**
 * Translates the student's computer to lang: names and untouched contents of the exercise files, the user name
 * (passwd, group, shadow, the home directory, file owners, processes, the journal) and $LANG.
 */
export function translate(sh: Shell, lang: string): void {
  const from = sh.world;
  const to = World.get(lang);
  if (from.lang === to.lang) return;

  const names = new Map<string, string>();
  for (const [key, oldName] of from.names) {
    const newName = to.names.get(key);
    if (key !== "user" && newName !== undefined && newName !== oldName) tryAdd(names, oldName, newName);
  }
  const contents = new Map<string, string>();
  for (const [key, oldText] of from.files) {
    const newText = to.files.get(key);
    if (newText !== undefined && newText !== oldText) tryAdd(contents, oldText, newText);
  }
  // The downloaded AppImage carries its name inside.
  const oldApp = UniversalCmd.appImageNode(from, "root").content;
  const newApp = UniversalCmd.appImageNode(to, "root").content;
  if (oldApp !== null && oldApp !== undefined && newApp !== null && newApp !== undefined && oldApp !== newApp) tryAdd(contents, oldApp, newApp);

  const root = sh.rootUser();
  const renamedPaths = new Map<string, string>();

  // oldPath is where the folder was, newPath where it is now (a parent may have been renamed).
  const walk = (dir: FsNode, oldPath: string, newPath: string): void => {
    if (!dir.children) return;
    // A git work tree is left as it is (the folder itself may still be renamed by its parent).
    if (dir.children.has(".git")) return;
    for (const name of [...dir.children.keys()]) {
      const node = dir.children.get(name)!;
      let current = name;
      const renamed = names.get(name);
      if (renamed !== undefined && !dir.children.has(renamed)) {
        renameChild(dir, name, renamed);
        current = renamed;
      }
      if (oldPath !== "" && (current !== name || oldPath !== newPath)) renamedPaths.set(`${oldPath}/${name}`, `${newPath}/${current}`);
      const text = node.type === "file" && node.content !== null && node.content !== undefined ? contents.get(node.content) : undefined;
      if (text !== undefined) {
        node.content = text;
        node.size = null;
      } else if (node.type === "dir") walk(node, oldPath === "" ? "" : `${oldPath}/${name}`, oldPath === "" ? "" : `${newPath}/${current}`);
    }
  };

  const home = sh.vfs.tryLookup(from.home, root);
  if (home?.type === "dir") walk(home, from.home, from.home);
  for (const mountDir of ["/mnt", "/media"]) {
    const m = sh.vfs.tryLookup(mountDir, root);
    if (m?.type === "dir") walk(m, mountDir, mountDir);
  }
  // The partitions' own copies (a stick that is not mounted): no paths to follow.
  for (const disk of sh.disks.disks) for (const part of disk.partitions) if (part.root) walk(part.root, "", "");

  // Which exercise files were already put in place (see Shell.addMissingDefaults) follows the new names,
  // and so does the working directory if it is in a renamed folder.
  renameFlagPaths(sh, renamedPaths);
  const moved = (p: string): string => {
    const hit = longestPrefix(renamedPaths, p);
    return hit === null ? p : renamedPaths.get(hit)! + p.slice(hit.length);
  };
  const moveEnv = (env: Obj<string>): void => {
    for (const k of ["PWD", "OLDPWD"]) {
      const v = env.get(k);
      if (v !== undefined) env.set(k, moved(v));
    }
  };
  sh.cwd = moved(sh.cwd);
  moveEnv(sh.env);
  for (const frame of sh.shellStack) {
    frame.saved.cwd = moved(frame.saved.cwd);
    moveEnv(frame.saved.env);
  }

  if (from.user !== to.user) renameUser(sh, from, to);

  if (sh.env.get("LANG") === from.locale) sh.env.set("LANG", to.locale);
  sh.world = to;
}

/** The longest renamed folder that the path is in (or the path itself). */
function longestPrefix(renamedPaths: Map<string, string>, path: string): string | null {
  let hit: string | null = null;
  for (const p of renamedPaths.keys()) {
    if ((path === p || path.startsWith(p + "/")) && (hit === null || p.length > hit.length)) hit = p;
  }
  return hit;
}

function renameChild(dir: FsNode, oldName: string, newName: string): void {
  const kids = Js.obj<FsNode>();
  for (const [k, v] of dir.children!) kids.set(k === oldName ? newName : k, v);
  dir.children = kids;
}

function renameFlagPaths(sh: Shell, renamedPaths: Map<string, string>): void {
  if (renamedPaths.size === 0) return;
  const prefix = "default:file:";
  for (const key of [...sh.flags.keys()].filter((k) => k.startsWith(prefix))) {
    const path = key.slice(prefix.length);
    const hit = longestPrefix(renamedPaths, path);
    if (hit === null) continue;
    const value = sh.flags.get(key)!;
    sh.flags.delete(key);
    sh.flags.set(prefix + renamedPaths.get(hit)! + path.slice(hit.length), value);
  }
}

/** Renames the student's account everywhere it is stored. */
function renameUser(sh: Shell, from: World, to: World): void {
  const [oldUser, newUser] = [from.user, to.user];
  const [oldHome, newHome] = [from.home, to.home];
  const root = sh.rootUser();
  const path = (p: string): string => (p === oldHome ? newHome : p.startsWith(oldHome + "/") ? newHome + p.slice(oldHome.length) : p);

  // passwd, shadow, group and gshadow: the name, the full name, the home directory and group memberships.
  const fields = (content: string, edit: (f: string[]) => string[]): string =>
    content
      .split("\n")
      .map((line) => (line === "" || line.startsWith("#") ? line : edit(line.split(":")).join(":")))
      .join("\n");
  const editFile = (file: string, edit: (f: string[]) => string[]): void => {
    const node = sh.vfs.tryLookup(file, root);
    if (node?.type === "file" && node.content !== null && node.content !== undefined) node.content = fields(node.content, edit);
  };
  editFile("/etc/passwd", (f) => {
    if (f[0] !== oldUser) return f;
    f[0] = newUser;
    if (f.length > 4 && f[4] === `${from.get("userFull")},,,`) f[4] = `${to.get("userFull")},,,`;
    if (f.length > 5) f[5] = path(f[5]!);
    return f;
  });
  for (const file of ["/etc/shadow", "/etc/gshadow"])
    editFile(file, (f) => {
      if (f[0] === oldUser) f[0] = newUser;
      for (let i = 2; i < f.length; i++) f[i] = memberList(f[i]!, oldUser, newUser);
      return f;
    });
  editFile("/etc/group", (f) => {
    if (f[0] === oldUser) f[0] = newUser;
    if (f.length > 3) f[3] = memberList(f[3]!, oldUser, newUser);
    return f;
  });

  // The home directory, and the user's mail and cron files.
  const homes = sh.vfs.tryLookup("/home", root);
  if (homes?.children && homes.children.has(oldUser) && !homes.children.has(newUser)) renameChild(homes, oldUser, newUser);
  for (const spool of ["/var/mail", "/var/spool/mail", "/var/spool/cron/crontabs", "/var/spool/cron"]) {
    const d = sh.vfs.tryLookup(spool, root);
    if (d?.children && d.children.has(oldUser) && !d.children.has(newUser)) renameChild(d, oldUser, newUser);
  }

  // Owners of every file.
  const owners = (n: FsNode): void => {
    if (n.owner === oldUser) n.owner = newUser;
    if (n.group === oldUser) n.group = newUser;
    if (n.children) for (const c of n.children.values()) owners(c);
  };
  owners(sh.vfs.root);

  // The session: environment, working directory, logged-in users, saved shells.
  const env = (e: Obj<string>): void => {
    for (const k of [...e.keys()]) {
      const v = e.get(k)!;
      if ((k === "USER" || k === "LOGNAME") && v === oldUser) e.set(k, newUser);
      else if (k === "HOME" || k === "PWD" || k === "OLDPWD") e.set(k, path(v));
    }
  };
  env(sh.env);
  sh.cwd = path(sh.cwd);
  for (let i = 0; i < sh.userStack.length; i++) if (sh.userStack[i] === oldUser) sh.userStack[i] = newUser;
  for (const frame of sh.shellStack) {
    env(frame.saved.env);
    frame.saved.cwd = path(frame.saved.cwd);
  }

  // Processes and the system journal. (.NET \w is Unicode.)
  const word = new RegExp(`(?<![\\p{L}\\p{Mn}\\p{Nd}\\p{Pc}-])${ParserLib.escapeRegex(oldUser)}(?![\\p{L}\\p{Mn}\\p{Nd}\\p{Pc}-])`, "gu");
  for (const p of sh.proc.procs) {
    if (p.user === oldUser) p.user = newUser;
    p.cmd = p.cmd.replaceAll(oldHome + "/", newHome + "/");
  }
  for (const e of sh.services.journal) e.msg = e.msg.replaceAll(oldHome, newHome).replace(word, newUser);

  // Flags that carry the user name or a path in the home directory.
  for (const key of [...sh.flags.keys()]) {
    const renamed = key.replaceAll(oldHome, newHome).replace(word, newUser);
    if (renamed === key) continue;
    const value = sh.flags.get(key)!;
    sh.flags.delete(key);
    sh.flags.set(renamed, value);
  }
}

function memberList(field: string, oldUser: string, newUser: string): string {
  return field.includes(oldUser)
    ? field
        .split(",")
        .map((m) => (m === oldUser ? newUser : m))
        .join(",")
    : field;
}

// ---------- Terminals saved before the world ----------

/** Old program names and Swedish system texts, as they were saved. */
const legacyText: [string, string][] = [
  ["minserver", "myserver"],
  ["Minserver", "Myserver"],
  ["rapportd", "reportd"],
  ["USBMINNE", "USBSTICK"],
  ["Rapportd", "Reportd"],
  ["# Exempelkonfiguration för reportd.", "# Example configuration for reportd."],
  ["# Kopiera den till /etc/reportd.conf och ändra efter behov:", "# Copy it to /etc/reportd.conf and change it as needed:"],
  ["rapportkatalog = ", "report_dir = "],
  ["intervall = ", "interval = "],
  ["# Reportd skapar rapporter varje timme. Installerad av administratören.", "# reportd creates reports every hour. Installed by the administrator."],
  ["# Övningsservern från kapitlet om processer.", "# The practice server from the chapter about processes."],
  ["(simulerad binärfil: ", "(simulated binary: "],
  ["(simulerade programfiler)", "(simulated program files)"],
  ["hsqs (simulerad squashfs-avbild)", "hsqs (simulated squashfs image)"],
  ["(simulerad ikon)", "(simulated icon)"],
  ["(simulerat bibliotek)", "(simulated library)"],
  ["(simulerad privat nyckel – visa den aldrig för någon!)", "(simulated private key - never show it to anyone!)"],
  ["(simulerad bild)", "(simulated image)"],
  ["(kärnan – simulerad)", "(the kernel - simulated)"],
  ["(simulerad) #1 SMP", "(simulated) #1 SMP"],
  ["Simulerad CPU @", "Simulated CPU @"],
  ["...simulerad...hash", "...simulated...hash"],
  ["# Se sudoers(5). Redigera alltid med visudo!", "# See sudoers(5). Always edit with visudo!"],
  ["# /etc/login.defs – inställningar för useradd, passwd m.fl. (utdrag)", "# /etc/login.defs - settings for useradd, passwd and others (excerpt)"],
];

/** Whole files that were Swedish and are English now (programs write English). */
const legacyFiles: [string, string][] = [
  ["2026-10-28 08:00:01 INFO  Servern startar\n2026-10-28 08:00:02 INFO  Läser konfiguration från /etc/myserver.conf\n2026-10-28 08:00:02 WARN  Konfigurationsnyckeln \"timeout\" saknas, använder 30s\n2026-10-28 08:00:03 INFO  Lyssnar på port 8080\n2026-10-28 09:14:55 INFO  GET /index.html 200\n2026-10-28 09:15:10 ERROR Kunde inte ansluta till databasen\n2026-10-28 09:15:11 INFO  Försöker igen om 5 sekunder\n2026-10-28 09:15:16 INFO  Ansluten till databasen\n2026-10-28 11:42:03 WARN  Långsam förfrågan: GET /rapport tog 4.2s\n2026-10-28 12:01:37 INFO  GET /om.html 200\n2026-10-28 13:30:00 ERROR Disken /var är 95% full\n2026-10-28 14:05:12 INFO  GET /bilder/logo.png 404\n2026-10-28 16:20:44 warn  Certifikatet går ut om 14 dagar\n2026-10-28 18:00:00 ERROR Tidsgräns överskriden för jobbet \"backup\"\n2026-10-28 23:59:59 INFO  Dagens loggar roteras\n", InitfsLib.ServerLog],
  ["# ~/.bashrc: körs av bash för interaktiva skal.\n# Här brukar man lägga alias och egna inställningar.\n\n# Exempel:\n# alias ll='ls -la'\n# export EDITOR=nano\n", InitfsLib.Bashrc],
  ["# ~/.profile: körs av inloggningsskal.\nif [ -d \"$HOME/bin\" ] ; then\n    PATH=\"$HOME/bin:$PATH\"\nfi\n", InitfsLib.Profile],
];

/** Brings a terminal saved before the world existed up to date. It is Swedish afterwards. */
export function migrateLegacy(s: ShellSnapshot): ShellSnapshot {
  let json = snapshotToJson(s);
  for (const [o, n] of legacyText) json = json.replaceAll(JSON.stringify(o).slice(1, -1), JSON.stringify(n).slice(1, -1));
  const migrated = snapshotFromJson(json)!;
  const files = new Map(legacyFiles);
  const walk = (n: FsNode): void => {
    const text = n.type === "file" && n.content !== null && n.content !== undefined ? files.get(n.content) : undefined;
    if (text !== undefined) {
      n.content = text;
      n.size = null;
    }
    if (n.children) for (const c of n.children.values()) walk(c);
  };
  walk(migrated.fs);
  migrated.world = LegacyWorld;
  return migrated;
}
