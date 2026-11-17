// Port of Commands/Net/NetCmd.cs (src/shell/commands/net.ts) – network commands: ip, ping, ss, dig, host, nslookup,
// getent, traceroute, curl, wget and the practice server myserver. The network itself is in Network/ (NetworkLib).
// This is the group's root file (helpers and the command list); the commands themselves are NetCmd.<Name>.ts.

import { Js } from "../../Js.js";
import type { HttpResponse } from "../../Network/HttpResponse.js";
import * as NetworkLib from "../../Network/NetworkLib.js";
import type { MsgArgs } from "../../ShellI18n.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { curl } from "./NetCmd.Curl.js";
import { dig } from "./NetCmd.Dig.js";
import { getent } from "./NetCmd.Getent.js";
import { host } from "./NetCmd.Host.js";
import { ip } from "./NetCmd.Ip.js";
import { myserver } from "./NetCmd.Myserver.js";
import { nslookup } from "./NetCmd.Nslookup.js";
import { ping } from "./NetCmd.Ping.js";
import { ss } from "./NetCmd.Ss.js";
import { traceroute } from "./NetCmd.Traceroute.js";
import { wget } from "./NetCmd.Wget.js";

export * from "./NetCmd.Curl.js";
export * from "./NetCmd.Dig.js";
export * from "./NetCmd.Getent.js";
export * from "./NetCmd.Host.js";
export * from "./NetCmd.Ip.js";
export * from "./NetCmd.Myserver.js";
export * from "./NetCmd.Nslookup.js";
export * from "./NetCmd.Ping.js";
export * from "./NetCmd.Ss.js";
export * from "./NetCmd.Traceroute.js";
export * from "./NetCmd.Wget.js";

export function note(ctx: CmdCtx, key: string, args?: MsgArgs): void {
  ctx.err(`${UtilCmd.Color.dim}${ctx.sh.msg(key, args)}${UtilCmd.Color.reset}\n`);
}

export function isRoot(ctx: CmdCtx): boolean {
  return ctx.sh.currentUser().uid === 0;
}

export function isInteger(n: number): boolean {
  return Number.isFinite(n) && n === Math.floor(n);
}

export function reverseZone(ip: string): string {
  return ip.split(".").reverse().join(".") + ".in-addr.arpa";
}

/** Which DNS server to use: @server, otherwise /etc/resolv.conf. */
export function pickServer(ctx: CmdCtx, explicitServer: string | null): string | null {
  if (explicitServer) {
    if (NetworkLib.isIPv4(explicitServer)) return explicitServer;
    const r = NetworkLib.resolveHost(ctx.sh, explicitServer);
    return r.ok ? r.ip : null;
  }
  return NetworkLib.nameserver(ctx.sh);
}

// ---------- URLs, curl and wget ----------

export interface Url {
  /** "http" or "https". */
  scheme: string;
  host: string;
  port: number;
  path: string;
  /** The host as it was typed, with the port if one was given ("localhost:8080"). */
  hostPort: string;
}

const schemeRe = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//;
const hostPortRe = /^([^:@]+)(?::([0-9]+))?$/;
const httpUrlRe = /^https?:\/\//i;

/** Parses a URL. On failure url is null and error is "protocol" (with scheme) or "malformed". */
export function parseUrl(raw: string): { url: Url | null; error: string | null; scheme: string | null } {
  let rest = raw;
  let scheme = "http";
  const m = schemeRe.exec(raw);
  if (m) {
    scheme = m[1]!.toLowerCase();
    rest = raw.slice(m[0].length);
  }
  if (scheme !== "http" && scheme !== "https") return { url: null, error: "protocol", scheme: m?.[1] ?? "" };
  const slash = rest.search(/[/?#]/);
  const hostPort = slash < 0 ? rest : rest.slice(0, slash);
  let path = slash < 0 ? "/" : rest.slice(slash);
  if (!path.startsWith("/")) path = "/" + path;
  const hp = hostPortRe.exec(hostPort.replace(/^.*@/, ""));
  if (!hp) return { url: null, error: "malformed", scheme: null };
  const port = hp[2] !== undefined && hp[2] !== "" ? Js.number(hp[2]) : scheme === "https" ? 443 : 80;
  return { url: { scheme, host: hp[1]!.toLowerCase(), port, path: path.replace(/#.*/, ""), hostPort }, error: null, scheme: null };
}

export function joinUrl(base: Url, location: string): string {
  if (httpUrlRe.test(location)) return location;
  return `${base.scheme}://${base.hostPort}${location.startsWith("/") ? location : "/" + location}`;
}

export function header(r: HttpResponse, name: string): string | null {
  for (const h of r.headers) if (h.key.toLowerCase() === name) return h.value;
  return null;
}

/** Saves to a file. Returns the error message, or null. */
export function saveFile(ctx: CmdCtx, path: string, content: string): string | null {
  try {
    ctx.sh.vfs.writeFile(ctx.sh.resolve(path), content, ctx.sh.currentUser());
    return null;
  } catch (e) {
    if (!(e instanceof FsError)) throw e;
    return e.message;
  }
}

let list: CommandDef[] | null = null;

/** The group's commands, in the C# order (built on first use). */
export function all(): CommandDef[] {
  return (list ??= [ip, ping, ss, dig, host, nslookup, getent, traceroute, curl, wget, myserver]);
}
