import { DateOnly, parseStamp } from "@codestead/learning";
import { type AchievementCard, type AchievementSection, LevelModel, type StreakModel } from "../Models.js";
import type { ProfileTexts } from "./ProfileTexts.js";
import { type ProfileAchievement, ToolProfile } from "./ToolProfile.js";

// Turns a saved profile into what the gamification views show.

/** Turns a {@link ToolProfile} into what the views show. */
export const ProfileModels = {
  level(p: ToolProfile, lang: string, t: ProfileTexts): LevelModel {
    return new LevelModel(p.level, ToolProfile.pick(p.levelTitle, lang), p.xp, p.levelStart, p.nextLevelAt, t.levelTooltip(p.xp, p.nextLevelAt));
  },

  streak(p: ToolProfile, today: DateOnly, t: ProfileTexts): StreakModel {
    const { days, today: isToday } = p.streakOn(today);
    return { days, today: isToday, tooltip: t.streakTooltip(days, isToday, p.bestStreak) };
  },

  /**
   * A date for people: "3 Nov 2026" in the language's way (Gregorian calendar and Latin digits everywhere) – .NET's
   * "d MMM yyyy" with the language's month names.
   */
  formatDate(stamp: string, lang: string): string {
    const d = parseStamp(stamp);
    if (d === null) return stamp;
    try {
      const parts = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric", calendar: "gregory", numberingSystem: "latn" }).formatToParts(d);
      const month = parts.find((p) => p.type === "month")?.value;
      if (!month) throw new RangeError("no month");
      return `${d.getDate()} ${month} ${d.getFullYear()}`;
    } catch {
      return DateOnly.fromDate(d).toString();
    }
  },

  card(a: ProfileAchievement, lang: string, t: ProfileTexts): AchievementCard {
    const unlocked = a.unlockedAt !== null;
    const secret = a.hidden && !unlocked;
    return {
      icon: a.icon,
      title: secret ? t.hiddenTitle : ToolProfile.pick(a.title, lang),
      description: secret ? t.hiddenDescription : ToolProfile.pick(a.description, lang),
      unlocked,
      hidden: a.hidden,
      current: a.current,
      target: secret ? 0 : a.target,
      unlockedText: unlocked ? t.unlockedOn(ProfileModels.formatDate(a.unlockedAt!, lang)) : null,
      progressText: !unlocked && a.target > 0 ? `${a.current} / ${a.target}` : null,
    };
  },

  sections(p: ToolProfile, lang: string, t: ProfileTexts): AchievementSection[] {
    const sections: AchievementSection[] = [];
    for (const cat of p.categories) {
      let items = p.achievements.filter((a) => a.category === cat.id);
      if (items.length === 0) continue;
      // Unlocked first in a hidden group, so the found ones are not lost among the "???" (a stable sort, like OrderBy).
      if (cat.hidden) items = [...items].sort((a, b) => Number(a.unlockedAt === null) - Number(b.unlockedAt === null));
      let title = ToolProfile.pick(cat.title, lang);
      if (cat.hidden)
        title = t.hiddenSection(
          title,
          items.filter((a) => a.unlockedAt !== null).length,
          items.length,
        );
      sections.push({ title, cards: items.map((a) => ProfileModels.card(a, lang, t)) });
    }
    return sections;
  },
};
