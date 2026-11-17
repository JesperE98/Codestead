// Port of Commands/Net/NetCmd.Myserver.cs – the myserver command: start the practice server (a tiny web server).

import { Js } from "../../Js.js";
import * as NetworkLib from "../../Network/NetworkLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { isInteger, isRoot, note } from "./NetCmd.js";

export const myserver: CommandDef = {
  name: "myserver",
  summary: "Startar övningsservern (en liten webbserver)",
  summaryEn: "Start the practice server (a tiny web server)",
  man: `NAMN
       myserver - en liten webbserver att öva på

SYNOPSIS
       myserver [--port PORT]

BESKRIVNING
       Startar en webbserver som körs i bakgrunden (som en tjänst) och
       lyssnar på port 8080. Prova "curl http://localhost:8080" och
       "ss -tlpn". Portar under 1024 kräver root.

EXEMPEL
       myserver
       myserver --port 9090
       pkill myserver`,
  manEn: `NAME
       myserver - a tiny web server to practise with

SYNOPSIS
       myserver [--port PORT]

DESCRIPTION
       Starts a web server that runs in the background (as a service) and
       listens on port 8080. Try "curl http://localhost:8080" and
       "ss -tlpn". Ports below 1024 require root.

EXAMPLES
       myserver
       myserver --port 9090
       pkill myserver`,
  run: (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, { values: "p", long: { port: "p" } });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const pv = o.values.get("p");
    const portNum = pv !== undefined ? Js.number(pv) : 8080;
    if (!isInteger(portNum) || portNum < 1 || portNum > 65535) {
      ctx.err(`myserver: invalid port '${pv ?? ""}'\n`);
      return 2;
    }
    const port = portNum;
    if (NetworkLib.listeners(sh).some((l) => l.proto === "tcp" && l.port === port)) {
      ctx.err(`myserver: bind 0.0.0.0:${port}: Address already in use\n`);
      return 1;
    }
    if (port < 1024 && !isRoot(ctx)) {
      ctx.err(`myserver: bind 0.0.0.0:${port}: Permission denied\n`);
      return 1;
    }
    const pid = sh.proc.nextPid++;
    sh.proc.procs.push({
      pid,
      ppid: 1,
      user: sh.currentUser().name,
      cmd: `/usr/local/bin/myserver --port ${port}`,
      cpu: 0.3,
      mem: 1.2,
      vsz: 182_340,
      rss: 24_116,
      tty: "?",
      stat: "Ssl",
      start: Js.hhmm(Js.localNow()),
      time: "0:00",
    });
    ctx.out(`myserver 1.0: listening on http://0.0.0.0:${port}/ (pid ${pid})\n`);
    if (ctx.isTTY) {
      note(ctx, "net.myserverBackground", { port });
    }
    return 0;
  },
};
