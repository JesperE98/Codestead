// Port of Commands/Disks/DisksCmd.Sync.cs – the sync command: writes everything waiting in memory to the disks.

import type { CommandDef } from "../../Types/CommandDef.js";

const syncMan = `NAMN
       sync - skriv cachat innehåll till diskarna

SYNOPSIS
       sync

BESKRIVNING
       Linux väntar ofta med att skriva till disken och samlar ändringarna
       i RAM-minnet (cache), eftersom det går mycket snabbare. sync tvingar
       fram skrivningen direkt. umount gör samma sak innan den kopplar
       bort ett filsystem.`;

const syncManEn = `NAME
       sync - write cached data to the disks

SYNOPSIS
       sync

DESCRIPTION
       Linux often delays writing to disk and collects the changes in RAM
       (cache), because that is much faster. sync forces the write right
       away. umount does the same thing before detaching a file system.`;

export const sync: CommandDef = {
  name: "sync",
  summary: "Skriver allt som väntar i minnet till diskarna",
  summaryEn: "Write everything waiting in memory to the disks",
  man: syncMan,
  manEn: syncManEn,
  run: () => 0,
};
