// Port of Network/NetworkLib.Routing.cs – NetworkLib: reachability (ping/traceroute timing), interfaces, routes and neighbours.

import { Js } from "../Js.js";
import type { Shell } from "../Shell/Shell.js";
import type { Iface as IfaceInfo } from "./Iface.js";
import { Gateway, GatewayMac, Iface, isLocal, isServer, LanPrefix, linkUp, myIp, MyIpAddress, myMac, MyMacAddr, ServerIp, ServerMac } from "./NetworkLib.js";
import { internetHostByIp } from "./NetworkLib.Internet.js";

// ---------- Reachability ----------

/** Can the computer reach the address? "ok", "netunreach", "hostunreach" or "timeout". */
export function reach(sh: Shell, ip: string): string {
  if (isLocal(sh, ip)) return "ok";
  if (!linkUp(sh)) return "netunreach";
  if (ip.startsWith(LanPrefix)) return [Gateway, ServerIp, MyIpAddress].includes(ip) ? "ok" : "hostunreach";
  return internetHostByIp(ip) !== null ? "ok" : "timeout";
}

/** A number between 0 and 1 that is always the same for the same input (FNV-1a with uint arithmetic). */
function noise(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul((h ^ seed.charCodeAt(i)) >>> 0, 16777619) >>> 0;
  return (h % 10_000) / 10_000;
}

/** Round-trip time in milliseconds for a packet to the address. */
export function rtt(sh: Shell, ip: string, seq: number): number {
  const n = noise(`${ip}#${seq}`);
  if (isLocal(sh, ip)) return 0.025 + n * 0.03;
  if (ip === Gateway) return 0.45 + n * 0.5;
  if (ip.startsWith(LanPrefix)) return 0.3 + n * 0.4;
  const base = 6 + noise(ip) * 25;
  return base + n * 2.5;
}

export function ttl(sh: Shell, ip: string): number {
  if (isLocal(sh, ip) || ip.startsWith(LanPrefix)) return 64;
  return 50 + Math.floor(noise(`ttl${ip}`) * 9);
}

/** The way there (for traceroute): the routers the packet passes, the target last. */
export function hops(sh: Shell, ip: string): (string | null)[] {
  if (isLocal(sh, ip) || ip.startsWith(LanPrefix)) return [ip];
  const path: (string | null)[] = [Gateway, "100.64.0.1", "198.51.100.1", null, "203.0.113.1"];
  if (reach(sh, ip) === "ok") path.push(ip);
  return path;
}

// ---------- Interfaces and routes ----------

/** Link-local IPv6 address made from the MAC address (EUI-64). */
function linkLocal(mac: string): string {
  const b = mac.split(":").map((x) => Js.parseInt(x, 16));
  b[0] = b[0]! ^ 2;
  const hex = (x: number, y: number): string => ((x << 8) | y).toString(16);
  return `fe80::${hex(b[0], b[1]!)}:${hex(b[2]!, 0xff)}:${hex(0xfe, b[3]!)}:${hex(b[4]!, b[5]!)}`;
}

export function interfaces(sh: Shell): IfaceInfo[] {
  const up = linkUp(sh);
  const mac = myMac(sh);
  return [
    {
      index: 1,
      name: "lo",
      flags: "LOOPBACK,UP,LOWER_UP",
      mtu: 65536,
      qdisc: "noqueue",
      state: "UNKNOWN",
      linkType: "loopback",
      mac: "00:00:00:00:00:00",
      brd: "00:00:00:00:00:00",
      inet: [{ addr: "127.0.0.1", prefix: 8, scope: "host", extra: "", lft: "forever" }],
      inet6: [{ addr: "::1", prefix: 128, scope: "host", extra: "noprefixroute" }],
    },
    {
      index: 2,
      name: Iface,
      flags: up ? "BROADCAST,MULTICAST,UP,LOWER_UP" : "BROADCAST,MULTICAST",
      mtu: 1500,
      qdisc: "fq_codel",
      state: up ? "UP" : "DOWN",
      linkType: "ether",
      mac,
      brd: "ff:ff:ff:ff:ff:ff",
      inet: [{ addr: myIp(sh), prefix: 24, brd: "192.168.1.255", scope: "global", extra: "dynamic noprefixroute", lft: "85934sec" }],
      inet6: up ? [{ addr: linkLocal(mac), prefix: 64, scope: "link", extra: "noprefixroute" }] : [],
    },
  ];
}

export function routes(sh: Shell): string[] {
  if (!linkUp(sh)) return [];
  const src = myIp(sh);
  return [`default via ${Gateway} dev ${Iface} proto dhcp src ${src} metric 100`, `192.168.1.0/24 dev ${Iface} proto kernel scope link src ${src} metric 100`];
}

/** The ARP table: neighbours on the local network the computer has talked to. */
export function neighbours(sh: Shell): string[] {
  if (!linkUp(sh)) return [];
  const list = [`${Gateway} dev ${Iface} lladdr ${GatewayMac} REACHABLE`];
  if (isServer(sh)) list.push(`${MyIpAddress} dev ${Iface} lladdr ${MyMacAddr} STALE`);
  else list.push(`${ServerIp} dev ${Iface} lladdr ${ServerMac} STALE`);
  return list;
}
