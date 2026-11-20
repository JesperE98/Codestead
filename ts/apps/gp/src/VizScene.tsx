// A scene of the Render Pipeline Visualizer in a chapter (`![alt](viz:<scene> "caption")`, see
// @codestead/pipeline-viz): live, in the chosen API, the window's language and theme; its still picture where it
// cannot run. The overview's stages lead to the scene of the course that shows each (revealScene).

import { type MarkdownPicture, AnimatedImage } from "@codestead/ui";
import { PipelineScene, parseVizSource, type SceneLinks, useAppTheme, type VizApi, VizEnvironment, type VizModel, VizModels, type VizTexts } from "@codestead/pipeline-viz";
import type { ReactNode } from "react";

export interface VizSceneHost {
  /** The API the learner chose. */
  readonly api: string;
  /** The window's language. */
  readonly lang: string;
  /** The window's texts. */
  t(key: string, args?: Readonly<Record<string, unknown>>): string;
  /** A picture's URL in the language ("images/viz-buffers.webp"), or null. */
  picture(path: string, lang: string): string | null;
  /** Where the slides' links lead (the overview's stages: to the scene in the course that shows the stage). */
  readonly links: SceneLinks | null;
}

function texts(h: VizSceneHost): VizTexts {
  return {
    prev: h.t("viz.prev"),
    next: h.t("viz.next"),
    replay: h.t("viz.replay"),
    code: h.t("viz.code"),
    stepLabel: (n, total) => h.t("viz.step", { n, total }),
    loading: h.t("viz.loading"),
    start: h.t("viz.start"),
    model: h.t("viz.model"),
    modeData: h.t("viz.modeData"),
    modeConcept: h.t("viz.modeConcept"),
    models: Object.fromEntries(VizModels.map((m) => [m, h.t(`viz.model.${m}`)])) as Record<VizModel, string>,
  };
}

function Scene({ host, picture }: { host: VizSceneHost; picture: MarkdownPicture }) {
  const theme = useAppTheme();
  const placement = parseVizSource(picture.href)!;
  const still = host.picture(placement.picture, host.lang);
  return (
    <PipelineScene
      key={picture.href}
      name={placement.name}
      spec={placement.spec}
      model={placement.model}
      mode={placement.mode}
      alt={picture.alt}
      api={host.api as VizApi}
      // The visualizer speaks Swedish and English.
      lang={host.lang === "sv" ? "sv" : "en"}
      theme={theme}
      texts={texts(host)}
      fallback={still === null ? null : <AnimatedImage source={still} alt={picture.alt} />}
      links={host.links}
    />
  );
}

/** The scene a picture of a chapter places, or null when it is an ordinary picture. */
export function vizScene(host: VizSceneHost, picture: MarkdownPicture): ReactNode | null {
  if (parseVizSource(picture.href) === null) return null;
  return <Scene host={host} picture={picture} />;
}

/** The scenes on screen now (for revealScene: the chapter shown before has its own). */
function scenesNamed(name: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`.cs-viz[data-scene="${CSS.escape(name)}"]`)];
}

/**
 * Scrolls a scene of the chapter into view and gives it the focus (its steps follow the keyboard), once it is on screen:
 * `navigate` shows its chapter first when it is another one (which starts at the top, so the scroll waits for that).
 */
export function revealScene(name: string, navigate: (() => void) | null): void {
  const before = new Set(navigate === null ? [] : scenesNamed(name));
  navigate?.();
  const started = Date.now();
  const look = () => {
    const el = scenesNamed(name).find((e) => !before.has(e));
    if (el === undefined) {
      if (Date.now() - started < 3000) setTimeout(look, 16);
      return;
    }
    // After the new chapter's own scroll to the top (an effect after it is drawn).
    setTimeout(
      () => {
        el.scrollIntoView({ block: "center", behavior: navigate === null && !VizEnvironment.reducedMotion() ? "smooth" : "auto" });
        el.focus({ preventScroll: true });
      },
      navigate === null ? 0 : 60,
    );
  };
  look();
}
