import { Languages } from "@codestead/common";
import {
  AchievementCategories,
  AchievementContext,
  type CourseChapter,
  ChapterKinds,
  type GameEvents,
  Levels,
} from "@codestead/learning";
import type { ReactNode } from "react";
import { type AchievementCard, type CelebrationModel, type GalleryTexts, LevelModel, type StreakModel } from "../Controls/Game/Models.js";
import { ProfileModels } from "../Controls/Game/Profile/ProfileModels.js";
import type { ProfileTexts } from "../Controls/Game/Profile/ProfileTexts.js";
import { ProfileAchievement, ProfileCategory, ToolProfile } from "../Controls/Game/Profile/ToolProfile.js";
import { AchievementGalleryView } from "../Controls/Game/Views/AchievementGalleryView.js";
import { AchievementToast, SimpleNotice } from "../Controls/Game/Views/AchievementToast.js";
import { CelebrationView } from "../Controls/Game/Views/CelebrationView.js";
import type { LearningWindow } from "./LearningWindow.js";

// The window's side of the game (C#'s LearningWindow.Game.cs). The rules are in @codestead/learning; this only shows
// what they report.

const distinct = <T,>(items: Iterable<T>): T[] => [...new Set(items)];

export class WindowGame {
  /** The save had progress from before the gamification: say once that it was counted. */
  private welcomeBack = false;

  constructor(private readonly w: LearningWindow) {}

  private t(key: string, args?: Readonly<Record<string, unknown>>): string {
    return this.w.t(key, args);
  }

  /** At start: brings the game up to date with the saved progress, quietly. */
  init(): void {
    const w = this.w;
    this.welcomeBack = w.state.game.version === 0 && w.existingUser;
    const ev = w.tool.rules.sync(w.state.game, w.snapshot(), w.now());
    this.welcomeBack &&= w.state.game.xp > 0;
    if (ev.changed) w.saveState();
    this.writeProfile();
    w.notices.moreText = (n) => this.t("game.more", { n });
    w.notices.moreClicked = () => this.openAchievements();
  }

  /** After the window opened: the welcome-back notice for a save from an older version. */
  opened(): void {
    if (!this.welcomeBack) return;
    this.welcomeBack = false;
    const g = this.w.state.game;
    // After "What's new", so that it is not hidden behind it.
    this.w.overlay.showWhenFree(() =>
      this.w.notices.show(<SimpleNotice text={this.t("game.welcomeBack", { xp: g.xp, count: g.achievements.size })} />, 10, () => this.openAchievements()),
    );
  }

  // ---------- Texts ----------

  levelTitle(level: number): string {
    return this.t(Levels.titleKey(level));
  }

  levelTooltip(xp: number, next: number | null): string {
    return next !== null ? this.t("game.levelTooltip", { xp, left: next - xp, next: Levels.levelOf(next) }) : this.t("game.levelTooltipMax", { xp });
  }

  streakTooltip(days: number, today: boolean, best: number): string {
    const text = this.t("game.streakTooltip", { days, best: Math.max(best, days) });
    return today ? text : text + "\n" + this.t("game.streakWaiting");
  }

  profileTexts(): ProfileTexts {
    return {
      levelTooltip: (xp, next) => this.levelTooltip(xp, next),
      streakTooltip: (days, today, best) => this.streakTooltip(days, today, best),
      hiddenTitle: this.t("game.hiddenTitle"),
      hiddenDescription: this.t("game.hiddenDesc"),
      unlockedOn: (date) => this.t("game.unlockedOn", { date }),
      hiddenSection: (title, found, total) => this.t("game.hiddenSection", { title, found, total }),
    };
  }

  levelModelFor(xp: number): LevelModel {
    const { level, start, next } = Levels.progress(xp);
    return new LevelModel(level, this.levelTitle(level), xp, start, next, this.levelTooltip(xp, next));
  }

