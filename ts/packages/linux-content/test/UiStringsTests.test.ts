// Port of tests/Linux/Codestead.Content.Tests/UiStringsTests.cs (src/i18n/ui.test.ts).

import { describe, expect, it } from "vitest";
import { LanguagesLib, UiStrings } from "../src/index.js";

const placeholderRe = /\{[A-Za-z0-9_]+\}/g;

function placeholders(s: string): string {
  return [...s.matchAll(placeholderRe)]
    .map((m) => m[0])
    .sort()
    .join(",");
}

describe("UiStringsTests", () => {
  it.each(LanguagesLib.languages.map((l) => l.code))("har alla nycklar och samma platshållare: %s", (code) => {
    const sv = UiStrings.ui().get("sv")!;
    for (const key of UiStrings.keys()) {
      const text = UiStrings.ui().get(code)!.get(key) ?? (key === "progress.short" ? sv.get(key) : undefined);
      expect(!!text, `${code}: ${key}`).toBe(true);
      expect(placeholders(text!) === placeholders(sv.get(key)!), `${code}: ${key}: ${placeholders(text!)} != ${placeholders(sv.get(key)!)}`).toBe(true);
    }
  });

  it("platshållare fylls i och saknade nycklar faller tillbaka", () => {
    expect(UiStrings.translate("en", "lesson.chapter", { n: 3, total: 21 })).toBe("Chapter 3 of 21");
    expect(UiStrings.translate("ja", "progress.short", { done: 1, total: 2 })).toBe("1/2");
  });

  // Not in the TypeScript: the owner's requirement that the app starts in English when nothing is saved.
  it("standardspråket är engelska och reservordningen är språk → en → sv", () => {
    expect(LanguagesLib.detectLang()).toBe("en");
    expect(LanguagesLib.fallbackChain("de")).toEqual(["de", "en", "sv"]);
    expect(LanguagesLib.fallbackChain("en")).toEqual(["en", "sv"]);
    expect(LanguagesLib.fallbackChain("sv")).toEqual(["sv", "en"]);
  });
});
