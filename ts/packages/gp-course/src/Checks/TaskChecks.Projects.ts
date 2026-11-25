import type { Checks } from "./TaskChecks.PerApi.js";
import { modelLoadingProject } from "./TaskChecks.Project.ModelLoading.js";

// The milestones' checks of the optional projects after the parts' exams, by project ("<part>-project"; the milestones
// are projects/<api>/<part>-project/edits.txt, the brief chapters/<lang>/<part>-project.md). Every milestone has a check:
// the TaskTests apply each milestone's edits to the project's start/ and expect its check to fail before and pass after.

export function projects(): Record<string, Checks> {
  return {
    ...modelLoadingProject(),
  };
}
