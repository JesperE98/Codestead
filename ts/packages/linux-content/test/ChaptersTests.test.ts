// Port of tests/Linux/Codestead.Content.Tests/ChaptersTests.cs (src/content/chapters.test.ts).
// The HTML rendering is not ported, so the "renders" checks look at the preprocessed markdown instead:
// it must have a level-1 heading and no leftover {{placeholders}} or ::: lines.

import { DistrosLib, Shell, World } from "@codestead/linux-shell";
import { describe, expect, it } from "vitest";
import { ChaptersLib, I18nLib, LanguagesLib, ProgressLib, RenderLib } from "../src/index.js";

/** Languages that must be fully translated. */
const requiredLangs = LanguagesLib.languages.map((l) => l.code);

// ---------- alla uppgifter går att lösa i <distro> ----------

// Runs every solution in order – exactly like a student would – and checks that each task is
// actually ticked off in each distribution. As in the TypeScript, one shell and one set of completed
// tasks are shared by all chapters of a distro; a failing chapter stops at its first unfinished task,
// and the next chapter continues with the same shell. The run happens once per distro; each
// (distro, chapter) pair is reported as its own test.
const runs = new Map<string, Map<string, string | null>>();

function solveAll(distroId: string, lang: string): Map<string, string | null> {
  const key = `${distroId}/${lang}`;
  let r = runs.get(key);
  if (r === undefined) runs.set(key, (r = runSolutions(distroId, lang)));
  return r;
}

/**
 * Chapter id → null when every task got done, otherwise the failure message. `lang` is the
 * language of the student's world (file names, user name ...), so the checks are tried with every world.
 */
function runSolutions(distroId: string, lang: string): Map<string, string | null> {
  // Like the app: one shell per distribution, and each chapter runs on ChaptersLib.distroFor
  // (Ubuntu outside the distro main chapter, the student's choice – within the family – inside it).
  const shells = new Map<string, Shell>();
  const completed = new Map<string, boolean>();
  const results = new Map<string, string | null>();
  for (const chapter of ChaptersLib.chapters) {
    const distro = DistrosLib.getDistro(ChaptersLib.distroFor(chapter, distroId));
    let sh = shells.get(distro.id);
    if (sh === undefined) shells.set(distro.id, (sh = Shell.create(distro.id, lang)));
    let failure: string | null = null;
    try {
      for (const task of chapter.tasks) {
        for (const line of task.solutionFor(distro, sh.world)) {
          const result = sh.execute(line);
          for (const key of ProgressLib.evaluateTasks(chapter, sh, result, completed)) completed.set(key, true);
        }
        const k = ChaptersLib.taskKey(chapter.id, task.id, task.perFamily, distro.family);
        if (completed.get(k) !== true) {
          failure = `${k} blev inte klar`;
          break;
        }
      }
    } catch (e) {
      failure = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
    results.set(chapter.id, failure);
  }
  return results;
}

/** Every distribution with an English world, and Ubuntu with the world of every language. */
function distroChapters(): [string, string, string][] {
  const data: [string, string, string][] = [];
  const list: [string, string][] = [
    ...DistrosLib.distros.map((d): [string, string] => [d.id, "en"]),
    ...World.languages
      .filter((l) => l !== "en")
      .sort()
      .map((l): [string, string] => ["ubuntu", l]),
  ];
  for (const [distro, lang] of list) for (const c of ChaptersLib.chapters) data.push([distro, lang, c.id]);
  return data;
}

describe("ChaptersTests", () => {
  it.each(distroChapters())("alla uppgifter går att lösa i %s (%s): %s", (distroId, lang, chapterId) => {
    const failure = solveAll(distroId, lang).get(chapterId);
    expect(failure, failure ?? "").toBeNull();
  });

  // ---------- kapitelinnehåll ----------

  const chapterIds = ChaptersLib.chapters.map((c) => c.id);
  const requiredLanguages = LanguagesLib.languages.filter((l) => requiredLangs.includes(l.code)).map((l) => l.code);

  const h1 = /^#[ \t]/m;
  const leftoverPlaceholder = /\{\{[A-Za-z0-9_]+\}\}/;
  const leftoverBlock = /^:::/m;

  it.each(chapterIds)("renderas på alla språk och för alla familjer: %s", (chapterId) => {
    const chapter = ChaptersLib.chapters.find((c) => c.id === chapterId)!;
    const langs = I18nLib.languagesWithMarkdown(chapter);
    expect(langs).toContain("sv");
    for (const lang of langs) {
      for (const d of DistrosLib.distros) {
        const md = RenderLib.preprocess(I18nLib.chapterMarkdown(chapter, lang), d, lang);
        expect(h1.test(md), `${lang}/${chapter.id}: no level-1 heading`).toBe(true);
        expect(leftoverPlaceholder.test(md), `${lang}/${chapter.id}: leftover {{placeholder}}`).toBe(false);
        expect(leftoverBlock.test(md), `${lang}/${chapter.id}: leftover :::`).toBe(false);
      }
    }
  });

  it.each(requiredLanguages)("alla kapitel och uppgifter finns på %s", (lang) => {
    for (const chapter of ChaptersLib.chapters) {
      expect(I18nLib.isTranslated(chapter, lang), `${lang}/${chapter.id}`).toBe(true);
    }
  });

  it("distro-block fungerar även med Windows-radslut", () => {
    const md = "# Titel\r\n\r\n:::arch\r\nBara Arch\r\n:::\r\n\r\n:::debian\r\nBara Debian\r\n:::\r\n";
    const html = RenderLib.preprocess(
      md,
      DistrosLib.distros.find((d) => d.id === "arch")!,
    );
    expect(html).toContain("Bara Arch");
    expect(html).not.toContain("Bara Debian");
    expect(html).not.toContain(":::");
  });

  it("inga uppgifter klaras av utan att eleven gjort något", () => {
    for (const d of DistrosLib.distros) {
      const sh = Shell.create(d.id);
      const result = sh.execute("true");
      for (const chapter of ChaptersLib.chapters) {
        const done = ProgressLib.evaluateTasks(chapter, sh, result, new Map());
        expect(done.length, `${d.id}/${chapter.id}: ${done.join(", ")}`).toBe(0);
      }
    }
  });

  it("uppgifts-id är unika inom varje kapitel", () => {
    for (const c of ChaptersLib.chapters) {
      const ids = c.tasks.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
