import type { GameStats } from "./GameStats.js";

/** The init-only properties of {@link CommandFacts}. */
export interface CommandFactsInit {
  line?: string;
  output?: string;
  exitCode?: number;
}

/**
 * What a command line the learner ran contained, for the statistics and achievements. The engine counts commands
 * and command names; a tool subclasses this to count what matters for it (Codestead Linux: pipes, sudo, loops …).
 */
export class CommandFacts {
  readonly line: string;
  /** The output without colours. */
  readonly output: string;
  readonly exitCode: number;
  /** The names of commands the tool knows, in order. */
  readonly names: string[] = [];
  /** The first word of each command, known or not. */
  readonly firstWords: string[] = [];

  constructor(init: CommandFactsInit = {}) {
    this.line = init.line ?? "";
    this.output = init.output ?? "";
    this.exitCode = init.exitCode ?? 0;
  }

  /** Adds the tool's own counters to the statistics (called once per command line). */
  countInto(_stats: GameStats): void {}
}
