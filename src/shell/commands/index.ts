// Alla kommandon som simulatorn känner till, uppslagna på namn.
// Inbyggda kommandon (builtin) körs alltid; övriga måste finnas som fil i $PATH,
// vilket betyder att de installeras och tas bort med pakethanteraren.

import type { CommandDef } from '../types';
import { EXTRA_COMMANDS } from './extras';
import { FS_COMMANDS } from './fs';
import { PKG_COMMANDS } from './pkg';
import { SCRIPT_COMMANDS } from './script';
import { SYSTEM_COMMANDS } from './system';
import { TEXT_COMMANDS } from './text';

export const COMMANDS: Record<string, CommandDef> = {};

for (const def of [...FS_COMMANDS, ...TEXT_COMMANDS, ...SYSTEM_COMMANDS, ...PKG_COMMANDS, ...EXTRA_COMMANDS, ...SCRIPT_COMMANDS]) {
  COMMANDS[def.name] = def;
}
