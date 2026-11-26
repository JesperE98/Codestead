import type { Checks } from "./TaskChecks.PerApi.js";
import { gettingStartedProject } from "./TaskChecks.Project.GettingStarted.js";
import { going3DProject } from "./TaskChecks.Project.Going3D.js";
import { lightingProject } from "./TaskChecks.Project.Lighting.js";
import { modelLoadingProject } from "./TaskChecks.Project.ModelLoading.js";
import { advancedOpenGLProject } from "./TaskChecks.Project.AdvancedOpenGL.js";
import { advancedLightingProject } from "./TaskChecks.Project.AdvancedLighting.js";
import { pbrProject } from "./TaskChecks.Project.Pbr.js";
import { inPracticeProject } from "./TaskChecks.Project.InPractice.js";
import { guestArticlesProject } from "./TaskChecks.Project.GuestArticles.js";

// The milestones' checks of the optional projects after the parts' exams, by project ("<part>-project"; the milestones
// are projects/<api>/<part>-project/edits.txt, the brief chapters/<lang>/<part>-project.md). Every milestone has a check:
// the TaskTests apply each milestone's edits to the project's start/ and expect its check to fail before and pass after.

export function projects(): Record<string, Checks> {
  return {
    ...gettingStartedProject(),
    ...going3DProject(),
    ...lightingProject(),
    ...modelLoadingProject(),
    ...advancedOpenGLProject(),
    ...advancedLightingProject(),
    ...pbrProject(),
    ...inPracticeProject(),
    ...guestArticlesProject(),
  };
}
