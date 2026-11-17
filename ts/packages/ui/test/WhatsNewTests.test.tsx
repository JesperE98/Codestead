// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Languages } from "@codestead/common";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Changelog, ChangelogEntry, MemoryStorage, WhatsNewView } from "../src/index.js";
import { repoRoot } from "./repo.js";

afterEach(cleanup);

const log = (...versions: string[]) => versions.map((v) => new ChangelogEntry({ version: v, date: "2026-11-03", changes: { en: [`In ${v}`], sv: [`I ${v}`] } }));

describe("WhatsNewTests", () => {
  it("versionerna mellan den senast visade och den nuvarande, nyast först", () => {
    const parsed = Changelog.parse(JSON.stringify(log("0.5.2", "0.5.10", "0.5.3", "0.6.0")));
    expect(parsed.map((e) => e.version)).toEqual(["0.6.0", "0.5.10", "0.5.3", "0.5.2"]);
    expect(Changelog.between(parsed, "0.5.2", "0.5.10").map((e) => e.version)).toEqual(["0.5.10", "0.5.3"]);
    expect(Changelog.between(parsed, "0.6.0", "0.6.0")).toEqual([]);
    expect(parsed[2]!.changesFor("sv")[0]).toBe("I 0.5.3");
    expect(parsed[2]!.changesFor("ja")[0]).toBe("In 0.5.3");
    expect(Changelog.parse("not json")).toEqual([]);
  });

  it("nyheterna visas efter en uppdatering, inte vid första installationen och bara en gång", () => {
    const entries = log("0.5.5", "0.5.4", "0.5.3");
    // A new installation: nothing, but the version is remembered.
    const fresh = new MemoryStorage();
    expect(Changelog.newsAtStart(fresh, entries, "0.5.5", false)).toEqual([]);
    expect(Changelog.seen(fresh)).toBe("0.5.5");
    expect(fresh.loadText("whatsnew")).toBe('{"seen":"0.5.5"}');
    // Updated from a version before this feature: the current version's news.
    const old = new MemoryStorage();
    expect(Changelog.newsAtStart(old, entries, "0.5.5", true).map((e) => e.version)).toEqual(["0.5.5"]);
    expect(Changelog.newsAtStart(old, entries, "0.5.5", true)).toEqual([]);
    // Updated from 0.5.3: what came after it.
    const seen = new MemoryStorage();
    Changelog.markSeen(seen, "0.5.3");
    expect(Changelog.newsAtStart(seen, entries, "0.5.5", true).map((e) => e.version)).toEqual(["0.5.5", "0.5.4"]);
    // A development build shows nothing.
    expect(Changelog.newsAtStart(new MemoryStorage(), entries, "0.0.0", true)).toEqual([]);
  });

  it("rutan visar varje version med sina ändringar och stängs med knappen", () => {
    let closed = 0;
    const { container } = render(
      <WhatsNewView texts={{ title: "Nytt i Codestead Linux", version: "Version {version} · {date}", close: "OK" }} entries={log("0.5.5", "0.5.4")} lang="sv" onClose={() => closed++} />,
    );
    expect(screen.getByText("Nytt i Codestead Linux")).toBeTruthy();
    expect(screen.getByText("Version 0.5.4 · 2026-11-03")).toBeTruthy();
    expect(container.querySelectorAll(".cs-markdown").length).toBe(2);
    expect(screen.getByText("I 0.5.5")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(closed).toBe(1);
  });

  it.each(["Linux", "Hub", "GP"])("ändringsloggarna är kompletta på alla språk: %s", (product) => {
    const json = readFileSync(join(repoRoot(), "src", product, "changelog.json"), "utf8");
    const raw = (JSON.parse(json) as unknown[]).map((e) => ChangelogEntry.fromJson(e)!);
    expect(raw.length).toBeGreaterThan(0);
    // Newest first, each version once, with a date.
    for (const e of raw) expect(Changelog.parseVersion(e.version), `${product}: bad version "${e.version}"`).not.toBeNull();
    const versions = raw.map((e) => Changelog.parseVersion(e.version)!.join("."));
    expect(Changelog.parse(json).map((e) => e.version)).toEqual(raw.map((e) => e.version));
    expect(new Set(versions).size).toBe(versions.length);
    for (const e of raw) expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const ticks = (l: string) => [...l].filter((c) => c === "`").length;
    for (const e of raw) {
      const en = e.changes.get("en") ?? [];
      expect(en.length, `${product} ${e.version}: no English changes`).toBeGreaterThan(0);
      for (const lang of Languages.offered.map((l) => l.code)) {
        const lines = e.changes.get(lang);
        expect(lines !== undefined && lines.length === en.length && lines.every((l) => l.trim() !== ""), `${product} ${e.version}: "${lang}" needs ${en.length} lines, like English`).toBe(true);
        expect(lines!.map(ticks), `${product} ${e.version}/${lang}: the \`code\` parts differ from English`).toEqual(en.map(ticks));
      }
    }
  });
});
