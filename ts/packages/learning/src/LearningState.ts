import { GameState } from "./Game/GameState.js";
import { isObject, mapToJson, readBoolOrNull, readIntOrNull, readMap, readString, readStringList } from "./SavedJson.js";

/** What a learning tool saves between runs (state.json in its data folder). */
export class LearningState {
  /** The file name (without .json) in the tool's data folder. */
  static readonly FileName = "state";

  lang: string | null = null;
  /** null = follow the system, "light" or "dark". */
  theme: string | null = null;
  /** The variant the learner chose (Codestead Linux: the distribution). Saved as "distro" for older saves. */
  variant: string | null = null;
  chapter: string | null = null;
  /** Completed tasks (key → true). */
  progress = new Map<string, boolean>();
  /** Solved checkpoints in the lesson texts ("chapter#index"). */
  checkpoints = new Map<string, boolean>();
  /** Chapters without checkpoints that the learner has marked as read. */
  read: string[] = [];
  /** Commands run while a task was unfinished, per task key (unlocks the solution). */
  attempts = new Map<string, number>();
  /** Task keys whose hint has been opened (also unlocks the solution). */
  hintSeen: string[] = [];
  /** Best exam result in percent, per main chapter. */
  exams = new Map<string, number>();
  /** XP, achievements, streak and counters (see GameRules). */
  game = new GameState();

  /** Reads a saved state (the parsed JSON of state.json); null when it is not a JSON object. */
  static fromJson(v: unknown): LearningState | null {
    if (!isObject(v)) return null;
    const s = new LearningState();
    s.lang = readString(v.lang);
    s.theme = readString(v.theme);
    s.variant = readString(v.distro);
    s.chapter = readString(v.chapter);
    s.progress = readMap(v.progress, readBoolOrNull);
    s.checkpoints = readMap(v.checkpoints, readBoolOrNull);
    s.read = readStringList(v.read);
    s.attempts = readMap(v.attempts, readIntOrNull);
    s.hintSeen = readStringList(v.hintSeen);
    s.exams = readMap(v.exams, readIntOrNull);
    s.game = GameState.fromJson(v.game);
    return s;
  }

  /** The saved form: the C# names and order (nulls are left out by toSavedJson). */
  toJSON(): Record<string, unknown> {
    return {
      lang: this.lang,
      theme: this.theme,
      distro: this.variant,
      chapter: this.chapter,
      progress: mapToJson(this.progress),
      checkpoints: mapToJson(this.checkpoints),
      read: this.read,
      attempts: mapToJson(this.attempts),
      hintSeen: this.hintSeen,
      exams: mapToJson(this.exams),
      game: this.game,
    };
  }

  /**
   * Moves saved task progress to new keys after tasks moved to another chapter (old key → new key). A key counted
   * per variant group ("chapter/task@family") follows its task. Returns whether anything changed.
   */
  moveTasks(moved: ReadonlyMap<string, string>): boolean {
    let changed = false;
    for (const [from, to] of moved) {
      changed = LearningState.renameIn(this.progress, from, to) || changed;
      changed = LearningState.renameIn(this.attempts, from, to) || changed;
      changed = LearningState.renameInList(this.hintSeen, from, to) || changed;
      changed = LearningState.renameInList(this.game.unaided, from, to) || changed;
      changed = LearningState.renameInList(this.game.solutionSeen, from, to) || changed;
    }
    return changed;
  }

  private static newKey(key: string, from: string, to: string): string | null {
    return key === from ? to : key.startsWith(from + "@") ? to + key.slice(from.length) : null;
  }

  private static renameIn<T>(dict: Map<string, T>, from: string, to: string): boolean {
    let changed = false;
    for (const key of [...dict.keys()]) {
      const target = LearningState.newKey(key, from, to);
      if (target === null) continue;
      const value = dict.get(key) as T;
      dict.delete(key);
      if (!dict.has(target)) dict.set(target, value); // TryAdd
      changed = true;
    }
    return changed;
  }

  private static renameInList(list: string[], from: string, to: string): boolean {
    let changed = false;
    for (let i = list.length - 1; i >= 0; i--) {
      const target = LearningState.newKey(list[i]!, from, to);
      if (target === null) continue;
      list.splice(i, 1);
      if (!list.includes(target)) list.push(target);
      changed = true;
    }
    return changed;
  }
}
