// ContentTests.cs: the texts – every lesson in English and Swedish, the same questions for every API and language,
// every task with a text, only known blocks and placeholders, official sources.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { Languages } from "@codestead/common";
import { Apis } from "@codestead/gp-gpu";
import { ChapterKinds, Checkpoint } from "@codestead/learning";
import { describe, expect, it } from "vitest";
import { CourseText, GpCourse, Ides } from "../src/index.js";
import { Repo } from "./Repo.js";

/** The languages whose chapter texts are required (the others fall back to English for now). */
const ChapterLanguages = ["en", "sv"];

const chapterFile = (lang: string, chapter: string): string => join(Repo.content, "chapters", lang, chapter + ".md");

describe("ContentTests", () => {
  for (const { id: chapter } of GpCourse.chapters) {
    it(`kapitlet finns på engelska och svenska, med titel (${chapter})`, () => {
      for (const lang of ChapterLanguages) {
        expect(existsSync(chapterFile(lang, chapter)), `chapters/${lang}/${chapter}.md is missing`).toBe(true);
        expect(existsSync(join(Repo.content, "i18n", lang, chapter + ".json")), `i18n/${lang}/${chapter}.json is missing`).toBe(true);
        for (const api of Apis.all) expect(CourseText.title(chapter, lang, api.id)).not.toBe(chapter);
      }
    });

    it(`samma kontrollfrågor för alla API:er och språk (${chapter})`, () => {
      // The window counts the questions in the English text for the chosen API: every API's text must have as many,
      // and every language the same kinds in the same order.
      const shape = new Map<string, string>();
      for (const lang of Languages.offered.map((l) => l.code).filter((l) => existsSync(chapterFile(l, chapter))))
        for (const api of Apis.all) {
          const raw = readFileSync(chapterFile(lang, chapter), "utf8");
          const shapeOf = (ide: string | null): string =>
            Checkpoint.parseAll(CourseText.preprocess(raw, api.id, ide))
              .map((c) => `${c.kind}:${c.options.length}:${c.options.map((o) => (o.correct ? "x" : "-")).join("")}`)
              .join(",");
          shape.set(`${lang}/${api.id}`, shapeOf(null));
          // The same questions whatever IDE is chosen.
          for (const ide of Ides.all)
            expect(shapeOf(ide.id) === shape.get(`${lang}/${api.id}`), `${lang}/${chapter} (${api.id}): the questions differ for ${ide.name}`).toBe(true);
        }
      const listing = (entries: [string, string][]): string => entries.map(([k, v]) => `${k}: ${v}`).join("\n");
      const counts = [...new Set([...shape.values()].map((v) => v.split(",").filter((s) => s.length > 0).length))];
      expect(counts.length === 1, "different numbers of questions:\n" + listing([...shape])).toBe(true);
      for (const api of Apis.all) {
        const entries = [...shape].filter(([k]) => k.endsWith("/" + api.id));
        const forApi = new Set(entries.map(([, v]) => v));
        expect(forApi.size === 1, `${chapter} (${api.id}): the questions differ between languages:\n` + listing(entries)).toBe(true);
      }
      if (GpCourse.chapter(chapter).kind === ChapterKinds.Exam) expect(counts[0]! >= 10, "an exam needs at least 10 questions").toBe(true);
    });

    it(`rätt svar står inte nästan alltid på samma plats (${chapter})`, () => {
      // The app shows the options in the file's order: a quiz whose right answer is always first (or second) can
      // be answered without reading. Single-choice quizzes in English, all APIs' blocks together.
      const text = readFileSync(chapterFile("en", chapter), "utf8");
      const positions = Checkpoint.parseAll(text.replaceAll(":::", "\n"))
        .filter((c) => c.kind === Checkpoint.Quiz && !c.multipleAnswers)
        .map((c) => c.options.findIndex((o) => o.correct));
      if (positions.length < 5) return;
      const groups = new Map<number, number>();
      for (const p of positions) groups.set(p, (groups.get(p) ?? 0) + 1);
      const most = Math.max(...groups.values());
      expect(most <= positions.length * 0.75, `${chapter}: ${most} of ${positions.length} right answers are in the same place – vary the order`).toBe(true);
    });

    it(`varje uppgift och övning har en text på engelska och svenska (${chapter})`, () => {
      for (const api of Apis.all)
        for (const task of GpCourse.allTasks(chapter, api.id))
          for (const lang of ChapterLanguages) {
            const doc = JSON.parse(readFileSync(join(Repo.content, "i18n", lang, chapter + ".json"), "utf8")) as { tasks?: Record<string, { text?: unknown }> };
            const text = doc.tasks?.[task.id]?.text;
            const ok = typeof text === "string" || (typeof text === "object" && text !== null && Object.hasOwn(text, api.id));
            expect(ok, `${lang}/${chapter}.json: no text for task '${task.id}' (${api.id})`).toBe(true);
          }
    });

    it(`bara kända API- och IDE-block och platshållare i texterna (${chapter})`, () => {
      const questionLine = new RegExp(String.raw`^\s*(\`\`\`|~~~)\s*(` + Checkpoint.Kinds.join("|") + String.raw`)\b`);
      for (const lang of ChapterLanguages) {
        const file = `${lang}/${chapter}.md`;
        const text = readFileSync(chapterFile(lang, chapter), "utf8").replaceAll("\r\n", "\n");
        // Blocks: ":::opengl" / ":::vulkan d3d12" (APIs) and ":::ide vs rider" (IDEs), each closed by ":::". IDE blocks
        // may sit inside API blocks, never the other way round, and hold no questions (they are the same for every IDE).
        const open: string[] = [];
        let lineNo = 0;
        for (const line of text.split("\n")) {
          lineNo++;
          if (/^:::[ \t]*$/.test(line)) {
            expect(open.length > 0, `${file}:${lineNo}: ':::' closes no block`).toBe(true);
            open.pop();
            continue;
          }
          const m = /^:::[ \t]*(\S.*)$/.exec(line);
          if (m !== null) {
            const ids = CourseText.blockIds(m[1]!);
            if (ids[0] === "ide") {
              expect(ids.length > 1, `${file}:${lineNo}: ':::ide' needs at least one IDE`).toBe(true);
              for (const ide of ids.slice(1))
                expect(Ides.isKnown(ide), `${file}:${lineNo}: unknown IDE '${ide}' (known: ${Ides.all.map((i) => i.id).join(", ")})`).toBe(true);
              expect(open.includes("ide"), `${file}:${lineNo}: an IDE block inside an IDE block`).toBe(false);
              open.push("ide");
            } else {
              for (const api of ids) expect(Apis.isKnown(api), `${file}:${lineNo}: unknown block :::${api}`).toBe(true);
              expect(open.includes("ide"), `${file}:${lineNo}: an API block inside an IDE block (put the IDE block inside the API block)`).toBe(false);
              open.push("api");
            }
            continue;
          }
          if (open.includes("ide") && questionLine.test(line)) expect.fail(`${file}:${lineNo}: a question inside an IDE block (questions are the same for every IDE)`);
        }
        expect(open.length === 0, `${file}: ${open.length} block(s) not closed with ':::'`).toBe(true);
        for (const api of Apis.all)
          for (const ide of [...Ides.all.map((i) => i.id), null]) {
            const shown = CourseText.preprocess(text, api.id, ide);
            expect(shown).not.toMatch(/\{\{\w+\}\}/);
            expect(shown).not.toMatch(/^:::/m);
          }
      }
    });
  }

  it("källor bara från officiella webbplatser", () => {
    const allowed = ["learnopengl.com", "vulkan-tutorial.com", "docs.vulkan.org", "registry.khronos.org", "www.khronos.org", "www.glfw.org", "glad.dav1d.de", "learn.microsoft.com", "github.com/microsoft", "github.com/KhronosGroup", "github.com/JoeyDeVries", "github.com/Overv", "vulkan.lunarg.com", "www.opengl.org", "en.cppreference.com"];
    const dir = join(Repo.content, "references");
    if (!existsSync(dir)) return;
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f))) {
      const doc = JSON.parse(readFileSync(file, "utf8")) as { url: string; api?: string }[];
      for (const r of doc) {
        expect(allowed.some((a) => r.url.startsWith("https://" + a)), `${basename(file)}: ${r.url} is not an official source`).toBe(true);
        if (r.api !== undefined) expect(Apis.isKnown(r.api), `${basename(file)}: unknown api`).toBe(true);
      }
    }
  });

  it("källorna läses per API (CourseText.references)", () => {
    // Not in C#'s ContentTests: the loader the app uses reads the same files and keeps a source for one API to it.
    for (const chapter of GpCourse.chapters.map((c) => c.id).filter((id) => existsSync(join(Repo.content, "references", id + ".json")))) {
      const doc = JSON.parse(readFileSync(join(Repo.content, "references", chapter + ".json"), "utf8")) as { url: string; api?: string }[];
      for (const api of Apis.all)
        expect(CourseText.references(chapter, api.id).map((r) => r.url)).toEqual(doc.filter((r) => r.api === undefined || r.api === api.id).map((r) => r.url));
    }
  });
});
