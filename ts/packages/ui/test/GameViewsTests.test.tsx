// @vitest-environment jsdom
import { DateOnly } from "@codestead/learning";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  AchievementGalleryView,
  AchievementToast,
  type CelebrationModel,
  CelebrationView,
  MemoryStorage,
  Motion,
  NoticeLayer,
  Notices,
  Overlay,
  OverlayHost,
  ProfileAchievement,
  ProfileCategory,
  ProfileModels,
  type ProfileTexts,
  ToolProfile,
} from "../src/index.js";

afterEach(cleanup);
beforeAll(() => {
  Motion.enabled = false;
});

const texts: ProfileTexts = {
  levelTooltip: (xp, next) => (next !== null ? `${xp} XP, ${next - xp} left` : `${xp} XP`),
  streakTooltip: (days, today, best) => `${days} days (best ${best})${today ? "" : ", waiting"}`,
  hiddenTitle: "???",
  hiddenDescription: "Keep exploring.",
  unlockedOn: (date) => `Unlocked ${date}`,
  hiddenSection: (title, found, total) => `${title} · ${found}/${total}`,
};

function profile(): ToolProfile {
  const p = new ToolProfile();
  p.xp = 520;
  p.level = 4;
  p.maxLevel = 10;
  p.levelStart = 400;
  p.nextLevelAt = 700;
  p.levelTitle = new Map([
    ["en", "Pipe fitter"],
    ["sv", "Rörmokare"],
  ]);
  p.streak = 5;
  p.bestStreak = 9;
  p.lastActiveDay = "2026-11-02";
  p.categories = [new ProfileCategory({ id: "learning", title: { en: "Learning" } }), new ProfileCategory({ id: "hidden", title: { en: "Hidden" }, hidden: true })];
  p.achievements = [
    new ProfileAchievement({ id: "first", icon: "👋", category: "learning", unlockedAt: "2026-11-01T20:15", title: { en: "First step", sv: "Första steget" }, description: { en: "Solve a task." } }),
    new ProfileAchievement({ id: "many", icon: "💯", category: "learning", current: 62, target: 100, title: { en: "100 tasks" }, description: { en: "Solve 100 tasks." } }),
    new ProfileAchievement({ id: "secret", category: "hidden", hidden: true }),
    new ProfileAchievement({ id: "found", icon: "🐄", category: "hidden", hidden: true, unlockedAt: "2026-11-02T09:00", title: { en: "Moo" }, description: { en: "cowsay" } }),
  ];
  return p;
}

const strings = (el: Element) => [...el.querySelectorAll(".cs-text, button")].map((e) => e.textContent ?? "");

