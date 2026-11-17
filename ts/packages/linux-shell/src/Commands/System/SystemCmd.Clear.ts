// Port of Commands/System/SystemCmd.Clear.cs – the clear command: clears the screen.

import { simple } from "./SystemCmd.js";

export const clear = simple(
  "clear",
  "Rensar skärmen",
  (ctx) => {
    ctx.sh.requestClear();
    return 0;
  },
  `NAMN
       clear - rensa terminalfönstret

TIPS
       Kortkommandot Ctrl+L gör samma sak.`,
);
