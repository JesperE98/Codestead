// Port of Network/NetworkLib.Ports.cs – NetworkLib: listening ports, the services behind them and TCP connections.

import { Js } from "../Js.js";
import * as ProcsLib from "../Procs/ProcsLib.js";
import type { Shell } from "../Shell/Shell.js";
import type { Listener } from "./Listener.js";
import { Gateway, isLocal, LanPrefix, ServerIp } from "./NetworkLib.js";
import { internetHostByIp } from "./NetworkLib.Internet.js";
import { reach } from "./NetworkLib.Routing.js";

// ---------- Ports and services ----------

const portLongRe = /--port[= ]([0-9]+)/;
const portShortRe = /-p\s*([0-9]+)/;

/** Port number a myserver command listens on ("--port 8080"). */
export function myserverPort(cmd: string): number {
  const m = portLongRe.exec(cmd) ?? portShortRe.exec(cmd);
  return m ? toPort(Js.number(m[1])) : 8080;
}

/** A JS number used as a port, as an int (numbers that cannot be ports become -1 and never match). */
export function toPort(n: number): number {
  return Number.isNaN(n) || n !== Math.floor(n) || n < -2147483648 || n > 2147483647 ? -1 : n;
}

/** Listening ports, read from the process table. */
export function listeners(sh: Shell): Listener[] {
  const list: Listener[] = [];
  for (const p of sh.proc.procs) {
    const name = ProcsLib.procName(p);
    if (name === "sshd") {
      list.push({ proto: "tcp", addr: "0.0.0.0", port: 22, proc: p, fd: 3 });
      list.push({ proto: "tcp", addr: "[::]", port: 22, proc: p, fd: 4 });
    } else if (name === "myserver") {
      list.push({ proto: "tcp", addr: "0.0.0.0", port: myserverPort(p.cmd), proc: p, fd: 3 });
    } else if (name === "chronyd") {
      list.push({ proto: "udp", addr: "127.0.0.1", port: 323, proc: p, fd: 5 });
      list.push({ proto: "udp", addr: "[::1]", port: 323, proc: p, fd: 6 });
    }
  }
  // Array.prototype.sort is stable, like the C# StableSort.
  return list.sort((a, b) => {
    let c = a.proto === b.proto ? 0 : a.proto === "udp" ? -1 : 1;
    if (c !== 0) return c;
    c = (a.addr.startsWith("[") ? 1 : 0) - (b.addr.startsWith("[") ? 1 : 0);
    if (c !== 0) return c;
    return a.port < b.port ? -1 : a.port > b.port ? 1 : 0;
  });
}

export const serviceNames = new Map<number, string>([
  [22, "ssh"],
  [53, "domain"],
  [80, "http"],
  [443, "https"],
  [8080, "http-alt"],
]);

/** What listens on a port at an address, if anything: "ssh", "http", "https", "dns", "myserver" or null. */
export function service(sh: Shell, ip: string, port: number): string | null {
  if (isLocal(sh, ip)) {
    const l = listeners(sh).find((x) => x.proto === "tcp" && x.port === port);
    if (!l) return null;
    return ProcsLib.procName(l.proc) === "sshd" ? "ssh" : "myserver";
  }
  if (ip === Gateway) return port === 80 ? "http" : port === 53 ? "dns" : null;
  if (ip === ServerIp) return port === 22 ? "ssh" : port === 80 ? "http" : null;
  const host = internetHostByIp(ip);
  if (!host) return null;
  if (port === 443) return "https";
  if (port === 80) return "http";
  if (port === 53 && host.dns) return "dns";
  return null;
}

/** Tries to open a TCP connection: "ok", "refused", "timeout", "netunreach" or "hostunreach". */
export function connect(sh: Shell, ip: string, port: number): string {
  const r = reach(sh, ip);
  if (r !== "ok") return r;
  if (service(sh, ip, port) !== null) return "ok";
  // Computers on the local network say no at once, servers on the internet have a firewall and do not answer at all.
  return isLocal(sh, ip) || ip.startsWith(LanPrefix) ? "refused" : "timeout";
}
