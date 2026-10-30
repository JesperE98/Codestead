import type { Shell } from './shell';

export interface Sink {
  out(s: string): void;
  err(s: string): void;
}

/** Indata som läses bit för bit (används av `read` i t.ex. `while read rad; do ...; done < fil`). */
export interface Reader {
  data: string;
  pos: number;
}

export interface IO extends Sink {
  /** Indata från en pipe eller fil. null betyder "tangentbordet" (inget att läsa). */
  stdin: string | null;
  /** Samma indata som en läsare med position – delas mellan kommandona i en loop. */
  reader?: Reader | null;
  /** Sant när utdata går direkt till terminalen (inte till pipe eller fil). */
  isTTY: boolean;
}

export interface CmdCtx extends IO {
  sh: Shell;
  name: string;
  args: string[];
}

export interface CommandDef {
  name: string;
  /** En rad på svenska som visas av `help`. */
  summary: string;
  /** Förenklad manualsida på svenska som visas av `man`. */
  man?: string;
  /** Sammanfattning på engelska (visas för alla språk utom svenska). */
  summaryEn?: string;
  /** Manualsida på engelska (visas för alla språk utom svenska). */
  manEn?: string;
  /** Inbyggt i skalet (cd, export ...) i stället för en fil i /usr/bin. */
  builtin?: boolean;
  run(ctx: CmdCtx): number;
}
