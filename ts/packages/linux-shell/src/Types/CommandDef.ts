// Port of Types/CommandDef.cs – the definition of a command: name, help summary, man page and the code that runs it.

import type { CmdCtx } from "./CmdCtx.js";

export interface CommandDef {
  readonly name: string;
  /** One line in Swedish shown by `help`. The source of the summaries in shell i18n/sv.json. */
  readonly summary: string;
  /** Simplified man page in Swedish shown by `man`. */
  readonly man?: string | null;
  /** Summary in English. The source of the summaries in shell i18n/en.json (other languages are translated there). */
  readonly summaryEn?: string | null;
  /** Man page in English (shown for every language except Swedish). */
  readonly manEn?: string | null;
  /** Built into the shell (cd, export ...) instead of a file in /usr/bin. */
  readonly builtin?: boolean;
  readonly run: (ctx: CmdCtx) => number;
}

/** The fields CommandDef.With can replace. */
export interface CommandDefOverrides {
  name?: string | null;
  summary?: string | null;
  man?: string | null;
  summaryEn?: string | null;
  manEn?: string | null;
  builtin?: boolean | null;
  run?: ((ctx: CmdCtx) => number) | null;
}

/** def.With(...) in C# ({ ...def, overrides }): a copy with some fields replaced. Missing or null fields keep their value. */
export function withDef(def: CommandDef, o: CommandDefOverrides): CommandDef {
  return {
    name: o.name ?? def.name,
    summary: o.summary ?? def.summary,
    man: o.man ?? def.man ?? null,
    summaryEn: o.summaryEn ?? def.summaryEn ?? null,
    manEn: o.manEn ?? def.manEn ?? null,
    builtin: o.builtin ?? def.builtin ?? false,
    run: o.run ?? def.run,
  };
}
