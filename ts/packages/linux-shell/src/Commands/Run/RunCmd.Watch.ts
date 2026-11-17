// Port of Commands/Run/RunCmd.Watch.cs – the watch command: run a command repeatedly and show its output.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { IO } from "../../Types/IO.js";
import * as UtilCmd from "../Util/UtilCmd.js";

export const watch: CommandDef = {
  name: "watch",
  summary: "Kör ett kommando om och om igen och visar resultatet",
  summaryEn: "Run a command repeatedly and show its output",
  man: `NAMN
       watch - kör ett kommando om och om igen

SYNOPSIS
       watch [-n SEKUNDER] [-d] KOMMANDO

BESKRIVNING
       Kör KOMMANDO varannan sekund och visar resultatet på en ren
       skärm, så att du kan se hur det förändras. Avsluta med Ctrl+C.

       I simulatorn visas resultatet en gång.

FLAGGOR
       -n SEK   kör var SEK:e sekund i stället för varannan
       -d       markera det som ändrats sedan förra gången
       -t       visa inte rubrikraden

EXEMPEL
       watch df -h
       watch -n 5 'ls -l /var/log'`,
  manEn: `NAME
       watch - run a command over and over again

SYNOPSIS
       watch [-n SECONDS] [-d] COMMAND

DESCRIPTION
       Runs COMMAND every two seconds and shows the result on a clean
       screen, so you can see how it changes. Exit with Ctrl+C.

       In the simulator the result is shown once.

OPTIONS
       -n SEC   run every SEC seconds instead of every two
       -d       highlight what changed since last time
       -t       do not show the header line

EXAMPLES
       watch df -h
       watch -n 5 'ls -l /var/log'`,
  run: (ctx) => {
    const args = [...ctx.args];
    let interval = 2;
    let title = true;
    while (args.length > 0 && args[0]!.startsWith("-") && args[0]!.length > 1) {
      const a = args.shift()!;
      if (a === "--") break;
      if (a === "-n" || a === "--interval") {
        if (args.length === 0) return UtilCmd.badOption(ctx, "option requires an argument -- 'n'");
        interval = Js.number(args.shift());
      } else if (a.startsWith("-n")) interval = Js.number(a.slice(2));
      else if (a === "-t" || a === "--no-title") title = false;
      else if (a !== "-d" && a !== "--differences" && a !== "-c" && a !== "--color") return UtilCmd.badOption(ctx, `invalid option -- '${a.replace(/^-+/, "")}'`);
    }
    if (args.length === 0) {
      ctx.err("\nUsage:\n watch [options] command\n");
      return 1;
    }
    if (Number.isNaN(interval) || interval < 0.1) interval = 0.1;
    const sh = ctx.sh;
    const line = args.join(" ");
    if (title) {
      // interval.ToString("0.0") rounds half away from zero, like Js.toFixed.
      const head = `Every ${Js.toFixed(interval, 1)}s: ${line}`;
      const d = Js.localNow();
      // DateTime.ToString("ddd MMM d HH:mm:ss yyyy", InvariantCulture)
      const date = `${UtilCmd.Days[d.getDay()]} ${UtilCmd.Months[d.getMonth()]} ${d.getDate()} ${Js.hhmmss(d)} ${d.getFullYear()}`;
      const right = `${sh.distro.hostname}: ${date}`;
      ctx.out(`${head}${" ".repeat(Math.max(2, 80 - head.length - right.length))}${right}\n\n`);
    }
    let output = "";
    const io = new IO(
      (s) => (output += s),
      (s) => (output += s),
      null,
      false,
    );
    sh.runScript(line, "sh", [], io);
    ctx.out(output);
    ctx.out(`${UtilCmd.Color.dim}${sh.msg("run.watchOnce", { seconds: Js.num(interval) })}${UtilCmd.Color.reset}\n`);
    return 0;
  },
};
