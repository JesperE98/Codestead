import { isObject, mapToJson, readInt, readIntOrNull, readMap, readString, readStringList } from "../SavedJson.js";

// Lifetime counters over what the learner has typed.

/** Counters over everything the learner has typed in the main terminal. */
export class GameStats {
  commands = 0;
  /** Different command names (only ones the tool knows). */
  commandNames: string[] = [];
  // Counted by Codestead Linux (its CommandInfo); other tools leave them at zero.
  manPages: string[] = [];
  pipes = 0;
  longestPipe = 0;
  redirects = 0;
  loops = 0;
  scripts = 0;
  sudo = 0;
  /** Active seconds per chapter (time between commands, at most five minutes each). */
  chapterSeconds = new Map<string, number>();
  /** When the previous command ran (ms since 1970) and in which chapter. */
  lastCommandAt = 0;
  lastCommandChapter: string | null = null;

  /** Reads the saved form (see SavedJson). */
  static fromJson(v: unknown): GameStats {
    const s = new GameStats();
    if (!isObject(v)) return s;
    s.commands = readInt(v.commands);
    s.commandNames = readStringList(v.commandNames);
    s.manPages = readStringList(v.manPages);
    s.pipes = readInt(v.pipes);
    s.longestPipe = readInt(v.longestPipe);
    s.redirects = readInt(v.redirects);
    s.loops = readInt(v.loops);
    s.scripts = readInt(v.scripts);
    s.sudo = readInt(v.sudo);
    s.chapterSeconds = readMap(v.chapterSeconds, readIntOrNull);
    s.lastCommandAt = readInt(v.lastCommandAt);
    s.lastCommandChapter = readString(v.lastCommandChapter);
    return s;
  }

  /** The saved form, in the C# property order (nulls are left out by toSavedJson). */
  toJSON(): Record<string, unknown> {
    return {
      commands: this.commands,
      commandNames: this.commandNames,
      manPages: this.manPages,
      pipes: this.pipes,
      longestPipe: this.longestPipe,
      redirects: this.redirects,
      loops: this.loops,
      scripts: this.scripts,
      sudo: this.sudo,
      chapterSeconds: mapToJson(this.chapterSeconds),
      lastCommandAt: this.lastCommandAt,
      lastCommandChapter: this.lastCommandChapter,
    };
  }
}
