// Which chapters the TaskTests run: CODESTEAD_GP_PARTS chooses course parts ("lighting,pbr") and CODESTEAD_GP_CHAPTERS
// chapters ("textures,camera"), or leaves some out with "!" ("!bloom,!ssao": every chapter but those). Unset: all.
// CI splits the TaskTests into parallel jobs with both (the gp-tasks matrices of .github/workflows/ci.yml and
// release.yml); CiTests.test.ts checks with the same function that every lesson is in exactly one job.
import { GpCourse } from "../src/index.js";

/** "a, b,,c" → ["a", "b", "c"]; empty or unset → null. */
export function listOf(value: string | undefined): readonly string[] | null {
  const items = (value ?? "").split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  return items.length > 0 ? items : null;
}

/**
 * The lessons and optional projects (ids, in course order) of the parts, narrowed by the chapters ("x" only those, "!x"
 * not those).
 */
export function selectLessons(parts: readonly string[] | null, chapters: readonly string[] | null): string[] {
  const only = chapters?.filter((c) => !c.startsWith("!")) ?? [];
  const not = new Set(chapters?.filter((c) => c.startsWith("!")).map((c) => c.slice(1)) ?? []);
  return GpCourse.chapters
    .filter((c) => (c.isLesson || c.isProject) && (parts === null || parts.includes(c.part)))
    .filter((c) => (only.length === 0 || only.includes(c.id)) && !not.has(c.id))
    .map((c) => c.id);
}

/** The lessons the environment chooses. */
export function lessonsToTest(): string[] {
  return selectLessons(listOf(process.env["CODESTEAD_GP_PARTS"]), listOf(process.env["CODESTEAD_GP_CHAPTERS"]));
}
