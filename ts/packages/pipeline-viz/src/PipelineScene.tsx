// One of the Render Pipeline Visualizer's scenes in a chapter: the slide's visual, live, with the learner stepping
// through its steps (buttons, dots, ← → Home End when it has the focus), playing a step again, changing the model and
// the mode, and showing the API's code for the step. It follows the window's API, language and theme.
//
// The engine (three.js and the slides, a chunk of its own) is loaded when the first scene comes near the screen. A
// scene runs only near the screen and pauses out of sight; a few run at once (SceneBudget). Where WebGL is missing or
// the scene fails, the still picture (`fallback`) is shown instead, as before scenes could run.

import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { EngineOptions, MountedScene, VizApi, VizLang, VizMode, VizModel, VizTheme } from "./EngineApi.js";
import { VizModels } from "./EngineApi.js";
import { VizEnvironment } from "./Environment.js";
import { type BudgetEntry, sceneBudget } from "./SceneBudget.js";
import { clampStep, slideStep, stepCount, stepForKey } from "./SceneSteps.js";
import type { SceneSpec } from "./Scenes.js";
import "./PipelineScene.css";

/** The texts of a scene's controls, in the window's language. */
export interface VizTexts {
  prev: string;
  next: string;
  replay: string;
  code: string;
  /** "Step {n} of {total}" with the numbers filled in by `stepLabel`. */
  stepLabel: (n: number, total: number) => string;
  loading: string;
  /** The button of a scene stopped to let others run. */
  start: string;
  model: string;
  modeData: string;
  modeConcept: string;
  models: Readonly<Record<VizModel, string>>;
}

export interface PipelineSceneProps {
  /** The scene's slide and steps, and the model and mode it starts with. */
  spec: SceneSpec;
  model?: VizModel;
  mode?: VizMode;
  /** The scene's name (for tests and the e2e: data-scene). */
  name?: string;
  /** What the scene shows (the picture's alt text). */
  alt: string;
  api: VizApi;
  lang: VizLang;
  theme: VizTheme;
  texts: VizTexts;
  /** The still picture where the scene cannot run. */
  fallback: ReactNode;
}

/** idle: not started (or stopped out of sight); parked: stopped to make room, until it comes near again or is asked for. */
type Status = "idle" | "parked" | "loading" | "live" | "fallback";

/** How long a scene that left the screen's neighbourhood keeps running (scrolling back is instant). */
const StopDelayMs = 4000;

