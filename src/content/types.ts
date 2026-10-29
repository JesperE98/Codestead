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
  title: string;
  /** Markdown. Block inom :::debian / :::arch / :::redhat visas bara för den familjen. */
  content: string;
  tasks: Task[];
}

export interface Part {
  id: string;
  title: string;
}

export function resolve<T>(v: PerDistro<T>, d: Distro): T {
  return typeof v === 'function' ? (v as (d: Distro) => T)(d) : v;
}
