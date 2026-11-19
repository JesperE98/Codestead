// The scene engine: one of the visualizer's slides, live in a chapter. Loaded on demand (with three.js) by
// src/PipelineScene.tsx through src/loadEngine.ts.
//
// Each scene has its own shadow roots (the visualizer's stylesheets stay inside), its own WebGL renderer (ThreeStage;
// destroy() gives the context back at once) and its own tween context (engine/tween.ts), so that pausing or removing a
// scene stops everything it started. The slide is laid out at a design size like the visualizer's window and scaled to
// the chapter's width. The models' data (Derived: software renders, layouts) is shared by the scenes and prepared in
// the visualizer's workers when they can start (they fall back to the main thread).

import { setCodeDrawerHost } from '../visualizer/core/codeDrawer';
import { Derived } from '../visualizer/core/derived';
import { tr } from '../visualizer/core/i18n';
import type { AppState } from '../visualizer/core/state';
import { builtinMesh, type BuiltinId } from '../visualizer/model/builtins';
import { SLIDES } from '../visualizer/slides';
import type { SlideContext, SlideDef, SlideInstance } from '../visualizer/slides/types';
import { ThreeStage, type StageView } from '../visualizer/views/ThreeStage';
import type { EngineOptions, MountedScene, MountScene, SceneHosts } from '../src/EngineApi';
import { themeScene } from './light';
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

interface StageInternals {
  frame(): void;
  composer?: { dispose(): void };
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

  constructor(
    private readonly hosts: SceneHosts,
    private options: EngineOptions,
    private readonly onLost: () => void,
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
  }

  get slideSteps(): number {
    return this.def.steps;
  }

  get title(): string {
    return tr(this.def.title, this.options.lang);
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
      const light = this.options.theme === 'light';
      const onFrame = view.onFrame;
      const tweens = this.tweens;
      view.onFrame = (t, dt) =>
        withContext(tweens, () => {
          onFrame?.(t, dt);
          themeScene(view.scene, light);
        });
      themeScene(view.scene, light);
      attach(host, view);
      // No glow on a light background. The view still goes through the composer, whose output pass gives the colours
      // the slide was made with (the visualizer's shaders write linear colours).
      if (light) {
        const bloom = (this.stage as unknown as StageInternals).bloomPass;
        if (bloom) bloom.enabled = false;
      }
    };
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
    setCodeDrawerHost(this.codeHost);
    try {
      this.instance = withContext(tweens, () => this.def.create(this.context()));
    } finally {
      setCodeDrawerHost(document.createElement('div'));
    }
    this.inner.replaceChildren(this.instance.el);
    this.show(step, animate);
  }

  show(slideStep: number, animate: boolean): void {
    const inst = this.instance;
    if (!inst) return;
    withContext(this.tweens, () => inst.show(Math.max(0, Math.min(this.def.steps - 1, slideStep)), animate));
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
    this.teardown();
    const renderer = this.stage.renderer;
    if (renderer) {
      renderer.setAnimationLoop(null);
      (this.stage as unknown as StageInternals).composer?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
    this.stageRoot.replaceChildren();
    this.codeRoot.replaceChildren();
  }
}

export const mountScene: MountScene = async (hosts, options, slideStep, animate, onLost) => {
  await prepare(derivedFor(options.model), options.api);
  const scene = new Scene(hosts, options, onLost);
  try {
    scene.build(slideStep, animate);
  } catch (err) {
    scene.destroy();
    throw err;
  }
  return scene;
};
