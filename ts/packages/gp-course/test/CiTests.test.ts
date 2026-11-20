// CI runs the TaskTests in parallel jobs, each a group of course parts, narrowed to some chapters or without some
// (CODESTEAD_GP_PARTS and CODESTEAD_GP_CHAPTERS in the gp-tasks jobs' matrices of ci.yml and release.yml, see
// TaskSelection.ts). A lesson missing from every job would never be tested there, one in two jobs would run twice: a new
// part or chapter must be in exactly one job of both.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GpCourse } from "../src/index.js";
import { Repo } from "./Repo.js";
import { listOf, selectLessons } from "./TaskSelection.js";

interface Shard {
  name: string;
  parts: string;
  chapters: string;
}

/** The gp-tasks job's matrix entries: `- { name: '…', parts: '…', chapters: '…' }`. */
function shards(workflow: string): { job: string; shards: Shard[] } {
  const text = readFileSync(join(Repo.root, workflow), "utf8").replaceAll("\r\n", "\n");
  const start = text.indexOf("\n  gp-tasks:");
  expect(start, `${workflow} has no gp-tasks job`).toBeGreaterThan(0);
  // The job, up to the next one.
  const rest = text.slice(start + 1);
  const end = rest.search(/\n {2}[a-z][\w-]*:\n/);
  const job = end < 0 ? rest : rest.slice(0, end);
  const field = (entry: string, key: string) => new RegExp(`\\b${key}: '([^']*)'`).exec(entry)?.[1] ?? "";
  const list = [...job.matchAll(/^\s*-\s*\{(.*)\}\s*$/gm)].map((m) => ({ name: field(m[1]!, "name"), parts: field(m[1]!, "parts"), chapters: field(m[1]!, "chapters") }));
  return { job, shards: list };
}

describe("CiTests", () => {
  for (const workflow of [".github/workflows/ci.yml", ".github/workflows/release.yml"])
    it(`CI:s parallella uppgiftsjobb tar varje lektion exakt en gång (${workflow})`, () => {
      const { job, shards: list } = shards(workflow);
      expect(list.length).toBeGreaterThan(1);
      expect(job).toContain("CODESTEAD_GP_PARTS: ${{ matrix.shard.parts }}");
      expect(job).toContain("CODESTEAD_GP_CHAPTERS: ${{ matrix.shard.chapters }}");
      expect(job).toContain("packages/gp-course/test/TaskTests.test.ts");
      const lessons = GpCourse.chapters.filter((c) => c.isLesson);
      const ids = new Set(lessons.map((c) => c.id));
      const times = new Map<string, string[]>();
      for (const s of list) {
        const parts = listOf(s.parts);
        expect(parts, `${s.name}: no parts`).not.toBeNull();
        // Only parts and chapters that exist (a misspelt name would quietly test nothing, or everything).
        expect(parts!.filter((p) => !GpCourse.parts.includes(p)), s.name).toEqual([]);
        const chapters = listOf(s.chapters) ?? [];
        expect(chapters.map((c) => c.replace(/^!/, "")).filter((c) => !ids.has(c)), s.name).toEqual([]);
        const chosen = selectLessons(parts, listOf(s.chapters));
        expect(chosen.length, `${s.name} tests nothing`).toBeGreaterThan(0);
        for (const c of chosen) times.set(c, [...(times.get(c) ?? []), s.name]);
      }
      expect(lessons.filter((c) => !times.has(c.id)).map((c) => c.id), "in no job").toEqual([]);
      expect([...times].filter(([, jobs]) => jobs.length > 1), "in more than one job").toEqual([]);
      expect(new Set(list.map((s) => s.name)).size).toBe(list.length);
    });

  it("de två arbetsflödena delar upp uppgiftstesterna likadant", () => {
    expect(shards(".github/workflows/release.yml").shards).toEqual(shards(".github/workflows/ci.yml").shards);
  });
});
