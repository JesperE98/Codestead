import { Simulator, type GpuProject, type Scene } from "@codestead/gp-gpu";
import { Edits } from "../Edits.js";
import { GpCourse } from "../GpCourse.js";

const scenes = new Map<string, Scene | null>();

/**
 * What a task's result should look like: the course's own solution up to and including the task (the start
 * project with the edits of every task so far), built and run by the simulated GPU. Cached per chapter, API and task.
 */
export const ExpectedResult = {
  /**
   * The project after the tasks up to `taskIndex` (inclusive) of {@link GpCourse.allTasks}: a step builds on the steps
   * before it, an exercise changes the chapter's finished program on its own.
   */
  project(chapterId: string, api: string, taskIndex: number): GpuProject {
    const steps = GpCourse.tasks(chapterId, api);
    const exercise = taskIndex >= steps.length ? GpCourse.exercises(chapterId, api)[taskIndex - steps.length] : undefined;
    if (exercise !== undefined) {
      const solved = GpCourse.solutionProject(chapterId, api);
      for (const edit of exercise.edits) Edits.apply(solved, edit);
      return solved;
    }
    const project = GpCourse.startProject(chapterId, api);
    for (const task of steps.slice(0, Math.max(0, taskIndex + 1))) for (const edit of task.edits) Edits.apply(project, edit);
    return project;
  },

  /** The scene of the task's solution (null when it does not build). */
  scene(chapterId: string, api: string, taskIndex: number): Scene | null {
    const key = `${api}/${chapterId}/${taskIndex}`;
    if (!scenes.has(key)) {
      const result = Simulator.build(ExpectedResult.project(chapterId, api, taskIndex), api);
      scenes.set(key, result.succeeded ? result.scene : null);
    }
    return scenes.get(key)!;
  },
};
