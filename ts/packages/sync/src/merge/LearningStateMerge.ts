import { type Json, type JsonRecord, tryParse } from "../Json.js";
import { counter, earliest, type FieldGroup, map, max, type MergeContext, newest, record, type Rule, set, type Side } from "./Rules.js";

// The three-way merge of a learning tool's state.json (LearningState and its GameState in @codestead/learning), field
// by field – see "Sammanslagning av state.json" in docs/PLAN-KONTON-OCH-SYNK.md. It works on the parsed JSON, not on
// LearningState, so fields a newer version adds are kept, and the result keeps the file's field order.

const byDay = (field: string, then: string): FieldGroup["pick"] => (l, r, ctx) => {
  const dl = typeof l[field] === "string" ? (l[field] as string) : "";
  const dr = typeof r[field] === "string" ? (r[field] as string) : "";
  if (dl !== dr) return dl > dr ? "local" : "remote";
  const nl = typeof l[then] === "number" ? (l[then] as number) : 0;
  const nr = typeof r[then] === "number" ? (r[then] as number) : 0;
  return nl !== nr ? (nl > nr ? "local" : "remote") : ctx.newer;
};

const byNumber = (field: string): FieldGroup["pick"] => (l, r, ctx) => {
  const nl = typeof l[field] === "number" ? (l[field] as number) : 0;
  const nr = typeof r[field] === "number" ? (r[field] as number) : 0;
  return nl !== nr ? (nl > nr ? "local" : "remote") : ctx.newer;
};

const stats: Rule = record(
  {
    commands: counter,
    commandNames: set,
    manPages: set,
    pipes: counter,
    longestPipe: max,
    redirects: counter,
    loops: counter,
    scripts: counter,
    sudo: counter,
    chapterSeconds: map(counter),
  },
  [{ keys: ["lastCommandAt", "lastCommandChapter"], pick: byNumber("lastCommandAt") }],
);

const game: Rule = record(
  {
    version: max,
    // Derived: the tool computes XP again when it starts (GameRules.sync); the larger one only avoids a jump back.
    xp: max,
    achievements: map(earliest),
    completedChapters: set,
    completedParts: set,
    examsPassed: set,
    examsPerfect: set,
    examsFailed: set,
    completedProjects: set,
    unaided: set,
    solutionSeen: set,
    bestStreak: max,
    stats,
  },
  [{ keys: ["lastActiveDay", "streak"], pick: byDay("lastActiveDay", "streak") }],
);

/** The rule for a whole state.json. */
export const learningState: Rule = record({
  lang: newest,
  theme: newest,
  distro: newest,
  chapter: newest,
  progress: map(newest),
  checkpoints: map(newest),
  read: set,
  attempts: map(max),
  hintSeen: set,
  exams: map(max),
  game,
});

/**
 * Merges three versions of a state.json: `base` (the last synced one, null before the first sync on this computer),
 * `local` and `remote`. `newer` is the side that was saved last. A side that is not JSON loses to the other.
 */
export function mergeLearningState(base: string | null, local: string, remote: string, newer: Side): string {
  const l = tryParse(local), r = tryParse(remote);
  if (l === undefined) return remote;
  if (r === undefined) return local;
  const b: Json | undefined = base === null ? undefined : tryParse(base);
  const ctx: MergeContext = { newer };
  const merged = learningState(b, l, r, ctx) as JsonRecord;
  return JSON.stringify(merged);
}