export function PipelineScene(props: PipelineSceneProps) {
  const { spec, api, lang, theme, texts } = props;
  const [model, setModel] = useState<VizModel>(props.model ?? spec.model);
  const [mode, setMode] = useState<VizMode>(props.mode ?? spec.mode);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<Status>(() => (VizEnvironment.canObserve() && !VizEnvironment.webgl() ? "fallback" : "idle"));
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [stepHtml, setStepHtml] = useState("");
  const [title, setTitle] = useState("");
  const [codeOn, setCodeOn] = useState(false);
  const [hasCode, setHasCode] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const stageHost = useRef<HTMLDivElement>(null);
  const codeHost = useRef<HTMLDivElement>(null);
  const scene = useRef<MountedScene | null>(null);
  const generation = useRef(0);
  const options: EngineOptions = { slide: spec.slide, api, lang, theme, mode, model };
  const latest = useRef({ options, step, visible, codeOn });
  latest.current = { options, step, visible, codeOn };
  const total = stepCount(spec);

  /** Reads what the scene shows now (the step's text, the title, whether it has code). */
  const refresh = useCallback(
    (s: MountedScene) => {
      setStepHtml(s.stepHtml(slideStep(spec, latest.current.step)));
      setTitle(s.title);
      setHasCode(s.showCode(latest.current.codeOn));
    },
    [spec],
  );

  const entry = useRef<BudgetEntry>({ visible: false, evict: () => {} });
  const stop = useCallback((next: Status = "idle") => {
    generation.current++;
    const s = scene.current;
    scene.current = null;
    s?.destroy();
    sceneBudget.release(entry.current);
    setStatus((cur) => (cur === "fallback" ? cur : next));
    // (A scene that failed stays a picture.)
  }, []);

  entry.current.evict = () => stop("parked");

  // Near the screen (start), on screen (run, not paused).
  useEffect(() => {
    const el = root.current;
    if (!el || !VizEnvironment.canObserve()) return;
    const nearIo = new IntersectionObserver((list) => setNear(list.some((e) => e.isIntersecting)), { rootMargin: "300px 0px" });
    const visibleIo = new IntersectionObserver(
      (list) => {
        const on = list.some((e) => e.isIntersecting);
        entry.current.visible = on;
        setVisible(on);
      },
      { threshold: 0 },
    );
    nearIo.observe(el);
    visibleIo.observe(el);
    return () => {
      nearIo.disconnect();
      visibleIo.disconnect();
    };
  }, []);

  // Start when near; stop a while after leaving.
  useEffect(() => {
    if (status === "fallback") return;
    if (near && status === "idle") {
      if (!VizEnvironment.webgl()) {
        setStatus("fallback");
        return;
      }
      if (!sceneBudget.acquire(entry.current)) {
        setStatus("parked");
        return;
      }
      const gen = ++generation.current;
      setStatus("loading");
      const { options: o, step: st } = latest.current;
      const fail = (err: unknown) => {
        if (gen !== generation.current) return;
        console.warn("A scene of the pipeline visualizer could not run; showing its picture", err);
        stop("fallback");
      };
      VizEnvironment.loadEngine()
        .then((mount) => {
          if (gen !== generation.current || !stageHost.current || !codeHost.current) throw new Error("superseded");
          return mount({ stage: stageHost.current, code: codeHost.current }, o, slideStep(spec, st), !VizEnvironment.reducedMotion(), () => fail(new Error("WebGL context lost")));
        })
        .then((s) => {
          if (gen !== generation.current) {
            s.destroy();
            return;
          }
          scene.current = s;
          // Changed while it was loading: the options, or the step (with the keyboard).
          const now = latest.current;
          if (JSON.stringify(now.options) !== JSON.stringify(o)) s.rebuild(now.options, slideStep(spec, now.step), false);
          else if (now.step !== st) s.show(slideStep(spec, now.step), false);
          s.setPaused(!now.visible);
          refresh(s);
          setStatus("live");
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.message === "superseded") return;
          fail(err);
        });
      return;
    }
    if (!near && (status === "live" || status === "loading")) {
      const timer = setTimeout(() => stop(), StopDelayMs);
      return () => clearTimeout(timer);
    }
    return;
  }, [near, status, spec, refresh, stop]);

  // Paused out of sight.
  useEffect(() => {
    entry.current.visible = visible;
    scene.current?.setPaused(!visible);
  }, [visible, status]);

  // A parked scene starts again when it comes into sight anew (or near the screen anew, see the IntersectionObservers).
  useEffect(() => {
    if (visible) setStatus((cur) => (cur === "parked" ? "idle" : cur));
  }, [visible]);
  useEffect(() => {
    if (!near) setStatus((cur) => (cur === "parked" ? "idle" : cur));
  }, [near]);

  // Built again for another API, language, theme, model or mode.
  const key = `${api}|${lang}|${theme}|${model}|${mode}`;
  const built = useRef(key);
  useEffect(() => {
    const s = scene.current;
    if (built.current === key || !s || status !== "live") {
      built.current = key;
      return;
    }
    built.current = key;
    s.rebuild(latest.current.options, slideStep(spec, latest.current.step), false);
    refresh(s);
  }, [key, status, spec, refresh]);

  // Stopped when the chapter goes away.
  useEffect(() => () => stop(), [stop]);

  const go = (index: number, animate = true) => {
    const i = clampStep(spec, index);
    setStep(i);
    latest.current.step = i;
    const s = scene.current;
    if (!s) return;
    sceneBudget.touch(entry.current);
    s.show(slideStep(spec, i), animate && !VizEnvironment.reducedMotion());
    refresh(s);
  };

  const replay = () => {
    const s = scene.current;
    if (!s) return;
    sceneBudget.touch(entry.current);
    s.rebuild(latest.current.options, slideStep(spec, step), true);
    refresh(s);
  };

  const toggleCode = () => {
    const on = !codeOn;
    setCodeOn(on);
    latest.current.codeOn = on;
    if (scene.current) setHasCode(scene.current.showCode(on));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
    const next = stepForKey(spec, step, e.key);
    if (next === null) return;
    e.preventDefault();
    if (next !== step) go(next);
  };

  if (status === "fallback")
    return (
      <div className="cs-viz cs-viz-fallback" data-state="fallback" data-scene={props.name}>
        {props.fallback}
      </div>
    );

  const live = status === "live";
  return (
    <div
      ref={root}
      className="cs-viz"
      data-state={status}
      data-scene={props.name}
      data-step={step + 1}
      data-theme={theme}
      role="group"
      aria-label={props.alt}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="cs-viz-stage">
        <div ref={stageHost} className="cs-viz-host" />
        {!live && (
          <div className="cs-viz-wait">
            {status === "loading" ? (
              texts.loading
            ) : status === "parked" ? (
              <button type="button" className="cs-viz-btn" onClick={() => setStatus("idle")}>
                {"▶ " + texts.start}
              </button>
            ) : null}
          </div>
        )}
      </div>
      <div className="cs-viz-bar">
        <button type="button" className="cs-viz-btn" onClick={() => go(step - 1)} disabled={!live || step === 0} aria-label={texts.prev} title={texts.prev}>
          ◀
        </button>
        <div className="cs-viz-dots">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              className={"cs-viz-dot" + (i <= step ? " on" : "") + (i === step ? " current" : "")}
              aria-label={texts.stepLabel(i + 1, total)}
              aria-current={i === step ? "step" : undefined}
              disabled={!live}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button type="button" className="cs-viz-btn" onClick={() => go(step + 1)} disabled={!live || step === total - 1} aria-label={texts.next} title={texts.next}>
          ▶
        </button>
        <span className="cs-viz-count">{texts.stepLabel(step + 1, total)}</span>
        <button type="button" className="cs-viz-btn" onClick={replay} disabled={!live} aria-label={texts.replay} title={texts.replay}>
          ↻
        </button>
        <span className="cs-viz-title">{title}</span>
        <select className="cs-viz-model" aria-label={texts.model} title={texts.model} value={model} onChange={(e) => setModel(e.target.value as VizModel)}>
          {VizModels.map((m) => (
            <option key={m} value={m}>
              {texts.models[m]}
            </option>
          ))}
        </select>
        <div className="cs-viz-seg" role="group">
          <button type="button" aria-pressed={mode === "data"} onClick={() => setMode("data")}>
            {texts.modeData}
          </button>
          <button type="button" aria-pressed={mode === "concept"} onClick={() => setMode("concept")}>
            {texts.modeConcept}
          </button>
        </div>
        <button type="button" className="cs-viz-btn cs-viz-code-btn" aria-pressed={codeOn} onClick={toggleCode} disabled={live && !hasCode}>
          {"{ } " + texts.code}
        </button>
      </div>
      {/* The step's text, from the visualizer (its own HTML: <b>, <code>). */}
      <div className="cs-viz-step" aria-live="polite" dangerouslySetInnerHTML={{ __html: stepHtml }} />
      <div ref={codeHost} className="cs-viz-code" hidden={!codeOn} />
    </div>
  );
}
