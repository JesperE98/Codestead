// Port of tests/GP/Codestead.GP.Tests/PictureTests.cs (not ported with @codestead/gp-course: it is about the pictures
// the window shows). The pictures of the chapters' texts: every one a chapter shows exists in its language (or shared)
// and can be read; every picture in src/GP/content/images is used by some chapter. And the app finds the same one.
// A scene of the Render Pipeline Visualizer (`![alt](viz:<scene> "caption")`) uses its still picture, which is shown
// where the scene cannot run (images/[<lang>/]viz-<scene>.webp): every scene a chapter places exists and has one.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { GpCourse } from "@codestead/gp-course";
import { parseVizSource } from "@codestead/pipeline-viz";
import { describe, expect, it } from "vitest";

const content = fileURLToPath(new URL("../../../../src/GP/content/", import.meta.url));
const picture = /!\[[^\]]*\]\(((?:images\/|viz:)[^ )]+)/g;

/** The pictures the chapters use: a scene (viz:) uses its still picture; `scene` is the scene's source. */
function used(): { lang: string; chapter: string; path: string; scene?: string }[] {
  const list: { lang: string; chapter: string; path: string; scene?: string }[] = [];
  for (const lang of ["en", "sv"]) {
    const dir = path.join(content, "chapters", lang);
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md")))
      for (const m of fs.readFileSync(path.join(dir, file), "utf8").matchAll(picture)) {
        const chapter = path.basename(file, ".md");
        const source = m[1]!;
        if (!source.startsWith("viz:")) list.push({ lang, chapter, path: source });
        else list.push({ lang, chapter, path: parseVizSource(source)?.picture ?? `(no such scene: ${source})`, scene: source });
      }
  }
  return list;
}

function filesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

describe("PictureTests", () => {
  it("varje bild i kapitlen finns på kapitlets språk och går att läsa", () => {
    const missing = used()
      .filter((u) => (GpCourse.picture(u.path, u.lang)?.length ?? 0) === 0)
      .map((u) => `${u.lang}/${u.chapter}: ${u.path}`);
    expect(missing).toEqual([]);
  });

  it("varje scen ur visualiseraren (viz:) finns och har sin stillbild", () => {
    const scenes = used().filter((u) => u.scene !== undefined);
    expect(scenes.length).toBeGreaterThan(0);
    expect(scenes.filter((u) => parseVizSource(u.scene!) === null).map((u) => `${u.lang}/${u.chapter}: ${u.scene}`)).toEqual([]);
  });

  it("varje bild i images/ används av något kapitel", () => {
    const usedNames = new Set(used().map((u) => u.path.slice("images/".length)));
    const root = path.join(content, "images");
    const unused = [
      ...new Set(
        filesUnder(root)
          .filter((f) => [".webp", ".png", ".gif", ".jpg"].includes(path.extname(f)))
          .map((f) => path.relative(root, f).replaceAll("\\", "/"))
          .map((rel) => (rel.startsWith("en/") || rel.startsWith("sv/") ? rel.slice(3) : rel))
          .filter((rel) => !usedNames.has(rel)),
      ),
    ];
    expect(unused).toEqual([]);
  });
});
