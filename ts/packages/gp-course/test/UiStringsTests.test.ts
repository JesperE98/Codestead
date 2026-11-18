// UiStringsTests.cs: every offered language has every key with the same placeholders, and every achievement and level
// has its texts; the simulator's notes have texts.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Languages } from "@codestead/common";
import { Levels } from "@codestead/learning";
import { describe, expect, it } from "vitest";
import { GpAchievements, GpCourse, UiStrings } from "../src/index.js";
import { Repo } from "./Repo.js";

const load = (lang: string): Record<string, string> =>
  JSON.parse(readFileSync(join(Repo.root, "src", "GP", "Codestead.GP.Course", "i18n", "ui", lang + ".json"), "utf8")) as Record<string, string>;

/** The {names} of a text, sorted (ordinal). */
const placeholders = (s: string): string => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort().join(",");

function filesUnder(dir: string): string[] {
  const list: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) list.push(...filesUnder(path));
    else list.push(path);
  }
  return list;
}

describe("UiStringsTests", () => {
  it("alla erbjudna språk har alla texter med samma platshållare", () => {
    const en = load("en");
    for (const lang of Languages.offered.map((l) => l.code).filter((l) => l !== "en")) {
      const d = load(lang);
      const missing = Object.keys(en).filter((k) => !Object.hasOwn(d, k));
      expect(missing.length === 0, `${lang}: missing ${missing.join(", ")}`).toBe(true);
      for (const [k, v] of Object.entries(en)) expect(placeholders(v) === placeholders(d[k]!), `${lang}: ${k} has other placeholders`).toBe(true);
    }
  });

  it("varje utmärkelse, nivå och del har sina texter", () => {
    const en = load("en");
    for (const a of GpAchievements.all) {
      expect(Object.hasOwn(en, a.titleKey), a.titleKey).toBe(true);
      expect(Object.hasOwn(en, a.descKey), a.descKey).toBe(true);
    }
    for (let i = 1; i <= Levels.max; i++) expect(Object.hasOwn(en, `level.${i}`)).toBe(true);
    for (const part of GpCourse.parts) expect(Object.hasOwn(en, `part.${part}`), `part.${part}`).toBe(true);
  });

  it("simulatorns meddelanden har texter", () => {
    const en = load("en");
    // The C# simulator's sources, as in C#, and the port's (@codestead/gp-gpu: SimNote.info / warning / error).
    const cs = join(Repo.root, "src", "GP", "Codestead.GP.Gpu");
    const ts = join(Repo.root, "ts", "packages", "gp-gpu", "src");
    const keysIn = (dir: string, ext: string, re: RegExp): string[] =>
      filesUnder(dir)
        .filter((f) => f.endsWith(ext))
        .flatMap((f) => [...readFileSync(f, "utf8").matchAll(re)].map((m) => m[1]!));
    const csKeys = keysIn(cs, ".cs", /SimNote\.(?:Info|Warning|Error)\("(\w+)"/g);
    const tsKeys = keysIn(ts, ".ts", /SimNote\.(?:info|warning|error)\("(\w+)"/g);
    expect(csKeys.length).toBeGreaterThan(0);
    expect(tsKeys.length).toBeGreaterThan(0);
    const keys = new Set([...csKeys, ...tsKeys]);
    for (const k of keys) expect(Object.hasOwn(en, "sim." + k), "sim." + k).toBe(true);
  });

  it("UiStrings läser texterna och faller tillbaka på engelska", () => {
    // Not in C#'s UiStringsTests: the loader the app uses reads the same files.
    const key = Object.keys(load("en"))[0]!;
    expect(UiStrings.translate("en", key)).toBe(load("en")[key]);
    expect(UiStrings.translate("xx", key)).toBe(load("en")[key]);
    expect(UiStrings.translate("sv", "no.such.key")).toBe("no.such.key");
  });
});
