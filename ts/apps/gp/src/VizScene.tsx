// A scene of the Render Pipeline Visualizer in a chapter (`![alt](viz:<scene> "caption")`, see
// @codestead/pipeline-viz): live, in the chosen API, the window's language and theme; its still picture where it
// cannot run.

import { type MarkdownPicture, AnimatedImage } from "@codestead/ui";
import { PipelineScene, parseVizSource, useAppTheme, type VizApi, type VizModel, VizModels, type VizTexts } from "@codestead/pipeline-viz";
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
    />
  );
}

/** The scene a picture of a chapter places, or null when it is an ordinary picture. */
export function vizScene(host: VizSceneHost, picture: MarkdownPicture): ReactNode | null {
  if (parseVizSource(picture.href) === null) return null;
  return <Scene host={host} picture={picture} />;
}
