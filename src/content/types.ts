import type { Distro } from '../shell/distros';
import type { Shell } from '../shell/shell';

/** Det som en uppgift får titta på efter varje kommando. */
export interface CheckCtx {
  sh: Shell;
  distro: Distro;
  /** Kommandoraden som kördes (utan inledande/avslutande mellanslag). */
  line: string;
  /** Utdata utan färgkoder. */
  output: string;
  exitCode: number;
}

/** Text som skiljer sig mellan familjerna, t.ex. i översättningsfilerna. */
export type FamilyText = { debian: string; arch: string; redhat: string };

type PerDistro<T> = T | ((d: Distro) => T);

export interface Task {
  id: string;
  /** Uppgiftstext (markdown, en rad). */
  text: PerDistro<string>;
  hint?: PerDistro<string>;
  /** Kommandon som löser uppgiften. Används för "Visa lösning" och i testerna. */
  solution: PerDistro<string[]>;
  /** Uppgiften räknas separat för varje distributionsfamilj. */
  perFamily?: boolean;
  check(c: CheckCtx): boolean;
}

export interface Chapter {
  id: string;
  part: string;
  /** Titel på svenska. Andra språk finns i i18n/<språk>/<id>.json. */
  title: string;
  tasks: Task[];
}

export interface Part {
  id: string;
  title: string;
}

export function resolve<T>(v: PerDistro<T> | FamilyText, d: Distro): T {
  if (typeof v === 'function') return (v as (d: Distro) => T)(d);
  if (v && typeof v === 'object' && !Array.isArray(v) && 'debian' in v) return (v as FamilyText)[d.family] as T;
  return v as T;
}

/** Översättning av ett kapitel: src/content/i18n/<språk>/<kapitel-id>.json */
export interface ChapterStrings {
  title: string;
  tasks: Record<string, { text: string | FamilyText; hint?: string | FamilyText }>;
}
