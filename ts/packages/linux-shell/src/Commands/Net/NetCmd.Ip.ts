// Port of Commands/Net/NetCmd.Ip.cs – the ip command: show and manipulate network interfaces, addresses and routes.

import * as NetworkLib from "../../Network/NetworkLib.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { isRoot, note } from "./NetCmd.js";

const ipObjects = ["address", "route", "link", "neighbour", "neighbor", "help"];

function ipAddr(ctx: CmdCtx, brief: boolean, only4: boolean, dev: string | null): number {
  const list = NetworkLib.interfaces(ctx.sh).filter((i) => !dev || i.name === dev);
  if (dev && list.length === 0) {
    ctx.err(`Device "${dev}" does not exist.\n`);
    return 1;
  }
  for (const i of list) {
    if (brief) {
      const addrs = i.inet.map((a) => `${a.addr}/${a.prefix}`);
      if (!only4) addrs.push(...i.inet6.map((a) => `${a.addr}/${a.prefix}`));
      ctx.out(`${i.name.padEnd(16)} ${i.state.padEnd(14)} ${addrs.join(" ")} \n`);
      continue;
    }
    ctx.out(`${i.index}: ${i.name}: <${i.flags}> mtu ${i.mtu} qdisc ${i.qdisc} state ${i.state} group default qlen 1000\n`);
    if (!only4) ctx.out(`    link/${i.linkType} ${i.mac} brd ${i.brd}\n`);
    for (const a of i.inet) {
      ctx.out(`    inet ${a.addr}/${a.prefix}${a.brd ? ` brd ${a.brd}` : ""} scope ${a.scope}${a.extra !== "" ? " " + a.extra : ""} ${i.name}\n`);
      ctx.out(`       valid_lft ${a.lft} preferred_lft ${a.lft}\n`);
    }
    if (only4) continue;
    for (const a of i.inet6) {
      ctx.out(`    inet6 ${a.addr}/${a.prefix} scope ${a.scope} ${a.extra} \n`);
      ctx.out("       valid_lft forever preferred_lft forever\n");
    }
  }
  return 0;
}

function ipLink(ctx: CmdCtx, brief: boolean, args: string[]): number {
  const sh = ctx.sh;
  const cmd = args.length > 0 ? args[0]! : "show";
  const words = args.slice(1).filter((w) => w !== "dev");
  if (cmd === "set") {
    const setDev = words[0] ?? null;
    const state = words[1] ?? null;
    if (!setDev || !NetworkLib.interfaces(sh).some((i) => i.name === setDev)) {
      ctx.err(setDev ? `Cannot find device "${setDev}"\n` : 'Not enough information: "dev" argument is required.\n');
      return 1;
    }
    if (state !== "up" && state !== "down") {
      ctx.err(`Error: either "dev" is duplicate, or "${state ?? ""}" is a garbage.\n`);
      return 255;
    }
    if (!isRoot(ctx)) {
      ctx.err("RTNETLINK answers: Operation not permitted\n");
      return 2;
    }
    if (setDev === NetworkLib.Iface) NetworkLib.setLinkUp(sh, state === "up");
    return 0;
  }
  if (cmd !== "show" && cmd !== "list" && cmd !== "ls") {
    ctx.err(`Command "${cmd}" is unknown, try "ip link help".\n`);
    return 255;
  }
  const dev = words[0] ?? null;
  const list = NetworkLib.interfaces(sh).filter((i) => !dev || i.name === dev);
  if (dev && list.length === 0) {
    ctx.err(`Device "${dev}" does not exist.\n`);
    return 1;
  }
  for (const i of list) {
    if (brief) {
      ctx.out(`${i.name.padEnd(16)} ${i.state.padEnd(14)} ${i.mac} <${i.flags}> \n`);
      continue;
    }
    ctx.out(`${i.index}: ${i.name}: <${i.flags}> mtu ${i.mtu} qdisc ${i.qdisc} state ${i.state} mode DEFAULT group default qlen 1000\n`);
    ctx.out(`    link/${i.linkType} ${i.mac} brd ${i.brd}\n`);
  }
  return 0;
}

function ipRoute(ctx: CmdCtx, args: string[]): number {
  const sh = ctx.sh;
  const cmd = args.length > 0 ? args[0]! : "show";
  const target = args[1] ?? null;
  if (cmd === "show" || cmd === "list" || cmd === "ls") {
    for (const r of NetworkLib.routes(sh)) ctx.out(r + " \n");
    return 0;
  }
  if (cmd === "get") {
    if (!target || !NetworkLib.isIPv4(target)) {
      ctx.err(`Error: inet prefix is expected rather than "${target ?? ""}".\n`);
      return 1;
    }
    const uid = sh.currentUser().uid;
    if (target.startsWith("127.") || target === NetworkLib.myIp(sh)) {
      ctx.out(`local ${target} dev lo src ${target.startsWith("127.") ? "127.0.0.1" : target} uid ${uid} \n    cache <local> \n`);
      return 0;
    }
    if (!NetworkLib.linkUp(sh)) {
      ctx.err("RTNETLINK answers: Network is unreachable\n");
      return 2;
    }
    const via = target.startsWith("192.168.1.") ? "" : `via ${NetworkLib.Gateway} `;
    ctx.out(`${target} ${via}dev ${NetworkLib.Iface} src ${NetworkLib.myIp(sh)} uid ${uid} \n    cache \n`);
    return 0;
  }
  if (["add", "del", "delete", "change", "replace", "flush"].includes(cmd)) {
    if (!isRoot(ctx)) {
      ctx.err("RTNETLINK answers: Operation not permitted\n");
      return 2;
    }
    note(ctx, "net.routeChangeUnsupported");
    return 1;
  }
  ctx.err(`Command "${cmd}" is unknown, try "ip route help".\n`);
  return 255;
}

