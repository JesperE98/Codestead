import { LanguagesLib } from "@codestead/linux-content";
import { describe, expect, it } from "vitest";
import { HubStrings } from "../src/HubStrings.js";

// HubStringsTests.cs

const placeholder = /\{([A-Za-z0-9_]+)\}/g;
const placeholders = (text: string) => [...text.matchAll(placeholder)].map((m) => m[0]).sort();

describe("HubStringsTests", () => {
  it("hubben har samma språk som Codestead Linux", () => {
    const tool = LanguagesLib.languages.map((l) => `${l.code}:${l.dir === "rtl"}`).sort();
    expect(HubStrings.languages.map((l) => `${l.code}:${l.rightToLeft}`).sort()).toEqual(tool);
  });

  it("alla hubbtexter finns på alla språk med samma platshållare", () => {
    const en = HubStrings.for("en");
    expect(Object.keys(en).length).toBeGreaterThan(0);
    for (const lang of HubStrings.languages) {
      const texts = HubStrings.for(lang.code);
      expect(Object.keys(texts).sort(), lang.code).toEqual(Object.keys(en).sort());
      for (const [key, text] of Object.entries(texts)) {
        expect(text.trim(), `${lang.code}/${key} is empty`).not.toBe("");
        expect(placeholders(text), `${lang.code}/${key}`).toEqual(placeholders(en[key]!));
        // Leftover Swedish: å never occurs in the other languages, ä/ö only in German.
        const swedish = lang.code === "de" ? /[åÅ]/ : /[åäöÅÄÖ]/;
        if (lang.code !== "sv") expect(swedish.test(text), `${lang.code}/${key} contains Swedish letters: ${text}`).toBe(false);
      }
    }
  });

  it("platshållare fylls i och okända nycklar faller tillbaka", () => {
    expect(HubStrings.t("en", "tool.update", { version: "1.2.3" })).toBe("Update to 1.2.3");
    expect(HubStrings.t("sv", "tool.update", { version: "1.2.3" })).toBe("Uppdatera till 1.2.3");
    expect(HubStrings.t("de", "no.such.key")).toBe("no.such.key");
  });
});