describe("GameViewsTests", () => {
  it("profilen blir kort och sektioner; dolda behåller sin hemlighet", () => {
    const p = profile();
    expect(p.unlocked).toBe(2);
    const sections = ProfileModels.sections(p, "sv", texts);
    expect(sections.map((s) => s.title)).toEqual(["Learning", "Hidden · 1/2"]);
    const first = sections[0]!.cards[0]!;
    expect(first.title).toBe("Första steget");
    expect(first.description).toBe("Solve a task."); // falls back to English
    expect(first.unlockedText?.startsWith("Unlocked ")).toBe(true);
    expect(sections[0]!.cards[1]!.progressText).toBe("62 / 100");
    // Found hidden ones come first; the unfound one shows nothing of itself.
    expect(sections[1]!.cards[0]!.title).toBe("Moo");
    const secret = sections[1]!.cards[1]!;
    expect([secret.title, secret.description, secret.unlocked, secret.hidden]).toEqual(["???", "Keep exploring.", false, true]);
  });

  it("streaken visas tills en dag missas", () => {
    const p = profile();
    expect(p.streakOn(DateOnly.of(2026, 11, 3))).toEqual({ days: 5, today: false });
    expect(p.streakOn(DateOnly.of(2026, 11, 2))).toEqual({ days: 5, today: true });
    expect(p.streakOn(DateOnly.of(2026, 11, 5))).toEqual({ days: 0, today: false });
    const level = ProfileModels.level(p, "en", texts);
    expect([level.title, Math.round(level.fraction * 100) / 100]).toEqual(["Pipe fitter", 0.4]);
  });

  it("profilfilen sparas och läses, saknad eller trasig fil ger null", () => {
    const storage = new MemoryStorage();
    expect(ToolProfile.load(storage)).toBeNull();
    profile().save(storage);
    const back = ToolProfile.load(storage)!;
    expect(back.xp).toBe(520);
    expect(back.achievements.length).toBe(4);
    expect(ToolProfile.pick(back.levelTitle, "sv")).toBe("Rörmokare");
    storage.saveText(ToolProfile.FileName, "{ not json");
    expect(ToolProfile.load(storage)).toBeNull();
    storage.saveText(ToolProfile.FileName, '{"schema": 99}');
    expect(ToolProfile.load(storage)).toBeNull();
  });

  it("profilfilen har samma form som C#-appens", () => {
    // profile.json as Codestead.UI (C#) writes it (its "unlocked" too, and emoji as \u escapes).
    const fromCSharp =
      '{"schema":1,"xp":520,"level":4,"maxLevel":10,"levelStart":400,"nextLevelAt":700,"levelTitle":{"en":"Pipe fitter"},"streak":5,"bestStreak":9,"lastActiveDay":"2026-11-02","categories":[{"id":"learning","title":{"en":"Learning"},"hidden":false}],"achievements":[{"id":"first","icon":"\\uD83D\\uDC4B","category":"learning","hidden":false,"unlockedAt":"2026-11-01T20:15","current":0,"target":0,"title":{"en":"First"},"description":{}},{"id":"secret","icon":"","category":"hidden","hidden":true,"current":0,"target":0,"title":{},"description":{}}],"unlocked":1}';
    const storage = new MemoryStorage();
    storage.saveText(ToolProfile.FileName, fromCSharp);
    const p = ToolProfile.load(storage)!;
    expect(p.achievements[0]!.icon).toBe("👋");
    p.save(storage);
    expect(JSON.parse(storage.loadText(ToolProfile.FileName)!)).toEqual(JSON.parse(fromCSharp));
  });

  it("datum skrivs med gregoriansk kalender på alla språk", () => {
    for (const lang of ["en", "sv", "ar", "hi", "ja", "zh", "ru"]) expect(ProfileModels.formatDate("2026-11-03T10:00", lang)).toContain("2026");
    expect(ProfileModels.formatDate("2026-11-03T10:00", "en")).toBe("3 Nov 2026");
    expect(ProfileModels.formatDate("broken", "en")).toBe("broken");
  });

  it("galleriet, firandet och notiserna byggs utan att visa dolda titlar", () => {
    const p = profile();
    const host = new Overlay();
    const close = () => host.closeDialog();
    const gallery = render(
      <AchievementGalleryView
        texts={{ title: "Achievements", countText: "2 of 4", streakText: "🔥 5", close: "Close" }}
        level={ProfileModels.level(p, "en", texts)}
        sections={ProfileModels.sections(p, "en", texts)}
        onClose={close}
      />,
    );
    const shown = strings(gallery.container);
    expect(shown).toContain("Moo");
    expect(shown).toContain("???");
    expect(shown.some((t) => t.toLowerCase().includes("secret"))).toBe(false);
    gallery.unmount();

    let closed = false;
    let next = false;
    const level = ProfileModels.level(p, "en", texts);
    const model: CelebrationModel = {
      icon: "✓",
      title: "Chapter complete!",
      subtitle: "Reading text",
      big: false,
      commandsHeading: "Commands",
      commands: ["head", "tail"],
      timeText: "About 5 minutes",
      xpText: "+45 XP",
      levelBefore: level,
      level,
      levelUpText: null,
      achievementsHeading: "New achievements",
      achievements: [ProfileModels.card(p.achievements[0]!, "en", texts)],
      closeText: "Close",
      nextText: "Next: Pipes",
    };
    const celebration = render(<CelebrationView model={model} onClose={() => (closed = true)} onNext={() => (next = true)} />);
    for (const b of celebration.container.querySelectorAll("button")) fireEvent.click(b);
    expect(closed && next).toBe(true);
    expect(celebration.container.textContent).toContain("head");
    celebration.unmount();

    const layer = new Notices();
    layer.moreText = (n) => `+${n} more`;
    const notices = render(<NoticeLayer notices={layer} />);
    act(() => {
      for (let i = 0; i < 5; i++) layer.show(<AchievementToast eyebrow="New" icon="👋" title={`A${i}`} description="d" />, 60);
    });
    expect(notices.container.querySelectorAll(".cs-notice").length).toBe(Notices.MaxVisible + 1);
    expect(notices.container.textContent).toContain("+2 more");
  });

  it("notiserna försvinner av sig själva, och med dem \"+N till\"", () => {
    vi.useFakeTimers();
    try {
      const layer = new Notices();
      layer.moreText = (n) => `+${n} more`;
      const notices = render(<NoticeLayer notices={layer} />);
      act(() => {
        for (let i = 0; i < 4; i++) layer.show(<span>{`N${i}`}</span>, 5);
      });
      expect(notices.container.textContent).toContain("+1 more");
      act(() => void vi.advanceTimersByTime(5000 + 250));
      expect(notices.container.querySelectorAll(".cs-notice").length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("dialogkön visar nästa dialog först när den öppna stängs", async () => {
    const host = new Overlay();
    render(<OverlayHost overlay={host} />);
    const shown: string[] = [];
    act(() => {
      host.showWhenFree(() => {
        shown.push("a");
        host.showDialog(<div>a</div>, () => host.closeDialog());
      });
      host.showWhenFree(() => {
        shown.push("b");
        host.showDialog(<div>b</div>, () => host.closeDialog());
      });
    });
    expect(shown).toEqual(["a"]);
    await act(async () => {
      host.closeDialog();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(shown).toEqual(["a", "b"]);
    expect(host.dialogOpen).toBe(true);
  });
});
