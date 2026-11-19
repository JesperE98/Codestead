import type { TaskCheck } from "../TaskCheck.js";
import { advancedLighting } from "./TaskChecks.AdvancedLighting.js";
import { advancedLighting2 } from "./TaskChecks.AdvancedLighting2.js";
import { advancedLighting3 } from "./TaskChecks.AdvancedLighting3.js";
import { advancedLighting4 } from "./TaskChecks.AdvancedLighting4.js";
import { advancedOpenGL } from "./TaskChecks.AdvancedOpenGL.js";
import { advancedOpenGL3 } from "./TaskChecks.AdvancedOpenGL3.js";
import { creatingAWindow } from "./TaskChecks.CreatingAWindow.js";
import { exercisesAdvancedLightingAndPbr } from "./TaskChecks.ExercisesAdvancedLightingAndPbr.js";
import { exercisesGettingStarted } from "./TaskChecks.ExercisesGettingStarted.js";
import { exercisesGuestArticles } from "./TaskChecks.ExercisesGuestArticles.js";
import { exercisesInPractice } from "./TaskChecks.ExercisesInPractice.js";
import { exercisesModelsAndAdvancedOpenGL } from "./TaskChecks.ExercisesModelsAndAdvancedOpenGL.js";
import { guestArticles } from "./TaskChecks.GuestArticles.js";
import { guestArticles2 } from "./TaskChecks.GuestArticles2.js";
import { helloTriangle } from "./TaskChecks.HelloTriangle.js";
import { helloWindow } from "./TaskChecks.HelloWindow.js";
import { inPractice } from "./TaskChecks.InPractice.js";
import { inPractice2 } from "./TaskChecks.InPractice2.js";
import { inPractice3 } from "./TaskChecks.InPractice3.js";
import { lighting } from "./TaskChecks.Lighting.js";
import { modelLoading } from "./TaskChecks.ModelLoading.js";
import type { Checks } from "./TaskChecks.PerApi.js";
import { pbr } from "./TaskChecks.Pbr.js";
import { shaders } from "./TaskChecks.Shaders.js";
import { textures } from "./TaskChecks.Textures.js";
import { camera, coordinateSystems, transformations } from "./TaskChecks.Transformations.js";

let all: Map<string, TaskCheck> | null = null;

function build(): Map<string, TaskCheck> {
  const d = new Map<string, TaskCheck>();
  const add = (chapter: string, checks: Checks): void => {
    for (const [task, check] of Object.entries(checks)) d.set(`${chapter}/${task}`, check);
  };
  add("creating-a-window", creatingAWindow());
  add("hello-window", helloWindow());
  add("hello-triangle", helloTriangle());
  add("shaders", shaders());
  add("textures", textures());
  add("transformations", transformations());
  add("coordinate-systems", coordinateSystems());
  add("camera", camera());
  for (const group of [
    lighting(),
    modelLoading(),
    advancedOpenGL(),
    advancedOpenGL3(),
    advancedLighting(),
    advancedLighting2(),
    advancedLighting3(),
    advancedLighting4(),
    pbr(),
    inPractice(),
    inPractice2(),
    inPractice3(),
    guestArticles(),
    guestArticles2(),
  ])
    for (const [chapter, checks] of group) add(chapter, checks);
  for (const group of [
    exercisesGettingStarted(),
    exercisesModelsAndAdvancedOpenGL(),
    exercisesAdvancedLightingAndPbr(),
    exercisesInPractice(),
    exercisesGuestArticles(),
  ])
    for (const [chapter, checks] of Object.entries(group)) add(chapter, checks);
  return d;
}

/**
 * Every task's check, by chapter and task id. A check may look at the API (c.api) when the APIs differ. The checks of
 * each chapter are in their own file (TaskChecks.&lt;Chapter&gt;.ts).
 */
export const TaskChecks = {
  for(chapterId: string, taskId: string): TaskCheck | null {
    return (all ??= build()).get(`${chapterId}/${taskId}`) ?? null;
  },
};
