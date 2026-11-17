// Port of Commands/Fs/FsCmd.Mv.cs – the mv command: moves or renames files.

import type { CommandDef } from "../../Types/CommandDef.js";
import { copyOrMove } from "./FsCmd.js";

export const mv: CommandDef = {
  name: "mv",
  summary: "Flyttar eller byter namn på filer",
  man: `NAMN
       mv - flytta eller byt namn på filer (move)

SYNOPSIS
       mv [FLAGGA]... KÄLLA MÅL
       mv [FLAGGA]... KÄLLA... KATALOG

BESKRIVNING
       Om MÅL är en befintlig katalog flyttas KÄLLA dit. Annars byter
       KÄLLA namn till MÅL. Kataloger kan flyttas utan -r.

FLAGGOR
       -v, --verbose   berätta vad som flyttas`,
  run: (ctx) => copyOrMove(ctx, true),
};
