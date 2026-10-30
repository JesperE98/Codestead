// Alla kommandon som simulatorn känner till, uppslagna på namn.
// Inbyggda kommandon (builtin) körs alltid; övriga måste finnas som fil i $PATH,
// vilket betyder att de installeras och tas bort med pakethanteraren.

import type { CommandDef } from '../types';
import { ARCHIVE_COMMANDS } from './archive';
import { EXTRA_COMMANDS } from './extras';
import { FS_COMMANDS } from './fs';
import { PKG_COMMANDS } from './pkg';
import { PROC_COMMANDS } from './procs';
import { SCRIPT_COMMANDS } from './script';
import { SHELL_COMMANDS } from './shells';
import { SYSTEM_COMMANDS } from './system';
import { TEXT_COMMANDS } from './text';
import { TEXTPROC_COMMANDS } from './textproc';

export const COMMANDS: Record<string, CommandDef> = {};

for (const def of [...FS_COMMANDS, ...TEXT_COMMANDS, ...SYSTEM_COMMANDS, ...PKG_COMMANDS, ...EXTRA_COMMANDS, ...SCRIPT_COMMANDS, ...PROC_COMMANDS, ...TEXTPROC_COMMANDS]) {
  COMMANDS[def.name] = def;
}

// Arkiv och komprimering (tar, gzip, zip ...) samt du.
for (const def of ARCHIVE_COMMANDS) COMMANDS[def.name] = def;

// Andra skal: zsh, fish, chsh och fish/zsh-inbyggda kommandon.
for (const def of SHELL_COMMANDS) COMMANDS[def.name] = def;
