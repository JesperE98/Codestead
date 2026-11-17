// Port of Commands/System/SystemCmd.Whoami.cs – the whoami command: shows which user you are.

import { simple } from "./SystemCmd.js";

export const whoami = simple(
  "whoami",
  "Visar vilken användare du är",
  (ctx) => {
    ctx.out(ctx.sh.currentUser().name + "\n");
    return 0;
  },
  `NAMN
       whoami - skriv ut ditt användarnamn

BESKRIVNING
       Visar namnet på användaren som kör kommandot. Prova "sudo whoami"!`,
);
