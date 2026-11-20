// A scene in a chapter is a picture whose source is `viz:<scene>`, alone in its paragraph:
//
//   ![Vertex attributes](viz:input-layout "Vertex attributes: a stride steps from vertex to vertex …")
//
// with the scene's name from Scenes.ts, and optionally another model or mode than the scene's own:
// `viz:buffers?model=teapot&mode=concept`. The alt text and caption are the picture's.

import { type VizMode, type VizModel, VizModels } from "./EngineApi.js";
import { type SceneName, type SceneSpec, Scenes, scenePicture } from "./Scenes.js";

export const VizScheme = "viz:";

export interface VizPlacement {
  readonly name: SceneName;
  readonly spec: SceneSpec;
  readonly model: VizModel;
  readonly mode: VizMode;
  /** The still picture for when the scene cannot run ("images/viz-<scene>.webp"). */
  readonly picture: string;
}

/** Is this picture source a scene (`viz:…`)? */
export function isVizSource(href: string): boolean {
  return href.startsWith(VizScheme);
}

/** The scene a picture source places, or null when it is not one (an unknown scene, model or mode is not one). */
export function parseVizSource(href: string): VizPlacement | null {
  if (!isVizSource(href)) return null;
  const rest = href.slice(VizScheme.length);
  const q = rest.indexOf("?");
  const name = q < 0 ? rest : rest.slice(0, q);
  if (!Object.hasOwn(Scenes, name)) return null;
  const spec: SceneSpec = Scenes[name as SceneName];
  const params = new URLSearchParams(q < 0 ? "" : rest.slice(q + 1));
  for (const key of params.keys()) if (key !== "model" && key !== "mode") return null;
  const model = params.get("model") ?? spec.model;
  const mode = params.get("mode") ?? spec.mode;
  if (!(VizModels as readonly string[]).includes(model) || (mode !== "data" && mode !== "concept")) return null;
  return { name: name as SceneName, spec, model: model as VizModel, mode, picture: scenePicture(name as SceneName) };
}

/** A scene placed in a chapter. */
export interface ScenePlace {
  readonly chapter: string;
  readonly scene: SceneName;
}

const placedScenes = /!\[[^\]]*\]\((viz:[^\s)]+)/g;

/**
 * Where each of the visualizer's slides is shown in the course: the first scene of that slide, in the chapters' order
 * (the overview's stages lead there). Slides no chapter shows are missing.
 */
export function slidePlaces(chapters: Iterable<{ readonly id: string; readonly text: string }>): ReadonlyMap<string, ScenePlace> {
  const places = new Map<string, ScenePlace>();
  for (const { id, text } of chapters)
    for (const m of text.matchAll(placedScenes)) {
      const placement = parseVizSource(m[1]!);
      if (placement !== null && !places.has(placement.spec.slide)) places.set(placement.spec.slide, { chapter: id, scene: placement.name });
    }
  return places;
}
