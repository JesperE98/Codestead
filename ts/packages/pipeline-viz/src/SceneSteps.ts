// The steps of a scene: the learner steps between the slide steps the scene shows (Scenes.ts: first..last), with the
// buttons, the dots or the keyboard. Pure, tested in test/SceneSteps.test.ts.

import type { SceneSpec } from "./Scenes.js";

/** How many steps the scene has. */
export function stepCount(spec: Pick<SceneSpec, "first" | "last">): number {
  return Math.max(1, spec.last - spec.first + 1);
}

/** The step a step index (0-based, clamped to the scene) is in the slide (0-based, as the engine counts). */
export function slideStep(spec: Pick<SceneSpec, "first" | "last">, index: number): number {
  return spec.first - 1 + clampStep(spec, index);
}

export function clampStep(spec: Pick<SceneSpec, "first" | "last">, index: number): number {
  return Math.max(0, Math.min(stepCount(spec) - 1, Math.trunc(index)));
}

/** What a key does to the step when the scene has the focus: the new step, or null when the key is not the scene's. */
export function stepForKey(spec: Pick<SceneSpec, "first" | "last">, index: number, key: string): number | null {
  const last = stepCount(spec) - 1;
  switch (key) {
    case "ArrowRight":
    case "PageDown":
      return Math.min(last, index + 1);
    case "ArrowLeft":
    case "PageUp":
      return Math.max(0, index - 1);
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}
