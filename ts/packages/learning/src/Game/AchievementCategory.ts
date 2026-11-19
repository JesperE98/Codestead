// The categories the achievements are grouped in.

/** The categories (C#'s enum AchievementCategory; the values are its names, so ToString() is the value). */
export const AchievementCategory = {
  Learning: "Learning",
  Exams: "Exams",
  Terminal: "Terminal",
  Habits: "Habits",
  Hidden: "Hidden",
} as const;

export type AchievementCategory = (typeof AchievementCategory)[keyof typeof AchievementCategory];

/** The categories in the enum's order. */
export const AchievementCategories: readonly AchievementCategory[] = Object.values(AchievementCategory);
