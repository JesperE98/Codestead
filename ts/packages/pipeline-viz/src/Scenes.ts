// The scenes a chapter can place (`![alt](viz:<scene> "caption")`): which of the visualizer's slides, which of its
// steps, with which model and in which mode, and the still picture shown where the scene cannot run (no WebGL). The
// pictures are images/[<lang>/]viz-<scene>.webp, captured from the same steps (images/visualizer/make_pictures.py).

import type { VizMode, VizModel } from "./EngineApi.js";

export interface SceneSpec {
  /** The visualizer's slide. */
  readonly slide: string;
  /** The slide's steps the scene shows, 1-based and inclusive (the learner steps between them). */
  readonly first: number;
  readonly last: number;
  /** The model and mode that fit the chapters showing it (the learner can change both). */
  readonly model: VizModel;
  readonly mode: VizMode;
}

export const Scenes = {
  // Hello Window
  present: { slide: "present", first: 1, last: 4, model: "teapot", mode: "concept" },
  commands: { slide: "commands", first: 1, last: 4, model: "teapot", mode: "concept" },
  // Hello Triangle: the chapter's own single triangle, with its real numbers.
  pipeline: { slide: "overview", first: 1, last: 4, model: "triangle", mode: "data" },
  buffers: { slide: "buffers", first: 1, last: 5, model: "triangle", mode: "data" },
  "input-layout": { slide: "input-layout", first: 1, last: 4, model: "triangle", mode: "data" },
  rasterization: { slide: "rasterization", first: 1, last: 3, model: "triangle", mode: "data" },
  indices: { slide: "input-assembly", first: 1, last: 3, model: "cube", mode: "data" },
  // Shaders, Advanced GLSL
  shaders: { slide: "shaders", first: 1, last: 4, model: "triangle", mode: "data" },
  uniforms: { slide: "descriptors", first: 1, last: 4, model: "cube", mode: "data" },
  // Coordinate Systems, Face culling (the chapters draw cubes)
  spaces: { slide: "vertex-shader", first: 1, last: 4, model: "cube", mode: "data" },
  clipping: { slide: "clipping", first: 1, last: 4, model: "cube", mode: "data" },
  viewport: { slide: "viewport-culling", first: 1, last: 1, model: "cube", mode: "data" },
  winding: { slide: "viewport-culling", first: 2, last: 2, model: "cube", mode: "data" },
  culling: { slide: "viewport-culling", first: 3, last: 4, model: "cube", mode: "data" },
  // Depth testing, Blending, Anti-aliasing, Basic lighting
  depth: { slide: "depth", first: 1, last: 4, model: "teapot", mode: "data" },
  blending: { slide: "blending", first: 1, last: 4, model: "teapot", mode: "data" },
  msaa: { slide: "rasterization", first: 4, last: 4, model: "triangle", mode: "data" },
  fragment: { slide: "fragment-shader", first: 1, last: 3, model: "sphere", mode: "data" },
  // Assimp, Tessellation (height map)
  parse: { slide: "parse", first: 1, last: 4, model: "teapot", mode: "data" },
  strip: { slide: "input-assembly", first: 4, last: 4, model: "cube", mode: "data" },
} as const satisfies Record<string, SceneSpec>;

export type SceneName = keyof typeof Scenes;

/** The still picture of a scene (images/viz-<scene>.webp, in the chapter's language when there is one). */
export function scenePicture(name: SceneName): string {
  return `images/viz-${name}.webp`;
}
