// Port of Commands/Ssh/SshCmd.cs (src/shell/commands/ssh.ts) – ssh, ssh-keygen and ssh-copy-id. The server
// server.lan (192.168.1.10) is a small shell of its own (Debian) that lives in memory as long as the app is
// open. Commands sent with "ssh student@server.lan COMMAND" really run there (the student's own user name).
// This is the group's root file (helpers and the command lists); the commands themselves are SshCmd.<Name>.ts.

import { Js } from "../../Js.js";
import * as NetworkLib from "../../Network/NetworkLib.js";
import * as ProcsLib from "../../Procs/ProcsLib.js";
import { Shell } from "../../Shell/Shell.js";
import type { MsgArgs } from "../../ShellI18n.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import type { Sink } from "../../Types/Sink.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { rsync } from "./SshCmd.Rsync.js";
import { scp } from "./SshCmd.Scp.js";
import { ssh } from "./SshCmd.Ssh.js";
import { sshCopyId } from "./SshCmd.SshCopyId.js";
import { sshKeygen } from "./SshCmd.SshKeygen.js";

export * from "./SshCmd.Rsync.js";
export * from "./SshCmd.Scp.js";
export * from "./SshCmd.Ssh.js";
export * from "./SshCmd.SshCopyId.js";
export * from "./SshCmd.SshKeygen.js";
export * from "./SshCmd.Transfer.js";

export function dim(sh: Shell, key: string, args?: MsgArgs): string {
  return `${UtilCmd.Color.dim}${sh.msg(key, args)}${UtilCmd.Color.reset}\n`;
}

export const HostFp = "SHA256:q7Jx3MmP0yZk8VbW1sTn4dLr9HcE2uFgA6oYiKjN5Rw";
const hostKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHk3c2VydmVyLmxhbi1zaW11bGVyYWQtdsOkcmRueWNrZWw";

// ---------- The server ----------

/** The server of each student's computer (a ConditionalWeakTable in C#). */
const servers = new WeakMap<Shell, Shell>();

export function keyFlag(sh: Shell): string {
  return `net:ssh-key:${sh.currentUser().name}@${NetworkLib.ServerName}`;
}

function hasKeyFlag(sh: Shell): boolean {
  return sh.flags.get(keyFlag(sh)) === true;
}

/** The server that belongs to the student's computer (created the first time it is needed). */
export function serverFor(sh: Shell): Shell {
  // The server speaks the student's language too: same user name, files in the same language.
  const cached = servers.get(sh);
  if (cached !== undefined && cached.world !== sh.world) servers.delete(sh);
  let server = servers.get(sh);
  if (server === undefined) {
    server = Shell.create("debian", sh.world.lang);
    const distro = Js.clone(server.distro);
    distro.hostname = NetworkLib.ServerName;
    server.distro = distro;
    NetworkLib.markAsServer(server);
    const root = server.rootUser();
    server.vfs.writeFile("/etc/hostname", `${NetworkLib.ServerName}\n`, root);
    server.vfs.writeFile("/etc/hosts", `127.0.0.1\tlocalhost\n127.0.1.1\t${NetworkLib.ServerName}.lan ${NetworkLib.ServerName}\n::1\t\tlocalhost ip6-localhost ip6-loopback\n`, root);
    server.vfs.writeFile(`${server.world.home}/${server.world.get("welcomeFile")}`, server.world.file("welcome"), server.currentUser());
    server.proc.procs = server.proc.procs.filter((p) => p.pid !== ProcsLib.RunawayPid);
    servers.set(sh, server);
  }
  server.lang = sh.lang;
  // The key ssh-copy-id installed (the flag is saved, the server's file system is not).
  const pub = publicKey(sh);
  if (hasKeyFlag(sh) && pub !== null) addAuthorizedKey(server, pub);
  return server;
}

export function addAuthorizedKey(server: Shell, pub: string): void {
  const name = server.world.user;
  const user = server.getUser(name);
  const dir = `${server.world.home}/.ssh`;
  if (server.vfs.tryLookup(dir, user) === null) server.vfs.insert(dir, VfsLib.makeDir(name, Js.oct(700), Js.obj<FsNode>(), name), user);
  const file = `${dir}/authorized_keys`;
  const existing = server.vfs.tryLookup(file, user)?.content ?? "";
  if (!existing.includes(pub.trim())) server.vfs.writeFile(file, existing + pub.trim() + "\n", user);
}

// ---------- Keys ----------

export function sshDir(sh: Shell): string {
  return `${sh.currentUser().home}/.ssh`;
}

export function publicKey(sh: Shell, path: string | null = null): string | null {
  const user = sh.currentUser();
  const paths = path ? [path.endsWith(".pub") ? path : path + ".pub"] : ["id_ed25519.pub", "id_ecdsa.pub", "id_rsa.pub"].map((n) => `${sshDir(sh)}/${n}`);
  for (const p of paths) {
    const node = sh.vfs.tryLookup(sh.resolve(p), user);
    if (node?.type === "file" && node.content) return node.content;
  }
  return null;
}

