// Port of Commands/Fs/FsCmd.Cp.cs – the cp command: copies files and directories.

import type { CommandDef } from "../../Types/CommandDef.js";
import { copyOrMove } from "./FsCmd.js";

export const cp: CommandDef = {
  name: "cp",
  summary: "Kopierar filer och kataloger",
  man: `NAMN
       cp - kopiera filer och kataloger (copy)

SYNOPSIS
       cp [FLAGGA]... KÄLLA MÅL
       cp [FLAGGA]... KÄLLA... KATALOG

FLAGGOR
       -r, -R, --recursive   kopiera kataloger med allt innehåll
       -a, --archive         som -r, men behåll ägare och rättigheter
       -v, --verbose         berätta vad som kopieras

EXEMPEL
       cp rapport.txt rapport-kopia.txt
       cp -r projekt/ backup/`,
  run: (ctx) => copyOrMove(ctx, false),
};