export const ip: CommandDef = {
  name: "ip",
  summary: "Visar och ändrar nätverksgränssnitt, adresser och rutter",
  summaryEn: "Show and manipulate network interfaces, addresses and routes",
  man: `NAMN
       ip - visa och ändra nätverksinställningar

SYNOPSIS
       ip [-br] [-4] OBJEKT [KOMMANDO]

BESKRIVNING
       ip kommer från paketet iproute2 (iproute i Fedora) och har ersatt
       de gamla kommandona ifconfig och route. Objektet kan förkortas.

OBJEKT
       address (a)    IP-adresser på gränssnitten
       link (l)       gränssnitten själva (nätverkskorten)
       route (r)      routingtabellen – bl.a. standard-gatewayen
       neigh (n)      grannar i det lokala nätet (ARP-tabellen)

FLAGGOR
       -br      kort format, en rad per gränssnitt
       -4       bara IPv4

EXEMPEL
       ip a                        visa alla adresser
       ip -br a                    kort översikt
       ip route                    visa rutter och gateway
       ip route get 1.1.1.1        vilken väg tar paketen dit?
       sudo ip link set enp0s3 down   stäng av nätverkskortet
       sudo ip link set enp0s3 up     sätt på det igen`,
  manEn: `NAME
       ip - show and manipulate network settings

SYNOPSIS
       ip [-br] [-4] OBJECT [COMMAND]

DESCRIPTION
       ip comes from the iproute2 package (iproute on Fedora) and replaces
       the old ifconfig and route commands. Objects may be abbreviated.

OBJECTS
       address (a)    IP addresses on the interfaces
       link (l)       the interfaces themselves (network cards)
       route (r)      the routing table – including the default gateway
       neigh (n)      neighbours on the local network (ARP table)

OPTIONS
       -br      brief output, one line per interface
       -4       IPv4 only

EXAMPLES
       ip a                        show all addresses
       ip -br a                    short overview
       ip route                    show routes and the gateway
       ip route get 1.1.1.1        which way do packets go?
       sudo ip link set enp0s3 down   turn the network card off
       sudo ip link set enp0s3 up     turn it on again`,
  run: (ctx) => {
    const args = [...ctx.args];
    let brief = false;
    let only4 = false;
    while (args.length > 0 && args[0]!.startsWith("-")) {
      const f = args.shift()!;
      if (f === "-br" || f === "-brief" || f === "--brief") brief = true;
      else if (f === "-4") only4 = true;
      else if (["-6", "-c", "-color", "--color", "-s", "-d", "-details"].includes(f) || f.startsWith("-color=") || f.startsWith("--color=")) continue;
      else if (f === "-V" || f === "-Version") {
        ctx.out("ip utility, iproute2-6.14.0, libbpf 1.5.0\n");
        return 0;
      } else {
        ctx.err(`Option "${f}" is unknown, try "ip -help".\n`);
        return 255;
      }
    }
    const objWord = args.length > 0 ? args.shift()! : null;
    if (!objWord) {
      ctx.err(
        "Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | link | neighbour | route | ... }\n       OPTIONS := { -4 | -6 | -br[ief] | -c[olor] | -s[tatistics] | ... }\n",
      );
      return 255;
    }
    const obj = ipObjects.find((o) => o.startsWith(objWord)) ?? null;
    switch (obj) {
      case "address": {
        const cmd = args.length > 0 ? args[0]! : "show";
        const rest = args.slice(1);
        if (cmd === "show" || cmd === "list" || cmd === "ls") return ipAddr(ctx, brief, only4, rest.filter((w) => w !== "dev")[0] ?? null);
        if (["add", "del", "delete", "flush", "change", "replace"].includes(cmd)) {
          if (!isRoot(ctx)) {
            ctx.err("RTNETLINK answers: Operation not permitted\n");
            return 2;
          }
          note(ctx, "net.addressChangeUnsupported");
          return 1;
        }
        ctx.err(`Command "${cmd}" is unknown, try "ip address help".\n`);
        return 255;
      }
      case "link":
        return ipLink(ctx, brief, args);
      case "route":
        return ipRoute(ctx, args);
      case "neighbour":
      case "neighbor":
        for (const n of NetworkLib.neighbours(ctx.sh)) ctx.out(n + " \n");
        return 0;
      case "help":
        ctx.out("Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | link | neighbour | route | ... }\n");
        return 0;
      default:
        ctx.err(`Object "${objWord}" is unknown, try "ip help".\n`);
        return 1;
    }
  },
};
