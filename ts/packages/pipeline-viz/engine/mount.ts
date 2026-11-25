// The scene engine: one of the visualizer's slides, live in a chapter. Loaded on demand (with three.js) by
// src/PipelineScene.tsx through src/loadEngine.ts.
//
// Each scene has its own shadow roots (the visualizer's stylesheets stay inside), its own WebGL renderer (ThreeStage;
// destroy() gives the context back at once) and its own tween context (engine/tween.ts), so that pausing or removing a
// scene stops everything it started. The slide is laid out at a design size like the visualizer's window and scaled to
// the chapter's width. The models' data (Derived: software renders, layouts) is shared by the scenes and prepared in
// the visualizer's workers when they can start (they fall back to the main thread).
//
// In the light theme, a step whose point is light added to the picture (additive blending: added light cannot show on
// white) is drawn as in the dark theme, on a dark stage (DarkSteps). The overview's stages (links to the visualizer's
// other slides) lead to the scene in the course that shows that slide, through the SceneLinks the app gives; a stage
// with no such scene is not a link.

import { setCodeDrawerHost } from '../visualizer/core/codeDrawer';
import { Derived } from '../visualizer/core/derived';
import { reducedMotion } from '../visualizer/core/dom';
import { tr } from '../visualizer/core/i18n';
import type { AppState } from '../visualizer/core/state';
import { builtinMesh, type BuiltinId } from '../visualizer/model/builtins';
import { SLIDES } from '../visualizer/slides';
import type { SlideContext, SlideDef, SlideInstance } from '../visualizer/slides/types';
import { ThreeStage, type StageView } from '../visualizer/views/ThreeStage';
import type { EngineOptions, MountedScene, MountScene, SceneHosts, SceneLinks } from '../src/EngineApi';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { themeOutput, themeScene } from './light';
import { sceneSheets } from './styles';
import { killContext, pauseContext, withContext } from './tween';
import notices from '../THIRD-PARTY-NOTICES.txt?raw';

/** The licences of three.js and highlight.js, shipped in the engine's chunk with their code (MIT, BSD-3-Clause). */
export const thirdPartyNotices: string = notices;

/** The narrowest width a slide is laid out at (narrower scenes are scaled down), and the scenes' height per width. */
export const DesignWidth = 800;
export const Aspect = 0.75;

const derivedByModel = new Map<string, Derived>();

function derivedFor(model: string): Derived {
  let d = derivedByModel.get(model);
  if (!d) {
    d = new Derived(builtinMesh(model as BuiltinId));
    derivedByModel.set(model, d);
  }
  return d;
}

