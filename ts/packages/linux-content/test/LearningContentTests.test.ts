// Port of tests/Linux/Codestead.Content.Tests/LearningContentTests.cs.
//
// Rules for the interactive parts of the chapters: checkpoints in the text, summaries, exams and sources.
// English is the source language; every translation must have the same checkpoints, so a student gets the
// same questions in every language. Their commands and answers use the student's world (file names in the
// student's language) and are checked in the simulator for every language.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { ChapterKinds, Checkpoint } from "@codestead/learning";
import { type Distro, DistrosLib, Shell, UtilCmd } from "@codestead/linux-shell";
import { describe, expect, it } from "vitest";
import { type Chapter, ChaptersLib, I18nLib, RenderLib } from "../src/index.js";
import { repoRoot } from "./repo.js";

/**
 * The only sites a chapter may cite: the official documentation of the projects themselves.
 * Keep this list in sync with the table in docs/verification/README.md.
 */
export const OfficialDomains = [
  "man7.org", "www.kernel.org", "docs.kernel.org", "www.gnu.org",
  "git-scm.com", "curl.se", "www.openssh.com", "man.openbsd.org",
  "wiki.archlinux.org", "man.archlinux.org", "archlinux.org", "aur.archlinux.org",
  "docs.fedoraproject.org", "fedoraproject.org", "docs.pagure.org",
  "help.ubuntu.com", "documentation.ubuntu.com", "ubuntu.com", "help.launchpad.net",
  "www.debian.org", "wiki.debian.org", "manpages.debian.org",
  "www.freedesktop.org", "systemd.io",
  "fishshell.com", "zsh.sourceforge.io",
  "docs.flatpak.org", "flatpak.org", "snapcraft.io", "docs.appimage.org",
];

const chapterIds = ChaptersLib.chapters.map((c) => c.id);

function chapterById(id: string): Chapter {
  return ChaptersLib.chapters.find((c) => c.id === id)!;
}

function distroOf(chapter: Chapter): Distro {
  return DistrosLib.getDistro(ChaptersLib.distroFor(chapter, ChaptersLib.DefaultDistro));
}

/** The checkpoints as the student sees them: placeholders filled in for the language's world. */
function parse(chapter: Chapter, lang: string): Checkpoint[] {
  return Checkpoint.parseAll(RenderLib.preprocess(I18nLib.chapterMarkdown(chapter, lang), distroOf(chapter), lang));
}

