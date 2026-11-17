// Port of Game/AchievementsLib.cs – Codestead Linux's achievements: the common ones (learning, exams, habits) and its
// own (terminal and hidden ones), in gallery order.

import { Achievement, type AchievementContext, AchievementCategory, CommonAchievements } from "@codestead/learning";
import { CommandInfo } from "./CommandInfo.js";

const { count, tasks, partDone, checkpoints, unaided, streak } = CommonAchievements;

function cmd(c: AchievementContext, test: (cmd: CommandInfo) => boolean): boolean {
  return c.command instanceof CommandInfo && test(c.command);
}

function families(c: AchievementContext): number {
  return ["@debian", "@arch", "@redhat"].filter((f) => c.progress.tasks.some((t) => t.endsWith(f))).length;
}

const sandwichRe = /^(sudo\s+)?make\s+me\s+a\s+sandwich\b/i;
const helloRe = /hello,?\s*world/i;

function rmRoot(cmd: CommandInfo): boolean {
  return cmd.commands.some((words) => {
    let skip = 0;
    while (skip < words.length && (words[skip] === "sudo" || (words[skip]!.startsWith("-") && words[0] === "sudo"))) skip++;
    const w = words.slice(skip);
    if (w.length === 0 || w[0] !== "rm") return false;
    const recursive = w
      .slice(1)
      .some((a) => a === "--recursive" || (a.startsWith("-") && !a.startsWith("--") && (a.includes("r") || a.includes("R"))));
    return recursive && w.slice(1).some((a) => a === "/" || a === "/*");
  });
}

export const all: readonly Achievement[] = [
  // Learning
  CommonAchievements.firstTask,
  CommonAchievements.firstChapter,
  tasks(25, "🧩"),
  tasks(100, "💯"),
  CommonAchievements.tasksAll,
  partDone("grunder", "🧱"),
  partDone("system", "⚙️"),
  partDone("distro", "📦"),
  partDone("admin", "🔧"),
  partDone("natverk", "🌐"),
  partDone("skript", "🤖"),
  partDone("verktyg", "🧰"),
  count("all-families", "🐧", AchievementCategory.Learning, families, 3),
  checkpoints(50, "🤔"),
  // Exams
  CommonAchievements.examFirst,
  CommonAchievements.examPerfect,
  CommonAchievements.examAll,
  CommonAchievements.examComeback,
  // Terminal
  count("sudo-first", "🔑", AchievementCategory.Terminal, (c) => c.game.stats.sudo, 1),
  count("pipe-first", "🔗", AchievementCategory.Terminal, (c) => (c.game.stats.longestPipe >= 2 ? 1 : 0), 1),
  new Achievement("pipe-long", "🚰", AchievementCategory.Terminal, (c) => c.game.stats.longestPipe >= 4),
  count("redirect-first", "📝", AchievementCategory.Terminal, (c) => c.game.stats.redirects, 1),
  count("loop-first", "🔁", AchievementCategory.Terminal, (c) => c.game.stats.loops, 1),
  count("script-first", "📜", AchievementCategory.Terminal, (c) => c.game.stats.scripts, 1),
  count("commands-25", "📚", AchievementCategory.Terminal, (c) => c.game.stats.commandNames.length, 25),
  count("commands-500", "⚡", AchievementCategory.Terminal, (c) => c.game.stats.commands, 500),
  // Habits
  unaided(10, "🎯"),
  unaided(50, "🧭"),
  streak(3, "🌱"),
  streak(7, "🔥"),
  streak(30, "🌋"),
  CommonAchievements.levelMax,
  // Hidden – found by exploring the terminal
  new Achievement("rm-rf-root", "💥", AchievementCategory.Hidden, (c) => cmd(c, rmRoot)),
  new Achievement("cowsay", "🐄", AchievementCategory.Hidden, (c) => cmd(c, (x) => x.exitCode === 0 && x.names.includes("cowsay"))),
  new Achievement("rtfm", "📖", AchievementCategory.Hidden, (c) => c.game.stats.manPages.length > 0),
  new Achievement("commands-50", "🧠", AchievementCategory.Hidden, (c) => c.game.stats.commandNames.length >= 50),
  new Achievement("sandwich", "🥪", AchievementCategory.Hidden, (c) => cmd(c, (x) => sandwichRe.test(x.line))),
  new Achievement("vim-quit", "🚪", AchievementCategory.Hidden, (c) =>
    cmd(c, (x) => [":q", ":q!", ":wq", ":x", ":qa", ":qa!"].includes(x.line)),
  ),
  new Achievement("sl", "🚂", AchievementCategory.Hidden, (c) => cmd(c, (x) => x.firstWords.includes("sl"))),
  new Achievement("hello-world", "🌍", AchievementCategory.Hidden, (c) =>
    cmd(
      c,
      (x) =>
        x.exitCode === 0 &&
        x.commands.some((w) => w.length > 1 && (w[0] === "echo" || w[0] === "printf") && helloRe.test(w.slice(1).join(" "))),
    ),
  ),
  new Achievement("answer-42", "🌌", AchievementCategory.Hidden, (c) => cmd(c, (x) => x.output.trim() === "42")),
  new Achievement("night-owl", "🦉", AchievementCategory.Hidden, (c) => c.solvedNow.length > 0 && c.now.getHours() < 4),
];

export function find(id: string): Achievement | null {
  return all.find((a) => a.id === id) ?? null;
}