/** The model's data for the API, prepared in the workers (but never waited for long). */
async function prepare(d: Derived, api: EngineOptions['api']): Promise<void> {
  await Promise.race([d.prepare(api).catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
}

/** The steps (0-based) of a slide drawn on a dark stage in the light theme: the blending slide's additive blending. */
const DarkSteps: Readonly<Record<string, readonly number[]>> = { blending: [3] };

/** The visualizer's event for "go to another slide" (the overview's stages dispatch it on window with the slide's index). */
const GoEvent = 'rpv:go';

interface StageInternals {
  frame(): void;
  composer?: { dispose(): void; passes?: unknown[] };
  bloomPass?: { enabled: boolean };
}

class Scene implements MountedScene {
  private readonly stageRoot: ShadowRoot;
  private readonly codeRoot: ShadowRoot;
  private readonly frame: HTMLElement;
  private readonly inner: HTMLElement;
  private readonly codeFrame: HTMLElement;
  private readonly codeHost: HTMLElement;
  private readonly stage: ThreeStage;
  private readonly def: SlideDef;
  private instance: SlideInstance | null = null;
  private readonly ro: ResizeObserver;
  private paused = false;
  private destroyed = false;
  /** The tween context of the current slide instance. */
  private tweens: object = {};
  /** The geometries and textures this scene's renderer drew (see releaseShared). */
  private readonly drawn = new Set<{ dispatchEvent(e: { type: 'dispose' }): void }>();
  /** The view on the stage now (its bloom). */
  private view: StageView | null = null;
  /** The step shown is drawn on a dark stage (DarkSteps). */
  private darkStage = false;
  /** While a click in this scene is handled: the slide it asks to go to, through `rpv:go` (see wireLinks). */
  private onGo: ((slide: string) => void) | null = null;

  constructor(
    private readonly hosts: SceneHosts,
    private options: EngineOptions,
    private readonly onLost: () => void,
    private readonly links: SceneLinks | null,
  ) {
    const def = SLIDES.find((s) => s.id === options.slide);
    if (!def) throw new Error(`No slide "${options.slide}" in the visualizer.`);
    this.def = def;
    this.stage = new ThreeStage();
    const renderer = this.stage.renderer;
    if (!renderer) throw new Error('WebGL is not available.');
    renderer.domElement.addEventListener('webglcontextlost', () => {
      if (!this.destroyed) this.onLost();
    });

    this.stageRoot = hosts.stage.shadowRoot ?? hosts.stage.attachShadow({ mode: 'open' });
    this.codeRoot = hosts.code.shadowRoot ?? hosts.code.attachShadow({ mode: 'open' });
    this.inner = document.createElement('div');
    this.inner.className = 'rpv-stage';
    this.frame = document.createElement('div');
    this.frame.className = 'rpv';
    this.frame.append(this.inner);
    this.codeHost = document.createElement('div');
    this.codeFrame = document.createElement('div');
    this.codeFrame.className = 'rpv rpv-codebox';
    this.codeFrame.append(this.codeHost);
    this.codeFrame.hidden = true;
    this.stageRoot.replaceChildren(this.frame);
    this.codeRoot.replaceChildren(this.codeFrame);
    this.applyTheme();

    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(hosts.stage);
    this.layout();
    this.wrapAttach();
    this.frame.addEventListener('click', this.onClick, true);
    window.addEventListener(GoEvent, this.onGoEvent);
  }

  get slideSteps(): number {
    return this.def.steps;
  }

  get title(): string {
    return tr(this.def.title, this.options.lang);
  }

  /** A click on one of the slide's links (in the capture phase, before the link's own handler dispatches `rpv:go`). */
  private readonly onClick = (e: Event): void => {
    const link = (e.target as Element | null)?.closest?.('[data-cs-link]');
    if (!link) return;
    const slide = (link as HTMLElement).dataset.csLink!;
    // The slide's own handler would dispatch rpv:go for the visualizer's window, which is not here.
    e.stopPropagation();
    this.links?.go(slide);
  };

  /** `rpv:go` from this scene's slide, while onGo listens (see wireLinks). */
  private readonly onGoEvent = (e: Event): void => {
    const i = (e as CustomEvent<number>).detail;
    const slide = SLIDES[i]?.id;
    if (this.onGo && slide !== undefined) this.onGo(slide);
  };

  /**
   * The slide's links to other slides (the overview's stages: buttons whose click dispatches `rpv:go`): each is asked,
   * by a click while this scene listens, which slide it leads to. The ones the course has a scene for become links
   * (data-cs-link, followed by onClick); the others are no longer buttons one can press.
   */
  private wireLinks(root: HTMLElement): void {
    for (const chip of root.querySelectorAll<HTMLButtonElement>('button.ov-chip')) {
      let slide: string | null = null;
      this.onGo = (s) => (slide = s);
      try {
        chip.click();
      } finally {
        this.onGo = null;
      }
      if (slide !== null && this.links?.has(slide)) {
        chip.dataset.csLink = slide;
        chip.title = this.links.title(slide);
      } else {
        chip.disabled = true;
        chip.removeAttribute('title');
        chip.classList.add('cs-no-link');
      }
    }
  }

  private applyTheme(): void {
    const o = this.options;
    for (const el of [this.frame, this.codeFrame]) Object.assign(el.dataset, { api: o.api, mode: o.mode, theme: o.theme });
    this.stageRoot.adoptedStyleSheets = sceneSheets(o.theme);
    this.codeRoot.adoptedStyleSheets = sceneSheets(o.theme);
  }

  /** The slide at its design size, scaled to the host's width. */
  private layout(): void {
    const width = this.hosts.stage.clientWidth;
    if (width === 0) return;
    const design = Math.max(width, DesignWidth);
    const scale = width / design;
    Object.assign(this.inner.style, { width: `${design}px`, height: `${Math.round(design * Aspect)}px`, transform: scale === 1 ? '' : `scale(${scale})` });
    // Draw at the pixels the scene really gets on screen.
    this.stage.renderer?.setPixelRatio(Math.min(2, (globalThis.devicePixelRatio || 1) * scale));
  }

  /** Every view the slide puts on the stage is themed before it is drawn, and its frames run in the scene's context. */
  private wrapAttach(): void {
    const attach = this.stage.attach.bind(this.stage);
    this.stage.attach = (host: HTMLElement, view: StageView) => {
      const onFrame = view.onFrame;
      const tweens = this.tweens;
      // With reduced motion the idle motion stops (the model's spin, the drifting dust): time stands still for the
      // view's frames. The slides' own steps still play (their tweens take no time then).
      const still = reducedMotion();
      view.onFrame = (t, dt) =>
        withContext(tweens, () => {
          onFrame?.(still ? 0 : t, still ? 0 : dt);
          this.themeView(view);
        });
      this.themeView(view);
      this.collect(view);
      this.view = view;
      attach(host, view);
      this.applyBloom();
    };
  }

  private get light(): boolean {
    return this.options.theme === 'light';
  }

  /** The view's materials in the theme's colours (a dark stage keeps the slide's own, without the star field). */
  private themeView(view: StageView): void {
    themeScene(view.scene, this.light && !this.darkStage, this.light);
  }

  /**
   * No glow on a light background (a dark stage has the slide's own). The view still goes through the composer, whose
   * output pass gives the colours the slide was made with (the visualizer's shaders write linear colours) – on a light
   * background as straight colours over the page (themeOutput).
   */
  private applyBloom(): void {
    const internals = this.stage as unknown as StageInternals;
    const bloom = internals.bloomPass;
    const lightStage = this.light && !this.darkStage;
    if (bloom && this.view && this.stage.isAttachedTo(this.view)) bloom.enabled = !!this.view.bloom && !lightStage;
    for (const pass of internals.composer?.passes ?? []) {
      if (pass instanceof OutputPass) themeOutput(pass.material, lightStage);
    }
  }

  /** Whether a step is drawn on a dark stage (in the light theme), and the stage's look for it. */
  private setDarkStage(slideStep: number): void {
    this.darkStage = this.light && (DarkSteps[this.def.id] ?? []).includes(slideStep);
    this.frame.classList.toggle('rpv-dark-stage', this.darkStage);
    if (this.view) this.themeView(this.view);
    this.applyBloom();
  }

  /**
   * Remembers the geometries and textures a view draws. Some live on after the slide (the model's geometry and the glow
   * texture, which the visualizer shares between slides, a slide's cached geometry), and each renderer that draws one
   * hangs a listener on it; releaseShared takes them off.
   */
  private collect(view: StageView): void {
    const add = (v: unknown) => {
      const r = v as { isTexture?: boolean; dispatchEvent?: unknown } | null;
      if (r?.isTexture && typeof r.dispatchEvent === 'function') this.drawn.add(r as never);
    };
    const visit = () =>
      view.scene.traverse((o) => {
        const m = o as { geometry?: { dispatchEvent(e: { type: 'dispose' }): void }; material?: unknown };
        if (m.geometry) this.drawn.add(m.geometry);
        for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) {
          for (const v of Object.values(mat as Record<string, unknown>)) add(v);
          const uniforms = (mat as { uniforms?: Record<string, { value: unknown }> }).uniforms;
          if (uniforms) for (const u of Object.values(uniforms)) add(u?.value);
        }
      });
    const onFrame = view.onFrame;
    let frames = 0;
    // The slides add objects as they play: look again now and then.
    view.onFrame = (t, dt) => {
      if (frames++ % 60 === 0) visit();
      onFrame?.(t, dt);
    };
  }

  /**
   * Gives the shared geometries and textures back: a 'dispose' event makes every renderer drop its copy and its
   * listener (a renderer still running uploads its copy again when it next draws). Without this, every scene that was
   * closed would stay in memory through the listeners on the shared objects.
   */
  private releaseShared(): void {
    for (const r of this.drawn) r.dispatchEvent({ type: 'dispose' });
    this.drawn.clear();
  }

  private context(): SlideContext {
    const o = this.options;
    const derived = derivedFor(o.model);
    const state: AppState = { mesh: derived.mesh, api: o.api, mode: o.mode, lang: o.lang };
    return { state, t: (x) => tr(x, o.lang), stage: this.stage, derived, set: () => {} };
  }

  /** Builds the slide (anew) at `step`. */
  build(step: number, animate: boolean): void {
    this.teardown();
    this.tweens = {};
    const tweens = this.tweens;
    this.view = null;
    this.setDarkStage(Math.max(0, Math.min(this.def.steps - 1, step)));
    setCodeDrawerHost(this.codeHost);
    try {
      this.instance = withContext(tweens, () => this.def.create(this.context()));
    } finally {
      setCodeDrawerHost(document.createElement('div'));
    }
    this.inner.replaceChildren(this.instance.el);
    this.wireLinks(this.instance.el);
    this.show(step, animate);
  }

  show(slideStep: number, animate: boolean): void {
    const inst = this.instance;
    if (!inst) return;
    const s = Math.max(0, Math.min(this.def.steps - 1, slideStep));
    this.setDarkStage(s);
    withContext(this.tweens, () => inst.show(s, animate));
    if (this.paused) pauseContext(this.tweens, true);
  }

  stepHtml(slideStep: number): string {
    const bullet = this.instance?.el.querySelector(`.story .bullet[data-step="${slideStep}"] > span:last-child`);
    return bullet?.innerHTML ?? '';
  }

  rebuild(options: EngineOptions, slideStep: number, animate: boolean): void {
    this.options = options;
    this.applyTheme();
    this.build(slideStep, animate);
  }

  showCode(on: boolean): boolean {
    const has = this.codeHost.childElementCount > 0;
    this.codeFrame.hidden = !(on && has);
    return has;
  }

  setPaused(paused: boolean): void {
    if (paused === this.paused || this.destroyed) return;
    this.paused = paused;
    const renderer = this.stage.renderer;
    const internals = this.stage as unknown as StageInternals;
    renderer?.setAnimationLoop(paused ? null : () => internals.frame());
    pauseContext(this.tweens, paused);
  }

  private teardown(): void {
    killContext(this.tweens);
    const inst = this.instance;
    this.instance = null;
    if (inst) {
      try {
        inst.destroy();
      } catch (err) {
        console.warn('A scene of the pipeline visualizer failed to close', err);
      }
    }
    this.stage.detach();
    this.inner.replaceChildren();
    this.codeHost.replaceChildren();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.ro.disconnect();
    this.frame.removeEventListener('click', this.onClick, true);
    window.removeEventListener(GoEvent, this.onGoEvent);
    this.teardown();
    const renderer = this.stage.renderer;
    if (renderer) {
      renderer.setAnimationLoop(null);
      (this.stage as unknown as StageInternals).composer?.dispose();
      renderer.dispose();
      this.releaseShared();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
    this.stageRoot.replaceChildren();
    this.codeRoot.replaceChildren();
  }
}

export const mountScene: MountScene = async (hosts, options, slideStep, animate, onLost, links) => {
  await prepare(derivedFor(options.model), options.api);
  const scene = new Scene(hosts, options, onLost, links ?? null);
  try {
    scene.build(slideStep, animate);
  } catch (err) {
    scene.destroy();
    throw err;
  }
  return scene;
};
