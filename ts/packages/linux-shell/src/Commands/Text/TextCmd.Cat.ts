// Port of Commands/Text/TextCmd.Cat.cs – the cat command: shows the contents of files.

import type { CommandDef } from "../../Types/CommandDef.js";
import { catLike } from "./TextCmd.js";

export const cat: CommandDef = catLike(
  "cat",
  "Visar innehållet i filer",
  `NAMN
       cat - slå ihop filer och skriv ut dem (concatenate)

SYNOPSIS
       cat [-n] [FIL]...

BESKRIVNING
       Skriver ut innehållet i en eller flera filer. Utan FIL läser cat
       från standard input, t.ex. från en pipe.

FLAGGOR
       -n    numrera raderna

EXEMPEL
       cat /etc/os-release
       cat del1.txt del2.txt > allt.txt`,
);
