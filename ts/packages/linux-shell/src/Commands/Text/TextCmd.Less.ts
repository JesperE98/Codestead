// Port of Commands/Text/TextCmd.Less.cs – the less command: pages through a file (one screen at a time).

import type { CommandDef } from "../../Types/CommandDef.js";
import { catLike } from "./TextCmd.js";

export const less: CommandDef = catLike(
  "less",
  "Bläddrar i en fil (sida för sida)",
  `NAMN
       less - visa en fil en sida i taget

BESKRIVNING
       I en riktig terminal bläddrar du med piltangenterna, mellanslag och
       b, söker med /ord och avslutar med q. I simulatorn visas hela filen
       direkt.`,
);