  /** What the top bar's game widget shows. */
  barModels(): { level: LevelModel; streak: StreakModel } {
    const g = this.w.state.game;
    const { shown, today } = this.w.streakToday();
    return { level: this.levelModelFor(g.xp), streak: { days: shown, today, tooltip: this.streakTooltip(shown, today, g.bestStreak) } };
  }

  /** "🏆 3 / 40" in the sidebar. */
  achievementsShort(): string {
    return this.t("game.achievementsShort", { unlocked: this.w.state.game.achievements.size, total: this.w.tool.rules.achievements.length });
  }

  // ---------- Profile ----------

  /** The profile in some languages (all of them for the hub's file, the current one for the gallery). */
  buildProfile(langs: readonly string[]): ToolProfile {
    const w = this.w;
    const g = w.state.game;
    const progress = w.snapshot();
    const ctx = new AchievementContext(w.tool.rules.course, g, progress, null, [], w.now());
    const all = (key: string, args?: Readonly<Record<string, unknown>>) => new Map(langs.map((l) => [l, w.tool.translate(l, key, args)] as const));
    const { level, start, next } = Levels.progress(g.xp);
    const profile = new ToolProfile();
    profile.xp = g.xp;
    profile.level = level;
    profile.maxLevel = Levels.max;
    profile.levelStart = start;
    profile.nextLevelAt = next;
    profile.levelTitle = all(Levels.titleKey(level));
    profile.streak = g.streak;
    profile.bestStreak = g.bestStreak;
    profile.lastActiveDay = g.lastActiveDay;
    profile.categories = AchievementCategories.map((c) => {
      const cat = new ProfileCategory();
      cat.id = c.toLowerCase();
      cat.title = all(`ach.cat.${c.toLowerCase()}`);
      cat.hidden = c === "Hidden";
      return cat;
    });
    for (const a of w.tool.rules.achievements) {
      const at = g.achievements.get(a.id);
      const unlocked = at !== undefined;
      let current = 0;
      let target = 0;
      if (a.counter !== null) {
        try {
          ({ current, target } = a.counter(ctx));
        } catch {
          // A counter that fails shows no progress.
        }
      }
      const secret = a.hidden && !unlocked;
      const p = new ProfileAchievement();
      p.id = a.id;
      p.icon = secret ? "" : a.icon;
      p.category = a.category.toLowerCase();
      p.hidden = a.hidden;
      p.unlockedAt = unlocked ? at : null;
      p.current = unlocked ? target : current;
      p.target = target;
      // Hidden achievements that have not been found keep their secret, also in the file.
      p.title = secret ? new Map() : all(a.titleKey);
      p.description = secret ? new Map() : all(a.descKey);
      profile.achievements.push(p);
    }
    return profile;
  }

  /** Writes profile.json for the hub. */
  writeProfile(): void {
    if (this.w.smokeTest) return;
    this.buildProfile(Languages.offered.map((l) => l.code)).save(this.w.storage);
  }

  // ---------- Views ----------

  openAchievements(): void {
    const w = this.w;
    const profile = this.buildProfile([w.lang]);
    const texts = this.profileTexts();
    const g = w.state.game;
    const days = w.streakToday().shown;
    const gallery: GalleryTexts = {
      title: this.t("game.achievements"),
      countText: this.t("game.achievementsCount", { unlocked: profile.unlocked, total: profile.achievements.length }),
      streakText: days > 0 ? this.t("game.streakLine", { days, best: Math.max(g.bestStreak, days) }) : this.t("game.streakNone"),
      close: this.t("dialog.close"),
    };
    const close = () => w.overlay.closeDialog();
    w.overlay.showDialog(
      <AchievementGalleryView texts={gallery} level={ProfileModels.level(profile, w.lang, texts)} sections={ProfileModels.sections(profile, w.lang, texts)} onClose={close} />,
      close,
      800,
      false,
    );
  }

