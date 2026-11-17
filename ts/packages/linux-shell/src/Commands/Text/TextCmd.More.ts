// Port of Commands/Text/TextCmd.More.cs – the more command: shows a file page by page (older variant of less).

import type { CommandDef } from "../../Types/CommandDef.js";
import { catLike } from "./TextCmd.js";

export const more: CommandDef = catLike(
  "more",
  "Visar en fil sida för sida (äldre variant av less)",
  `NAMN
       more - visa en fil en sida i taget

BESKRIVNING
       Föregångaren till less. I simulatorn visas hela filen direkt.`,
);
