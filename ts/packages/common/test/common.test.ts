import { describe, expect, it } from "vitest";
import { Languages, fill, placeholders, toSavedJson, translate } from "../src/index.js";

describe("Languages (build/languages.json)", () => {
  it("offers English first, and Swedish", () => {
    expect(Languages.default).toBe("en");
    expect(Languages.isOffered("sv")).toBe(true);
    expect(Languages.offered.every((l) => l.offered)).toBe(true);
  });

  it("falls back to English, then Swedish", () => {
    expect(Languages.fallbackChain("de")).toEqual(["de", "en", "sv"]);
    expect(Languages.fallbackChain("en")).toEqual(["en", "sv"]);
  });
});

describe("translate", () => {
  const texts: Record<string, Record<string, string>> = {
    en: { hello: "Hello {name}", only: "English only" },
    sv: { hello: "Hej {name}" },
  };
  const lookup = (lang: string) => texts[lang];

  it("takes the first language that has the key and fills its placeholders", () => {
    expect(translate(lookup, ["sv", "en"], "hello", { name: "Jesper" })).toBe("Hej Jesper");
    expect(translate(lookup, ["sv", "en"], "only")).toBe("English only");
  });

  it("returns the key when no language has it, and leaves unknown placeholders", () => {
    expect(translate(lookup, ["sv"], "missing")).toBe("missing");
    expect(fill("{a} and {b}", { a: 1 })).toBe("1 and {b}");
    expect(placeholders("{a} {b_2}")).toEqual(["a", "b_2"]);
  });
});

describe("saved JSON", () => {
  it("leaves out nulls, like the C# apps", () => {
    expect(toSavedJson({ lang: "sv", theme: null, progress: { "a/b@x": true } })).toBe('{"lang":"sv","progress":{"a/b@x":true}}');
  });
});
