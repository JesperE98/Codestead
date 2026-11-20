// The pictures of Codestead Linux's chapter texts (src/Linux/content/images, see "Bilder i Codestead Linux" in
// docs/DEVELOPMENT.md): every picture a chapter shows exists for the chapter's language (its own, the English one or a
// shared one) and is a WebP; every language shows the same pictures in the same order as English; every picture has
// a short alt text and a caption; every picture file is used; and every picture is drawn by a source of our own in
// images/diagrams (nothing is copied from elsewhere).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ChaptersLib, I18nLib, LanguagesLib, PicturesLib } from "../src/index.js";
import { repoRoot } from "./repo.js";

const content = join(repoRoot(), "src", "Linux", "content");
const images = join(content, "images");
const picture = /!\[([^\]]*)\]\((images\/[^ )]+)(?: "([^"]*)")?\)/g;
const langs = LanguagesLib.all.map((l) => l.code);

interface Use {
  lang: string;
  chapter: string;
  path: string;
  alt: string;
  caption: string;
}

/** The pictures every chapter shows, in every language (the raw text: family blocks included). */
function uses(): Use[] {
  const list: Use[] = [];
  for (const chapter of ChaptersLib.chapters)
    for (const lang of langs) {
      const md = I18nLib.chapterMarkdown(chapter, lang);
      for (const m of md.matchAll(picture)) list.push({ lang, chapter: chapter.id, path: m[2]!, alt: m[1]!, caption: m[3] ?? "" });
    }
  return list;
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === "diagrams" ? [] : filesUnder(join(dir, e.name)).map((f) => `${e.name}/${f}`)) : [e.name]));
}

describe("PictureTests", () => {
  it("kapitlen har bilder", () => {
    expect(uses().length).toBeGreaterThan(0);
  });

  it("varje bild i kapitlen finns på kapitlets språk (eller engelska eller gemensam) och är en WebP", () => {
    const problems: string[] = [];
    for (const u of uses()) {
      const name = PicturesLib.resolve(u.path, u.lang);
      if (name === null) {
        problems.push(`${u.lang}/${u.chapter}: ${u.path} finns inte`);
        continue;
      }
      const bytes = readFileSync(join(content, name));
      if (bytes.toString("latin1", 0, 4) !== "RIFF" || bytes.toString("latin1", 8, 12) !== "WEBP") problems.push(`${name} är inte en WebP`);
      if (PicturesLib.url(u.path, u.lang) === null) problems.push(`${u.lang}/${u.chapter}: ${u.path} har ingen URL i appen`);
    }
    expect(problems).toEqual([]);
  });

  it("alla språk visar samma bilder i samma ordning som engelskan", () => {
    const all = uses();
    const problems: string[] = [];
    for (const chapter of ChaptersLib.chapters) {
      const english = all.filter((u) => u.lang === "en" && u.chapter === chapter.id).map((u) => u.path);
      for (const lang of langs) {
        const own = all.filter((u) => u.lang === lang && u.chapter === chapter.id).map((u) => u.path);
        if (JSON.stringify(own) !== JSON.stringify(english)) problems.push(`${lang}/${chapter.id}: ${own.join(", ")} (engelska: ${english.join(", ")})`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("varje bild har en kort alt-text och en bildtext", () => {
    const problems = uses()
      .filter((u) => u.alt.trim() === "" || u.caption.trim() === "" || u.alt.length > 80 || /[*`_[\]]/.test(u.caption))
      .map((u) => `${u.lang}/${u.chapter}: ${u.path} (alt "${u.alt}", bildtext "${u.caption}")`);
    expect(problems).toEqual([]);
  });

  it("varje bild i images/ används av något kapitel", () => {
    const shown = new Set(uses().map((u) => PicturesLib.resolve(u.path, u.lang)));
    const unused = filesUnder(images)
      .filter((f) => /\.(webp|png|gif|jpg)$/.test(f))
      .map((f) => `images/${f}`)
      .filter((f) => !shown.has(f));
    expect(unused).toEqual([]);
    // The app has exactly these pictures (nothing under images/diagrams).
    expect(PicturesLib.names()).toEqual(
      filesUnder(images)
        .filter((f) => /\.(webp|png|gif|jpg)$/.test(f))
        .map((f) => `images/${f}`)
        .sort(),
    );
  });

  it("varje bild ritas av en egen källa i images/diagrams", () => {
    const missing = [...new Set(uses().map((u) => u.path.slice("images/".length).replace(/\.\w+$/, "")))].filter(
      (name) => !existsSync(join(images, "diagrams", `${name}.mjs`)),
    );
    expect(missing).toEqual([]);
  });

  it("ett språk utan egen bild får den engelska, och en sökväg utanför images/ ger ingen bild", () => {
    const name = PicturesLib.names().find((n) => n.startsWith("images/en/"))!;
    const path = name.replace("images/en/", "images/");
    expect(PicturesLib.resolve(path, "xx")).toBe(name);
    expect(PicturesLib.resolve("images/../changelog.json", "en")).toBeNull();
    expect(PicturesLib.resolve("other/fs-tree.webp", "en")).toBeNull();
  });
});
