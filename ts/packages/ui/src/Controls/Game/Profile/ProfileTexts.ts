// The texts the views need around a profile.

/** The texts the views need around a profile, in the viewer's language. */
export interface ProfileTexts {
  /** (xp, next level's XP or null) → e.g. "520 XP · 180 to level 5". */
  levelTooltip(xp: number, next: number | null): string;
  /** (days, today counts, best) → e.g. "5 days in a row (best: 9)". */
  streakTooltip(days: number, today: boolean, best: number): string;
  /** The title of an unfound hidden achievement ("???"). */
  hiddenTitle: string;
  /** Its description ("Found by exploring the terminal."). */
  hiddenDescription: string;
  /** A date (already formatted) → "Unlocked 3 Nov 2026". */
  unlockedOn(date: string): string;
  /** (section title, found, total) → "Hidden · 2 of 10 found". */
  hiddenSection(title: string, found: number, total: number): string;
}
