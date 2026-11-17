import { DateOnly, isObject, readBool, readInt, readIntOrNull, readMap, readString } from "@codestead/learning";
import { loadJson, saveJson, type Storage } from "../../../Storage.js";

const readTexts = (v: unknown) => readMap(v, readString);

/** One achievement in a saved profile. */
export class ProfileAchievement {
  id = "";
  icon = "";
  category = "";
  hidden = false;
  /** When it was unlocked ("yyyy-MM-ddTHH:mm", local time), or null. */
  unlockedAt: string | null = null;
  current = 0;
  target = 0;
  /** Empty for a hidden achievement that has not been found. */
  title = new Map<string, string>();
  description = new Map<string, string>();

  constructor(init?: Partial<Omit<ProfileAchievement, "title" | "description" | "toJSON">> & { title?: Record<string, string>; description?: Record<string, string> }) {
    if (!init) return;
    const { title, description, ...rest } = init;
    Object.assign(this, rest);
    this.title = new Map(Object.entries(title ?? {}));
    this.description = new Map(Object.entries(description ?? {}));
  }

  static fromJson(v: unknown): ProfileAchievement | null {
    if (!isObject(v)) return null;
    const a = new ProfileAchievement();
    a.id = readString(v.id) ?? "";
    a.icon = readString(v.icon) ?? "";
    a.category = readString(v.category) ?? "";
    a.hidden = readBool(v.hidden);
    a.unlockedAt = readString(v.unlockedAt);
    a.current = readInt(v.current);
    a.target = readInt(v.target);
    a.title = readTexts(v.title);
    a.description = readTexts(v.description);
    return a;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      icon: this.icon,
      category: this.category,
      hidden: this.hidden,
      unlockedAt: this.unlockedAt,
      current: this.current,
      target: this.target,
      title: Object.fromEntries(this.title),
      description: Object.fromEntries(this.description),
    };
  }
}

/** A category of achievements in a saved profile. */
export class ProfileCategory {
  id = "";
  title = new Map<string, string>();
  /** A group of hidden achievements (shown as "x of y found"). */
  hidden = false;

  constructor(init?: { id?: string; title?: Record<string, string>; hidden?: boolean }) {
    if (!init) return;
    this.id = init.id ?? "";
    this.title = new Map(Object.entries(init.title ?? {}));
    this.hidden = init.hidden ?? false;
  }

  static fromJson(v: unknown): ProfileCategory | null {
    if (!isObject(v)) return null;
    const c = new ProfileCategory();
    c.id = readString(v.id) ?? "";
    c.title = readTexts(v.title);
    c.hidden = readBool(v.hidden);
    return c;
  }

  toJSON(): Record<string, unknown> {
    return { id: this.id, title: Object.fromEntries(this.title), hidden: this.hidden };
  }
}

/** The streak as it is shown on a day. */
export interface StreakOn {
  days: number;
  today: boolean;
}

/**
 * A tool's level, streak and achievements, saved as `profile.json` in the tool's data folder so that the
 * hub can show them. The format does not depend on the tool: every text is stored in every language, so the
 * hub needs nothing from the tool to show it. A tool rewrites the file when its progress changes.
 */
export class ToolProfile {
  static readonly CurrentSchema = 1;
  static readonly FileName = "profile";

  schema = ToolProfile.CurrentSchema;
  xp = 0;
  level = 1;
  maxLevel = 1;
  /** The XP where the current level starts. */
  levelStart = 0;
  /** The XP where the next level starts, or null at the top level. */
  nextLevelAt: number | null = null;
  /** The title of the current level: language → text. */
  levelTitle = new Map<string, string>();
  streak = 0;
  bestStreak = 0;
  /** The last day with progress ("yyyy-MM-dd", local time). */
  lastActiveDay: string | null = null;
  /** The groups of the gallery, in order. */
  categories: ProfileCategory[] = [];
  achievements: ProfileAchievement[] = [];

  get unlocked(): number {
    return this.achievements.filter((a) => a.unlockedAt !== null).length;
  }

  /** The streak as it should be shown on `today` (0 once a day was missed). */
  streakOn(today: DateOnly): StreakOn {
    const last = DateOnly.tryParseExact(this.lastActiveDay);
    if (last === null) return { days: 0, today: false };
    if (last.compareTo(today) >= 0) return { days: this.streak, today: true };
    return last.equals(today.addDays(-1)) ? { days: this.streak, today: false } : { days: 0, today: false };
  }

  /** A text in a language, else English, else any. */
  static pick(texts: ReadonlyMap<string, string> | null | undefined, lang: string): string {
    if (!texts || texts.size === 0) return "";
    const t = texts.get(lang);
    if (t) return t;
    const en = texts.get("en");
    if (en) return en;
    for (const v of texts.values()) if (v.length > 0) return v;
    return "";
  }

  /** Reads profile.json's parsed JSON; null when it is not a profile this version knows. */
  static fromJson(v: unknown): ToolProfile | null {
    if (!isObject(v)) return null;
    const p = new ToolProfile();
    // A file without "schema" is schema 1 (the C# default).
    p.schema = v.schema === undefined ? ToolProfile.CurrentSchema : readInt(v.schema, 0);
    if (p.schema < 1 || p.schema > ToolProfile.CurrentSchema) return null;
    p.xp = readInt(v.xp);
    p.level = readInt(v.level, 1);
    p.maxLevel = readInt(v.maxLevel, 1);
    p.levelStart = readInt(v.levelStart);
    p.nextLevelAt = readIntOrNull(v.nextLevelAt);
    p.levelTitle = readTexts(v.levelTitle);
    p.streak = readInt(v.streak);
    p.bestStreak = readInt(v.bestStreak);
    p.lastActiveDay = readString(v.lastActiveDay);
    p.categories = Array.isArray(v.categories) ? v.categories.map(ProfileCategory.fromJson).filter((c): c is ProfileCategory => c !== null) : [];
    p.achievements = Array.isArray(v.achievements)
      ? v.achievements.map(ProfileAchievement.fromJson).filter((a): a is ProfileAchievement => a !== null && a.id !== "")
      : [];
    return p;
  }

  /** Reads a tool's profile; null when there is none or it cannot be read. */
  static load(storage: Storage): ToolProfile | null {
    return ToolProfile.fromJson(loadJson(storage, ToolProfile.FileName));
  }

  save(storage: Storage): void {
    saveJson(storage, ToolProfile.FileName, this);
  }

  /** The saved form, as the C# app writes it (also its read-only "unlocked"). */
  toJSON(): Record<string, unknown> {
    return {
      schema: this.schema,
      xp: this.xp,
      level: this.level,
      maxLevel: this.maxLevel,
      levelStart: this.levelStart,
      nextLevelAt: this.nextLevelAt,
      levelTitle: Object.fromEntries(this.levelTitle),
      streak: this.streak,
      bestStreak: this.bestStreak,
      lastActiveDay: this.lastActiveDay,
      categories: this.categories,
      achievements: this.achievements,
      unlocked: this.unlocked,
    };
  }
}