function hasPrivateKey(sh: Shell): boolean {
  return ["id_ed25519", "id_ecdsa", "id_rsa"].some((n) => sh.vfs.tryLookup(`${sshDir(sh)}/${n}`, sh.currentUser())?.type === "file");
}

export function ensureSshDir(sh: Shell, io: Sink, announce: boolean): boolean {
  const dir = sshDir(sh);
  const user = sh.currentUser();
  if (sh.vfs.tryLookup(dir, user) !== null) return true;
  try {
    sh.vfs.insert(dir, VfsLib.makeDir(user.name, Js.oct(700), Js.obj<FsNode>(), user.groups[0] ?? null), user);
    if (announce) io.out(`Created directory '${dir}'.\n`);
    return true;
  } catch (e) {
    if (!(e instanceof FsError)) throw e;
    io.err(`${dir}: ${e.message}\n`);
    return false;
  }
}

// ---------- known_hosts and login ----------

export interface Dest {
  user: string;
  host: string;
  port: number;
}

function hostKeyName(d: Dest): string {
  return d.port === 22 ? d.host : `[${d.host}]:${Js.num(d.port)}`;
}

function isKnown(sh: Shell, d: Dest): boolean {
  const content = sh.vfs.tryLookup(`${sshDir(sh)}/known_hosts`, sh.currentUser())?.content ?? "";
  return content.split("\n").some((l) => l.split(" ")[0]!.split(",").includes(hostKeyName(d)));
}

const why = new Map<string, string>([
  ["refused", "Connection refused"],
  ["timeout", "Connection timed out"],
  ["netunreach", "Network is unreachable"],
  ["hostunreach", "No route to host"],
]);

/**
 * Connects to the server: name lookup, TCP, host key (asks "yes/no" the first time) and then
 * then. Returns the exit code, or 0 if a question is waiting.
 */
export function sshConnect(ctx: CmdCtx, d: Dest, then: (io: Sink) => number): number {
  const sh = ctx.sh;
  const resolved = NetworkLib.resolveHost(sh, d.host);
  if (!resolved.ok) {
    ctx.err(`ssh: Could not resolve hostname ${d.host}: ${NetworkLib.resolveErrorText(resolved.error)}\n`);
    return 255;
  }
  const r = resolved;
  const port = NetworkLib.toPort(d.port);
  const c = NetworkLib.connect(sh, r.ip, port);
  if (c !== "ok") {
    ctx.err(`ssh: connect to host ${d.host} port ${Js.num(d.port)}: ${why.get(c)}\n`);
    return 255;
  }
  if (NetworkLib.service(sh, r.ip, port) !== "ssh") {
    ctx.err(`kex_exchange_identification: Connection closed by remote host\nConnection closed by ${r.ip} port ${Js.num(d.port)}\n`);
    return 255;
  }
  if (r.ip !== NetworkLib.ServerIp) {
    const local = NetworkLib.isLocal(sh, r.ip);
    ctx.err(local ? dim(sh, "ssh.ownComputerOnlyServer") : dim(sh, "ssh.onlyServer"));
    return 255;
  }
  if (isKnown(sh, d)) return then(ctx);
  if (!sh.canAskInteractively() || !ctx.isTTY) {
    ctx.err("Host key verification failed.\n");
    return 255;
  }
  const shown = r.ip === d.host ? d.host : `${d.host} (${r.ip})`;
  ctx.out(`The authenticity of host '${shown}' can't be established.\nED25519 key fingerprint is ${HostFp}.\nThis key is not known by any other names.\n`);
  const answer = (text: string, io: Sink): number => {
    const a = text.trim();
    if (a === "yes" || a === HostFp) {
      if (!ensureSshDir(sh, io, false)) return 255;
      try {
        sh.vfs.writeFile(`${sshDir(sh)}/known_hosts`, `${hostKeyName(d)} ${hostKey}\n`, sh.currentUser(), true);
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        io.err(`${sshDir(sh)}/known_hosts: ${e.message}\n`);
      }
      io.err(`Warning: Permanently added '${hostKeyName(d)}' (ED25519) to the list of known hosts.\n`);
      return then(io);
    }
    if (a === "no") {
      io.err("Host key verification failed.\n");
      return 255;
    }
    sh.askText("Please type 'yes', 'no' or the fingerprint: ", answer);
    return 0;
  };
  sh.askText("Are you sure you want to continue connecting (yes/no/[fingerprint])? ", answer);
  return 0;
}

/** Password or key. False if the login is denied. */
export function authenticate(sh: Shell, d: Dest, io: Sink): boolean {
  const keyLogin = hasKeyFlag(sh) && hasPrivateKey(sh);
  if (!keyLogin) {
    io.err(`${d.user}@${d.host}'s password: ${dim(sh, "common.skipsPassword")}`);
  }
  if (d.user !== sh.world.user) {
    io.err(`${d.user}@${d.host}: Permission denied (publickey,password).\n`);
    return false;
  }
  return true;
}

