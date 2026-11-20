// What the scene engine (engine/mount.ts, loaded on demand with three.js and the visualizer's slides) offers the React
// side. Only types here, so that the React side and the tests never load the engine.

export type VizApi = "opengl" | "vulkan" | "d3d12";
export type VizLang = "sv" | "en";
export type VizTheme = "light" | "dark";
/** The visualizer's two modes: the model's real numbers, or illustrations of the idea. */
export type VizMode = "data" | "concept";

/** The visualizer's built-in models. */
export const VizModels = ["triangle", "cube", "teapot", "sphere", "torusknot", "ico"] as const;
export type VizModel = (typeof VizModels)[number];

export interface EngineOptions {
  /** The visualizer's slide (its id: "buffers", "input-assembly" …). */
  slide: string;
  api: VizApi;
  lang: VizLang;
  theme: VizTheme;
  mode: VizMode;
  model: VizModel;
}

export interface MountedScene {
  /** The number of steps of the whole slide. */
  readonly slideSteps: number;
  /** Shows a step of the slide (0-based); `animate` plays the way there. */
  show(slideStep: number, animate: boolean): void;
  /** The slide's text for a step (HTML from the visualizer: <b>, <code>), or "" when it has none. */
  stepHtml(slideStep: number): string;
  /** The slide's title. */
  readonly title: string;
  /** Builds the slide again (other options, or to play a step again from the start), at a step. */
  rebuild(options: EngineOptions, slideStep: number, animate: boolean): void;
  /** The API's code for this slide (with the step's lines marked) shown under the scene, or hidden. */
  showCode(on: boolean): boolean;
  /** Stops drawing and animating while the scene is out of sight. */
  setPaused(paused: boolean): void;
  /** Frees everything: the WebGL context first. */
  destroy(): void;
}

/** Where a scene is drawn: the scene itself (an empty element of the size it should have) and its code (any width). */
export interface SceneHosts {
  stage: HTMLElement;
  code: HTMLElement;
}

/**
 * Where the links of a slide lead in the app (the overview's stages: each is one of the visualizer's slides). A stage
 * whose slide `has` no destination is not a link.
 */
export interface SceneLinks {
  /** Does the app have a place for this slide (the scene in the course that shows it)? */
  has(slide: string): boolean;
  /** The link's tooltip: where it leads. */
  title(slide: string): string;
  /** Follows the link. */
  go(slide: string): void;
}

/**
 * Mounts a scene. Rejects when it cannot (no WebGL, the slide failed); `onLost`: it stopped working later (context lost);
 * `links`: where the slide's links lead (none: they are not links).
 */
export type MountScene = (hosts: SceneHosts, options: EngineOptions, slideStep: number, animate: boolean, onLost: () => void, links?: SceneLinks | null) => Promise<MountedScene>;
