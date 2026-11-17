// Port of Commands/System/SystemCmd.History.cs – the history command: shows previous commands.

import { Js } from "../../Js.js";
import { simple } from "./SystemCmd.js";

export const history = simple(
  "history",
  "Visar tidigare kommandon",
  (ctx) => {
    if (ctx.args.length > 0 && ctx.args[0] === "-c") {
      ctx.sh.history.length = 0;
      return 0;
    }
    const history = ctx.sh.history;
    for (let i = 0; i < history.length; i++) ctx.out(`${Js.num(i + 1).padStart(5)}  ${history[i]}\n`);
    return 0;
  },
  `NAMN
       history - visa kommandohistoriken

BESKRIVNING
       Använd pil upp/ned för att bläddra bland tidigare kommandon.

FLAGGOR
       -c    töm historiken`,
  true,
);
