import { Apis } from "@codestead/gp-gpu";
import { Achievement, AchievementCategory, CommonAchievements, type AchievementContext } from "@codestead/learning";
import { BuildFacts } from "./BuildFacts.js";

function build(c: AchievementContext, test: (b: BuildFacts) => boolean): boolean {
  return c.command instanceof BuildFacts && test(c.command);
}

/** The APIs in which the learner has solved at least one task. */
function apisUsed(c: AchievementContext): number {
  return Apis.all.filter((a) => c.progress.tasks.some((t) => t.endsWith("@" + a.id))).length;
}

let all: readonly Achievement[] | null = null;

/** The achievements of Codestead GP, in gallery order. Texts: ach.&lt;id&gt;.title / .desc in the UI strings. */
export const GpAchievements = {
  apisUsed,

  get all(): readonly Achievement[] {
    return (all ??= [
      // Learning
      CommonAchievements.firstTask,
      CommonAchievements.firstChapter,
      CommonAchievements.tasks(25, "🧩"),
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
      // Your project
      new Achievement("first-check", "🔍", AchievementCategory.Terminal, (c) => c.command instanceof BuildFacts),
      new Achievement("first-build", "🔨", AchievementCategory.Terminal, (c) => build(c, (b) => b.succeeded)),
      new Achievement("first-frame", "🪟", AchievementCategory.Terminal, (c) => build(c, (b) => b.showsFrames)),
      new Achievement("first-draw", "🎨", AchievementCategory.Terminal, (c) => build(c, (b) => b.drew)),
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
    ]);
  },
};