  private cardFor(id: string): AchievementCard {
    const a = this.w.tool.rules.find(id)!;
    return { icon: a.icon, title: this.t(a.titleKey), description: this.t(a.descKey), unlocked: true, hidden: a.hidden, current: 0, target: 0, unlockedText: null, progressText: null };
  }

  /** Shows what changed: the top bar, "+XP", notices, and the celebration when something big was done. */
  present(ev: GameEvents): void {
    const w = this.w;
    if (ev.changed) w.saveState();
    const notable = ev.xpGained !== 0 || ev.achievements.length > 0 || ev.streakExtendedTo !== null || ev.celebrate;
    if (notable) this.writeProfile();
    w.render();
    if (w.smokeTest) return;
    if (ev.xpGained > 0) w.gameBar?.showGain(this.t("game.xpGain", { xp: ev.xpGained }));

    const open = () => this.openAchievements();
    if (ev.celebrate) {
      const { model, next } = this.celebration(ev);
      w.overlay.showWhenFree(() => {
        const close = () => w.overlay.closeDialog();
        const onNext =
          next === null
            ? null
            : () => {
                w.overlay.closeDialog();
                w.navigate(next);
              };
        w.overlay.showDialog(<CelebrationView model={model} onClose={close} onNext={onNext} />, close, model.big ? 560 : 540, false);
      });
    } else {
      for (const id of ev.achievements) {
        const a = w.tool.rules.find(id)!;
        w.notices.show(
          <AchievementToast eyebrow={this.t(a.hidden ? "game.secretFound" : "game.newAchievement")} icon={a.icon} title={this.t(a.titleKey)} description={this.t(a.descKey)} />,
          6,
          open,
        );
      }
      if (ev.levelUp) w.notices.show(this.levelToast(ev.levelAfter, ev.xpAfter), 6, open);
    }
    if (ev.streakExtendedTo !== null && ev.streakExtendedTo >= 2) w.notices.show(<SimpleNotice text={this.t("game.streakToast", { days: ev.streakExtendedTo })} />, 4);
  }

  private levelToast(level: number, xp: number): ReactNode {
    const { next } = Levels.progress(xp);
    const desc = next !== null ? this.t("game.levelUpDesc", { xp, left: next - xp }) : this.t("game.levelUpDescMax");
    return <AchievementToast eyebrow={this.t("game.levelUp")} icon={String(level)} title={this.t("game.levelUpTitle", { level, title: this.levelTitle(level) })} description={desc} level />;
  }

  /** "About 14 minutes" from active seconds, or null when too short to mention. */
  timeText(seconds: number): string | null {
    if (seconds < 90) return null; // never "about 1 minutes"
    // Math.Round rounds halves to even.
    const minutes = roundHalfEven(seconds / 60);
    return minutes >= 120 ? this.t("celebrate.hours", { hours: roundHalfEven(minutes / 60) }) : this.t("celebrate.minutes", { minutes });
  }