// ---------- ~/.ssh/config ----------

/** What ~/.ssh/config says about a host (null = not set). */
interface HostConfig {
  hostName: string | null;
  user: string | null;
  port: number | null;
}

/** Options ssh knows but the simulator only accepts (they change nothing here). Lower case: compared ignoring case. */
const acceptedOptions = new Set([
  "identityfile", "identitiesonly", "forwardagent", "serveraliveinterval", "serveralivecountmax", "addkeystoagent",
  "stricthostkeychecking", "userknownhostsfile", "compression", "proxyjump", "localforward", "remoteforward",
  "loglevel", "connecttimeout", "preferredauthentications", "passwordauthentication", "hostkeyalias", "include",
  "requesttty", "setenv", "sendenv", "controlmaster", "controlpath", "controlpersist", "visualhostkey",
]);

const configLineRe = /^\s*(\S+?)(?:\s*=\s*|\s+)(.*?)\s*$/;

function hostMatches(pattern: string, host: string): boolean {
  // Regex.Escape(pattern) with * → .* and ? → .
  let src = "";
  for (const ch of pattern) src += ch === "*" ? ".*" : ch === "?" ? "." : ch.replace(/[.*+?^${}()|[\]\\#\s]/g, "\\$&");
  return new RegExp("^" + src + "$", "i").test(host);
}

/**
 * Reads ~/.ssh/config for host. Like ssh, the first value found wins, and the file is refused if others may
 * write to it. Returns an error message (for stderr) when ssh would stop.
 */
function configFor(sh: Shell, host: string): { config: HostConfig; error: string | null } {
  const cfg: HostConfig = { hostName: null, user: null, port: null };
  const user = sh.currentUser();
  const path = `${sshDir(sh)}/config`;
  const node = sh.vfs.tryLookup(path, user);
  if (node?.type !== "file") return { config: cfg, error: null };
  if ((node.mode & Js.oct(22)) !== 0 || (node.owner !== user.name && node.owner !== "root")) return { config: cfg, error: `Bad owner or permissions on ${path}\n` };
  let active = true;
  const bad: string[] = [];
  const lines = (node.content ?? "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line === "" || line.startsWith("#")) continue;
    const m = configLineRe.exec(line);
    const key = m ? m[1]! : line;
    const value = m ? m[2]!.replace(/^"+|"+$/g, "") : "";
    switch (key.toLowerCase()) {
      case "host": {
        const patterns = value.split(" ").filter((p) => p !== "");
        active = patterns.some((p) => !p.startsWith("!") && hostMatches(p, host)) && !patterns.some((p) => p.startsWith("!") && hostMatches(p.slice(1), host));
        break;
      }
      case "match":
        active = value.trim().toLowerCase() === "all";
        break;
      case "hostname":
        if (active) cfg.hostName ??= value;
        break;
      case "user":
        if (active) cfg.user ??= value;
        break;
      case "port": {
        const port = Js.number(value);
        if (Number.isNaN(port) || port < 1 || port > 65535 || port !== Math.floor(port)) return { config: cfg, error: `${path} line ${i + 1}: Badly formatted port number.\n` };
        if (active) cfg.port ??= port;
        break;
      }
      default:
        if (!acceptedOptions.has(key.toLowerCase())) bad.push(`${path}: line ${i + 1}: Bad configuration option: ${key.toLowerCase()}\n`);
        break;
    }
  }
  if (bad.length > 0) return { config: cfg, error: bad.join("") + `${path}: terminating, ${bad.length} bad configuration options\n` };
  return { config: cfg, error: null };
}

/**
 * [user@]host with ~/.ssh/config applied: a short name (Host) becomes its HostName, and User and Port
 * come from the file unless they were given on the command line.
 */
export function parseDest(raw: string, loginName: string | null, sh: Shell, port: number | null): { dest: Dest | null; error: string | null } {
  const at = raw.lastIndexOf("@");
  const name = at >= 0 ? raw.slice(at + 1) : raw;
  const { config: cfg, error } = configFor(sh, name);
  if (error !== null) return { dest: null, error };
  const user = at >= 0 ? raw.slice(0, at) : (loginName ?? cfg.user ?? sh.currentUser().name);
  return { dest: { user, host: (cfg.hostName ?? name).toLowerCase(), port: port ?? cfg.port ?? 22 }, error: null };
}

let list: CommandDef[] | null = null;

/** The group's commands, in the C# order: ssh, ssh-keygen, ssh-copy-id (built on first use). */
export function all(): CommandDef[] {
  return (list ??= [ssh, sshKeygen, sshCopyId]);
}

/** The file transfer commands (scp, rsync), in the C# order. Defined in SshCmd.Transfer.cs in C#. */
export function transfer(): CommandDef[] {
  return [scp, rsync];
}
