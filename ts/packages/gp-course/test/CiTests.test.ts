// CI runs the TaskTests in parallel jobs, one per group of course parts (CODESTEAD_GP_PARTS in the gp-tasks jobs'
// matrices of ci.yml and release.yml). A part missing from a matrix would never be tested there – a new part must be
// added to both.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GpCourse } from "../src/index.js";
import { Repo } from "./Repo.js";

describe("CiTests", () => {
  for (const workflow of [".github/workflows/ci.yml", ".github/workflows/release.yml"])
    it(`CI:s parallella uppgiftsjobb täcker varje kursdel (${workflow})`, () => {
      const text = readFileSync(join(Repo.root, workflow), "utf8").replaceAll("\r\n", "\n");
      const start = text.indexOf("\n  gp-tasks:");
      expect(start, `${workflow} has no gp-tasks job`).toBeGreaterThan(0);
      // The job, up to the next one.
      const rest = text.slice(start + 1);
      const end = rest.search(/\n {2}[a-z][\w-]*:\n/);
      const job = end < 0 ? rest : rest.slice(0, end);
      const listed = [...job.matchAll(/^\s*-\s*'([a-z-]+(?:,[a-z-]+)*)'\s*$/gm)].flatMap((m) => m[1]!.split(",").map((s) => s.trim()));
      const lessonParts = GpCourse.parts.filter((p) => GpCourse.lessonsIn(p).length > 0);
      expect(listed.length).toBeGreaterThan(0);
      expect(lessonParts.filter((p) => !listed.includes(p))).toEqual([]);
      expect(listed.filter((p) => !GpCourse.parts.includes(p))).toEqual([]);
      expect(new Set(listed).size).toBe(listed.length);
      expect(job).toContain("packages/gp-course/test/TaskTests.test.ts");
    });
});
