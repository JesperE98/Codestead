/// <reference types="vite/client" />
// What a scene needs from the browser, in one place so that the tests (jsdom: no WebGL, no IntersectionObserver) can
// say what they want: whether WebGL works, the engine, and whether the learner prefers reduced motion.

import type { MountScene } from "./EngineApi.js";

// The engine and three.js are a chunk of their own, loaded the first time a scene comes near the screen. A glob import
// (not import("../engine/mount.js")) keeps the engine out of the workspace's type check: it is the visualizer's code,
// checked with its own compiler options (the package's tsconfig.json).
const engines = import.meta.glob<{ mountScene: MountScene }>("../engine/mount.ts");

let webglResult: boolean | null = null;

/** Can this window draw WebGL 2 (the visualizer's renderer needs it)? Probed once, with a context freed at once. */
function probeWebgl(): boolean {
  if (webglResult !== null) return webglResult;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    webglResult = gl !== null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglResult = false;
  }
  return webglResult;
}

export const VizEnvironment = {
  /** Whether scenes can run here; false shows every scene's still picture. */
  webgl: (): boolean => {
    if ((globalThis as { __codesteadNoWebgl?: boolean }).__codesteadNoWebgl === true) return false;
    return probeWebgl();
  },
  /** Can the window tell when a scene comes near the screen? Without it (the tests) scenes never start. */
  canObserve: (): boolean => typeof IntersectionObserver === "function",
  /** Loads the engine (three.js, the visualizer's slides). */
  loadEngine: async (): Promise<MountScene> => {
    const load = engines["../engine/mount.ts"];
    if (load === undefined) throw new Error("The scene engine is missing from the build.");
    return (await load()).mountScene;
  },
  reducedMotion: (): boolean => {
    try {
      return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    } catch {
      return false;
    }
  },
};