/** Every language with a text for the chapter, with English first. */
function langs(chapter: Chapter): string[] {
  const key = (l: string) => (l === "en" ? "" : l);
  return I18nLib.languagesWithMarkdown(chapter).sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

/** A fresh shell like the app's checkpoint sandbox, in the language's world. */
function sandbox(chapter: Chapter, lang: string): Shell {
  const sh = Shell.create(distroOf(chapter).id, lang);
  sh.lang = lang;
  return sh;
}

describe("LearningContentTests", () => {
  it.each(chapterIds)("kontrollpunkterna är likadana på alla språk: %s", (chapterId) => {
    // The same questions in every language. Commands and answers may differ, because file names, the user
    // name and example words are in the student's language; each language is checked in the simulator below.
    const chapter = chapterById(chapterId);
    const source = parse(chapter, "en");
    for (const lang of I18nLib.languagesWithMarkdown(chapter)) {
      const cps = parse(chapter, lang);
      expect(source.length === cps.length, `${lang}/${chapterId}: ${cps.length} checkpoints, English has ${source.length}`).toBe(true);
      for (let i = 0; i < cps.length; i++) {
        const [en, tr] = [source[i]!, cps[i]!];
        const where = `${lang}/${chapterId} checkpoint ${i}`;
        expect(en.kind === tr.kind, `${where}: ${tr.kind}, English has ${en.kind}`).toBe(true);
        expect(
          en.options.map((o) => o.correct).join() === tr.options.map((o) => o.correct).join(),
          `${where}: the options or the right answers differ from English`,
        ).toBe(true);
        expect(en.commands.length === tr.commands.length, `${where}: ${tr.commands.length} commands, English has ${en.commands.length}`).toBe(true);
      }
    }
  });

  it.each(chapterIds)("predict-svaren stämmer med simulatorn: %s", (chapterId) => {
    const chapter = chapterById(chapterId);
    for (const lang of langs(chapter))
      for (const cp of parse(chapter, lang).filter((c) => c.kind === Checkpoint.Predict)) {
        const sh = sandbox(chapter, lang);
        const output = cp.commands
          .map((c) => UtilCmd.stripAnsi(sh.execute(c).output).replace(/\n+$/, ""))
          .filter((o) => o !== "")
          .join("\n");
        expect(
          Checkpoint.normalize(output) === Checkpoint.normalize(cp.expected),
          `${lang}/${chapterId} checkpoint ${cp.index}: the simulator prints\n${output}\nbut the answer is\n${cp.expected}`,
        ).toBe(true);
      }
  });

  it("Grunderna använder inte sed eller awk – de kommer i kapitlet om textbearbetning", () => {
    const command = /(^|[|;&]\s*|\$ )(sed|awk)\s/;
    for (const chapter of ChaptersLib.chapters.filter((c) => c.part === "start" || c.part === "grunder"))
      for (const lang of langs(chapter)) {
        const text = I18nLib.chapterMarkdown(chapter, lang);
        // C#: RegexOptions.Multiline | Singleline – "." also matches newlines.
        const code = [...text.matchAll(/^```(sh|text|predict|try)\n(.*?)^```/gms)].flatMap((m) => m[2]!.split("\n"));
        for (const line of code)
          expect(command.test(line), `${lang}/${chapter.id}: "${line}" – sed and awk are taught in "textbearbetning"`).toBe(false);
      }
  });

  it.each(chapterIds)("try-kommandona fungerar i en ny sandlåda: %s", (chapterId) => {
    const chapter = chapterById(chapterId);
    for (const lang of langs(chapter))
      for (const cp of parse(chapter, lang).filter((c) => c.kind === Checkpoint.Try)) {
        const r = sandbox(chapter, lang).execute(cp.commands[0]!);
        expect(
          r.exitCode === 0,
          `${lang}/${chapterId} checkpoint ${cp.index}: "${cp.commands[0]}" exits with ${r.exitCode}: ${UtilCmd.stripAnsi(r.output)}`,
        ).toBe(true);
      }
  });

  it("varje prov har minst 10 frågor och föregås av en sammanfattning", () => {
    for (const exam of ChaptersLib.chapters.filter((c) => c.kind === ChapterKinds.Exam)) {
      expect(parse(exam, "en").length >= 10, `${exam.id}: an exam needs at least 10 questions`).toBe(true);
      expect(ChaptersLib.chapters.some((c) => c.part === exam.part && c.kind === ChapterKinds.Summary)).toBe(true);
      expect(
        ChaptersLib.chapters.findIndex((c) => c.id === exam.id) ===
          ChaptersLib.chapters.findLastIndex((c) => c.part === exam.part && c.kind !== ChapterKinds.Project),
        `${exam.id}: the exam must come last in its main chapter (only its optional project may follow it)`,
      ).toBe(true);
    }
  });

  it.each(chapterIds)("källorna är officiella webbplatser: %s", (chapterId) => {
    const chapter = chapterById(chapterId);
    for (const r of I18nLib.references(chapter)) {
      expect(!r.title || r.title.trim() === "", `${chapterId}: a source without a title`).toBe(false);
      expect(!r.publisher || r.publisher.trim() === "", `${chapterId}: ${r.url} has no publisher`).toBe(false);
      let uri: URL | null = null;
      try {
        uri = new URL(r.url);
      } catch {
        uri = null;
      }
      expect(uri !== null && uri.protocol === "https:", `${chapterId}: ${r.url} is not an https address`).toBe(true);
      expect(OfficialDomains.includes(uri!.hostname), `${chapterId}: ${uri!.hostname} is not on the list of official sites`).toBe(true);
    }
  });

  it("varje huvudkapitel utom Kom igång har sammanfattning och prov", () => {
    for (const part of ChaptersLib.parts.filter((p) => p.id !== "start")) {
      expect(ChaptersLib.chapters.some((c) => c.part === part.id && c.kind === ChapterKinds.Summary), `${part.id}: no summary`).toBe(true);
      expect(ChaptersLib.chapters.some((c) => c.part === part.id && c.kind === ChapterKinds.Exam), `${part.id}: no exam`).toBe(true);
    }
  });

  it.each(chapterIds)("varje kapitel har en granskningslogg: %s", (chapterId) => {
    const log = join(repoRoot(), "docs", "verification", chapterId + ".md");
    expect(existsSync(log), `docs/verification/${chapterId}.md is missing (see docs/verification/README.md)`).toBe(true);
  });

  // C#: Skip = "Källorna läggs till när innehållet faktagranskas (fas 4)."
  it.skip.each(chapterIds)("varje sub-kapitel har minst en källa: %s – Källorna läggs till när innehållet faktagranskas (fas 4).", (chapterId) => {
    const chapter = chapterById(chapterId);
    if (chapter.kind === ChapterKinds.Lesson) expect(I18nLib.references(chapter)).not.toHaveLength(0);
  });

  it.each(chapterIds)("varje sub-kapitel har kontrollfrågor: %s", (chapterId) => {
    const chapter = chapterById(chapterId);
    if (chapter.kind === ChapterKinds.Lesson) expect(parse(chapter, "en")).not.toHaveLength(0);
  });
});
