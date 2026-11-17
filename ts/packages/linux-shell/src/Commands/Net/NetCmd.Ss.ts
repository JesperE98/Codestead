// Port of Commands/Net/NetCmd.Ss.cs – the ss command: show network sockets and listening ports.

import { Js } from "../../Js.js";
import type { Listener } from "../../Network/Listener.js";
import * as NetworkLib from "../../Network/NetworkLib.js";
import * as ProcsLib from "../../Procs/ProcsLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { note } from "./NetCmd.js";

export const ss: CommandDef = {
  name: "ss",
  summary: "Visar nätverksanslutningar och lyssnande portar",
  summaryEn: "Show network sockets and listening ports",
  man: `NAMN
       ss - visa sockets (nätverksanslutningar och portar)

SYNOPSIS
       ss [-tulpna]

BESKRIVNING
       ss ersätter det äldre netstat. Den vanligaste kombinationen är
       "ss -tulpn": vilka program lyssnar på vilka portar?

FLAGGOR
       -t   TCP
       -u   UDP
       -l   bara lyssnande (listening) sockets
       -p   visa vilken process som äger porten (alla processer kräver sudo)
       -n   visa portnummer i stället för tjänstenamn (22 i stället för ssh)
       -a   visa både lyssnande och anslutna

EXEMPEL
       ss -tulpn
       sudo ss -tlpn`,
  manEn: `NAME
       ss - show sockets (network connections and ports)

SYNOPSIS
       ss [-tulpna]

DESCRIPTION
       ss replaces the older netstat. The most common combination is
       "ss -tulpn": which programs are listening on which ports?

OPTIONS
       -t   TCP
       -u   UDP
       -l   listening sockets only
       -p   show the process using the socket (all processes need sudo)
       -n   numeric ports instead of service names (22 instead of ssh)
       -a   show both listening and connected sockets

EXAMPLES
       ss -tulpn
       sudo ss -tlpn`,
  run: (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "tulpnaH4",
      long: { tcp: "t", udp: "u", listening: "l", processes: "p", numeric: "n", all: "a", "no-header": "H" },
    });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const f = o.flags;
    const wantTcp = f.has("t") || !f.has("u");
    const wantUdp = f.has("u") || !f.has("t");
    const listening = f.has("l") || f.has("a");
    const user = sh.currentUser();
    const rows: Listener[] = listening ? NetworkLib.listeners(sh).filter((l) => (l.proto === "tcp" ? wantTcp : wantUdp) && (!f.has("4") || !l.addr.startsWith("["))) : [];
    const port = (n: number): string => (f.has("n") ? Js.num(n) : (NetworkLib.serviceNames.get(n) ?? Js.num(n)));
    const peer = (addr: string): string => (addr.startsWith("[") ? "[::]:*" : "0.0.0.0:*");
    let hidden = false;
    const lines = rows.map((l) => {
      let procCol = "";
      if (f.has("p")) {
        if (user.uid === 0 || l.proc.user === user.name) procCol = `users:(("${ProcsLib.procName(l.proc)}",pid=${l.proc.pid},fd=${l.fd}))`;
        else hidden = true;
      }
      const state = l.proto === "tcp" ? "LISTEN" : "UNCONN";
      const backlog = l.proto === "tcp" ? (ProcsLib.procName(l.proc) === "sshd" ? "128" : "4096") : "0";
      return `${l.proto.padEnd(6)}${state.padEnd(7)}0      ${backlog.padEnd(7)}${`${l.addr}:${port(l.port)}`.padStart(18)} ${peer(l.addr).padStart(13)} ${procCol}`.trimEnd();
    });
    if (!f.has("H")) ctx.out("Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process\n");
    for (const line of lines) ctx.out(line + "\n");
    if (hidden && ctx.isTTY) {
      note(ctx, "net.ssProcessColumn");
    }
    if (!listening && ctx.isTTY) {
      note(ctx, "net.ssNoConnections");
    }
    return 0;
  },
};
