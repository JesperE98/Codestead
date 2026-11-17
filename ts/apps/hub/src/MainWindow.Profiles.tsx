import { DateOnly } from "@codestead/learning";
import { AchievementGalleryView, FontWeight, type ProfileModel, ProfileModels, type ProfileTexts, type ToolProfile, UiParts } from "@codestead/ui";
import type { ReactNode } from "react";
import type { MainWindow } from "./MainWindow.js";

// MainWindow.Profiles.cs: each tool's level, streak and achievements (profile.json), and the total of all tools.

/** The profiles of the installed tools. */
export function profilesShown(w: MainWindow): ToolProfile[] {
  return w.installedTools.map((t) => w.profiles.get(t.id) ?? null).filter((p): p is ToolProfile => p !== null);
}

export function profileTexts(w: MainWindow): ProfileTexts {
  return {
    levelTooltip: (xp, next) => (next !== null ? w.t("profile.levelTooltip", { xp, left: next - xp }) : w.t("profile.levelTooltipMax", { xp })),
    streakTooltip: (days, today, best) => w.t("profile.streakTooltip", { days, best: Math.max(best, days) }) + (today ? "" : "\n" + w.t("profile.streakWaiting")),
    hiddenTitle: w.t("profile.hiddenTitle"),
    hiddenDescription: w.t("profile.hiddenDesc"),
    unlockedOn: (date) => w.t("profile.unlockedOn", { date }),
    hiddenSection: (title, found, total) => w.t("profile.hiddenSection", { title, found, total }),
  };
}

const today = () => DateOnly.fromDate(new Date());

export function profileModelFor(w: MainWindow, p: ToolProfile): ProfileModel {
  const texts = profileTexts(w);
  return {
    level: ProfileModels.level(p, w.lang, texts),
    streak: ProfileModels.streak(p, today(), texts),
    unlocked: p.unlocked,
    total: p.achievements.length,
    achievementsText: `${p.unlocked}/${p.achievements.length}`,
    openText: w.t("profile.achievements"),
  };
}

/** All tools together: XP, achievements and the longest current streak. */
export function TotalRow({ w, profiles }: { w: MainWindow; profiles: readonly ToolProfile[] }): ReactNode {
  const sum = (f: (p: ToolProfile) => number) => profiles.reduce((a, p) => a + f(p), 0);
  const xp = sum((p) => p.xp);
  const unlocked = sum((p) => p.unlocked);
  const total = sum((p) => p.achievements.length);
  const streak = Math.max(...profiles.map((p) => p.streakOn(today()).days));
  let text = w.t("profile.total", { xp, unlocked, total });
  if (streak > 0) text += " · " + w.t("profile.totalStreak", { days: streak });
  return <div className="hub-total">{UiParts.text(text, 14, FontWeight.SemiBold)}</div>;
}

export function openAchievements(w: MainWindow, name: string, p: ToolProfile): void {
  const texts = profileTexts(w);
  const { days } = p.streakOn(today());
  const gallery = {
    title: w.t("profile.galleryTitle", { name }),
    countText: w.t("profile.count", { unlocked: p.unlocked, total: p.achievements.length }),
    streakText: days > 0 ? w.t("profile.streakLine", { days, best: Math.max(p.bestStreak, days) }) : w.t("profile.streakNone"),
    close: w.t("dialog.close"),
  };
  const close = () => w.overlay.closeDialog();
  w.overlay.showDialog(
    <AchievementGalleryView texts={gallery} level={ProfileModels.level(p, w.lang, texts)} sections={ProfileModels.sections(p, w.lang, texts)} onClose={close} />,
    close,
    800,
    false,
  );
}
