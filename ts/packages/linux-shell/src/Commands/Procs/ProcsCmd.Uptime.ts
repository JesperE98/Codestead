// Port of Commands/Procs/ProcsCmd.Uptime.cs – the uptime command: shows how long the computer has been running, and
// the load.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { snapshot, timeString } from "./ProcsCmd.js";

export const uptime: CommandDef = {
  name: "uptime",
  summary: "Visar hur länge datorn varit igång och belastningen",
  man: `NAMN
       uptime - visa hur länge systemet varit igång

BESKRIVNING
       Load average är det genomsnittliga antalet processer som vill ha
       processorn under senaste 1, 5 och 15 minuterna.`,
  run: (ctx) => {
    const load = snapshot(ctx).reduce((s, p) => s + p.cpu, 0) / 100;
    ctx.out(` ${timeString(8)} up  2:14,  1 user,  load average: ${Js.toFixed(load, 2)}, ${Js.toFixed(load * 0.9, 2)}, ${Js.toFixed(load * 0.8, 2)}\n`);
    return 0;
  },
};