  /** The celebration for the biggest thing that was just done, and where "Next" goes. */
  celebration(ev: GameEvents): { model: CelebrationModel; next: string | null } {
    const w = this.w;
    const chapters = w.chapters;
    const secondsOf = (id: string) => w.state.game.stats.chapterSeconds.get(id) ?? 0;
    const after = (pred: (c: CourseChapter) => boolean): CourseChapter | undefined => {
      const i = chapters.findIndex(pred);
      return i < 0 ? undefined : chapters[i + 1];
    };
    let icon: string;
    let title: string;
    let subtitle: string | null;
    let nextText: string | null;
    let big: boolean;
    let commands: readonly string[] = [];
    let seconds = 0;
    let next: CourseChapter | undefined;
    if (ev.examPassed !== null) {
      const examPart = ev.examPassed;
      big = true;
      icon = "🎓";
      const percent = w.state.exams.get(examPart) ?? 0;
      title = this.t("celebrate.exam.title", { percent });
      subtitle = this.t("celebrate.exam.subtitle", { part: this.t(`part.${examPart}`) });
      next = after((c) => c.part === examPart && c.kind === ChapterKinds.Exam);
      nextText =
        next === undefined
          ? null
          : next.isProject
            ? this.t("celebrate.toProject")
            : this.t("celebrate.nextPart", { title: this.t(`part.${next.part}`) });
    } else if (ev.projectsCompleted.length > 0) {
      const part = ev.projectsCompleted[ev.projectsCompleted.length - 1]!;
      const project = chapters.find((c) => c.part === part && c.isProject);
      big = true;
      icon = "🛠️";
      title = this.t("celebrate.project.title");
      subtitle = project !== undefined ? w.tool.chapterTitle(project.id, w.lang) : this.t(`part.${part}`);
      commands = project !== undefined ? w.tool.chapterCommands(project.id).slice(0, 16) : [];
      seconds = project !== undefined ? secondsOf(project.id) : 0;
      next = project !== undefined ? after((c) => c.id === project.id) : undefined;
      nextText = next === undefined ? null : this.t("celebrate.nextPart", { title: this.t(`part.${next.part}`) });
    } else if (ev.partsCompleted.length > 0) {
      const part = ev.partsCompleted[ev.partsCompleted.length - 1]!;
      const lessons = w.lessonsIn(part);
      big = true;
      icon = w.tool.rules.find(`part-${part}`)?.icon ?? "🏅";
      title = this.t("celebrate.part.title", { part: this.t(`part.${part}`) });
      const exam = chapters.find((c) => c.part === part && c.kind === ChapterKinds.Exam);
      subtitle = this.t(exam === undefined ? "celebrate.part.subtitleNoExam" : "celebrate.part.subtitle", { count: lessons.length });
      commands = distinct(lessons.flatMap((l) => w.tool.chapterCommands(l.id))).slice(0, 16);
      seconds = lessons.reduce((sum, l) => sum + secondsOf(l.id), 0);
      const last = lessons[lessons.length - 1];
      next = exam ?? (last ? after((c) => c.id === last.id) : undefined);
      nextText =
        next === undefined ? null : exam !== undefined ? this.t("celebrate.toExam") : this.t("celebrate.next", { title: w.tool.chapterTitle(next.id, w.lang) });
    } else {
      // The chapter on screen if it was one of them, else the last one.
      const id = ev.chaptersCompleted.includes(w.chapter.id) ? w.chapter.id : ev.chaptersCompleted[ev.chaptersCompleted.length - 1]!;
      const chapter = chapters.find((c) => c.id === id)!;
      big = false;
      icon = "✓";
      title = this.t("celebrate.chapter.title");
      subtitle = w.tool.chapterTitle(chapter.id, w.lang);
      commands = w.tool.chapterCommands(chapter.id).slice(0, 12);
      seconds = secondsOf(chapter.id);
      next = after((c) => c.id === chapter.id);
      nextText = next === undefined ? null : this.t("celebrate.next", { title: w.tool.chapterTitle(next.id, w.lang) });
    }
    const model: CelebrationModel = {
      icon,
      title,
      subtitle,
      big,
      commandsHeading: commands.length > 0 ? this.t(big ? "celebrate.commandsPart" : "celebrate.commands") : null,
      commands,
      timeText: this.timeText(seconds),
      xpText: this.t("game.xpGain", { xp: ev.xpGained }),
      levelBefore: this.levelModelFor(ev.xpBefore),
      level: this.levelModelFor(ev.xpAfter),
      levelUpText: ev.levelUp ? this.t("game.levelUpTitle", { level: ev.levelAfter, title: this.levelTitle(ev.levelAfter) }) : null,
      achievementsHeading: ev.achievements.length > 0 ? this.t("celebrate.achievements") : null,
      achievements: ev.achievements.map((id) => this.cardFor(id)),
      closeText: this.t("celebrate.close"),
      nextText,
    };
    return { model, next: next?.id ?? null };
  }
}

/** C#'s Math.Round: halves go to the even number. */
function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}
