// Port of Commands/Systemd/SystemdCmd.Reboot.cs – the reboot command: reboot the computer.

import type { CommandDef } from "../../Types/CommandDef.js";
import { Auth, doReboot, isRoot, sudoTip } from "./SystemdCmd.js";

export const rebootCmd: CommandDef = {
  name: "reboot",
  summary: "Startar om datorn",
  summaryEn: "Reboot the computer",
  man: `NAMN
       reboot - starta om datorn

SYNOPSIS
       sudo reboot

BESKRIVNING
       Samma sak som "systemctl reboot": alla tjänster stoppas och datorn
       startar om. Efter omstarten körs bara de tjänster som är aktiverade
       (enable). I simulatorn startar datorn om på ett ögonblick.`,
  manEn: `NAME
       reboot - reboot the computer

SYNOPSIS
       sudo reboot

DESCRIPTION
       Same as "systemctl reboot": all services are stopped and the
       computer restarts. After the reboot only enabled services run.
       In the simulator the reboot takes no time at all.`,
  run: (ctx) => {
    if (!isRoot(ctx)) {
      ctx.err(`Call to Reboot failed: ${Auth}\n`);
      sudoTip(ctx);
      return 1;
    }
    return doReboot(ctx);
  },
};
