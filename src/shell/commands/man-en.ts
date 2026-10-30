// Engelska sammanfattningar och manualsidor för kommandon som inte har
// summaryEn/manEn direkt i sin CommandDef. Visas för alla språk utom svenska.

import type { Shell } from '../shell';
import type { CommandDef } from '../types';

export const MAN_EN: Record<string, { summary: string; man?: string }> = {};

export function summaryFor(def: CommandDef, sh: Shell): string {
  if (sh.lang === 'sv') return def.summary;
  return def.summaryEn ?? MAN_EN[def.name]?.summary ?? def.summary;
}

export function manFor(def: CommandDef, sh: Shell): string {
  if (sh.lang === 'sv') return def.man ?? `NAMN\n       ${def.name} - ${def.summary}`;
  const man = def.manEn ?? MAN_EN[def.name]?.man;
  return man ?? `NAME\n       ${def.name} - ${summaryFor(def, sh)}`;
}
