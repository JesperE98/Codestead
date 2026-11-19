import { Apis } from "@codestead/gp-gpu";
import { Achievement, AchievementCategory, CommonAchievements, type AchievementContext } from "@codestead/learning";
import { GpCourse } from "../GpCourse.js";
import { BuildFacts } from "./BuildFacts.js";

function build(c: AchievementContext, test: (b: BuildFacts) => boolean): boolean {
  return c.command instanceof BuildFacts && test(c.command);
}

/** The APIs in which the learner has solved at least one task. */
function apisUsed(c: AchievementContext): number {
  return Apis.all.filter((a) => c.progress.tasks.some((t) => t.endsWith("@" + a.id))).length;
}

/** The exercises the learner has solved (keys "chapter/ex-…@api"), in any API. */
function exercisesSolved(c: AchievementContext): number {
  return c.progress.tasks.filter((k) => GpCourse.isExercise(k.slice(k.indexOf("/") + 1))).length;
}

/** A colour (0–1) within ±0.01 of an RGB colour given in 0–255. */
function isColor(c: readonly number[] | null, r: number, g: number, b: number): boolean {
  return c !== null && [r, g, b].every((v, i) => Math.abs(c[i]! - v / 255) <= 0.01);
}

const helloRe = /hello,?\s*world/i;

let all: readonly Achievement[] | null = null;

/** The achievements of Codestead GP, in gallery order. Texts: ach.&lt;id&gt;.title / .desc in the UI strings. */
export const GpAchievements = {
  apisUsed,
  exercisesSolved,

  get all(): readonly Achievement[] {
    return (all ??= [
      // Learning
      CommonAchievements.firstTask,
      CommonAchievements.firstChapter,
      CommonAchievements.tasks(25, "🧩"),
      CommonAchievements.tasks(100, "💯"),
      CommonAchievements.tasksAll,
      CommonAchievements.partDone("start", "🚪"),
      CommonAchievements.partDone("getting-started", "🔺"),
      CommonAchievements.partDone("lighting", "💡"),
      CommonAchievements.partDone("model-loading", "🪐"),
      CommonAchievements.partDone("advanced-opengl", "🧪"),
      CommonAchievements.partDone("advanced-lighting", "🌗"),
      CommonAchievements.partDone("pbr", "💎"),
      CommonAchievements.partDone("in-practice", "🎮"),
      CommonAchievements.partDone("guest-articles", "✍️"),
      CommonAchievements.count("all-apis", "🌐", AchievementCategory.Learning, apisUsed, 3),
      CommonAchievements.checkpoints(25, "🤔"),
      CommonAchievements.count("exercise-first", "🏋️", AchievementCategory.Learning, exercisesSolved, 1),
      CommonAchievements.count("exercises-25", "🥇", AchievementCategory.Learning, exercisesSolved, 25),
      // Exams
      CommonAchievements.examFirst,
      CommonAchievements.examPerfect,
      CommonAchievements.examAll,
      // Your project
      new Achievement("first-check", "🔍", AchievementCategory.Terminal, (c) => c.command instanceof BuildFacts),
      new Achievement("first-build", "🔨", AchievementCategory.Terminal, (c) => build(c, (b) => b.succeeded)),
      new Achievement("first-frame", "🪟", AchievementCategory.Terminal, (c) => build(c, (b) => b.showsFrames)),
      new Achievement("first-draw", "🎨", AchievementCategory.Terminal, (c) => build(c, (b) => b.drew)),
      new Achievement("first-texture", "🖼️", AchievementCategory.Terminal, (c) => build(c, (b) => b.textured)),
      new Achievement("first-depth", "🎲", AchievementCategory.Terminal, (c) => build(c, (b) => b.depthTested)),
      new Achievement("wireframe", "🕸️", AchievementCategory.Terminal, (c) => build(c, (b) => b.wireframe)),
      CommonAchievements.count("builds-100", "⚙️", AchievementCategory.Terminal, (c) => c.game.stats.commands, 100),
      CommonAchievements.count("functions-25", "📚", AchievementCategory.Terminal, (c) => c.game.stats.commandNames.length, 25),
      // Habits
      CommonAchievements.unaided(10, "🎯"),
      CommonAchievements.streak(3, "🌱"),
      CommonAchievements.streak(7, "🔥"),
      CommonAchievements.streak(30, "🌋"),
      // Hidden – found by experimenting
      new Achievement("magenta", "💖", AchievementCategory.Hidden, (c) =>
        build(c, (b) => b.clearColor !== null && b.clearColor[0]! > 0.99 && b.clearColor[1]! < 0.01 && b.clearColor[2]! > 0.99),
      ),
      new Achievement("night-owl", "🦉", AchievementCategory.Hidden, (c) => c.solvedNow.length > 0 && c.now.getHours() < 4),
      new Achievement("cornflower", "💙", AchievementCategory.Hidden, (c) => build(c, (b) => b.showsFrames && isColor(b.clearColor, 100, 149, 237))),
      new Achievement("tiny", "🔬", AchievementCategory.Hidden, (c) => build(c, (b) => b.drawnPixels >= 1 && b.drawnPixels <= 8)),
      new Achievement("triangles-1m", "⛰️", AchievementCategory.Hidden, (c) => build(c, (b) => b.showsFrames && b.triangles >= 1_000_000)),
      new Achievement("hello-world", "🌍", AchievementCategory.Hidden, (c) =>
        build(c, (b) => b.succeeded && (helloRe.test(b.windowTitle) || b.printed.some((l) => helloRe.test(l)))),
      ),
      new Achievement("full-hd", "📺", AchievementCategory.Hidden, (c) => build(c, (b) => b.showsFrames && b.windowWidth >= 1920 && b.windowHeight >= 1080)),
      new Achievement("new-year", "🎆", AchievementCategory.Hidden, (c) => c.solvedNow.length > 0 && c.now.getMonth() === 0 && c.now.getDate() === 1),
    ]);
  },
};
