// @vitest-environment jsdom
// The scene in a chapter without WebGL: a fake engine and a fake IntersectionObserver stand in for the browser's.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type EngineOptions, type MountedScene, PipelineScene, type PipelineSceneProps, Scenes, VizEnvironment, type VizTexts } from "../src/index.js";

const texts: VizTexts = {
  prev: "Previous step",
  next: "Next step",
  replay: "Play again",
  code: "Code",
  stepLabel: (n, total) => `Step ${n} of ${total}`,
  loading: "Loading…",
  start: "Start the scene",
  model: "Model",
  modeData: "Real data",
  modeConcept: "Concept",
  models: { triangle: "Triangle", cube: "Cube", teapot: "Teapot", sphere: "Sphere", torusknot: "Torus knot", ico: "Icosahedron" },
};

/** What the fake engine was asked to do. */
let calls: string[] = [];
let mounted: { options: EngineOptions; step: number } | null = null;
let observers: { cb: IntersectionObserverCallback; el: Element | null }[] = [];

class FakeObserver {
  private readonly entry: { cb: IntersectionObserverCallback; el: Element | null };
  constructor(cb: IntersectionObserverCallback) {
    this.entry = { cb, el: null };
    observers.push(this.entry);
  }
  observe(el: Element) {
    this.entry.el = el;
  }
  disconnect() {
    observers = observers.filter((o) => o !== this.entry);
  }
}

/** Scrolls the scenes into (or out of) view. */
function intersect(on: boolean) {
  for (const o of [...observers]) o.cb([{ isIntersecting: on, target: o.el! } as IntersectionObserverEntry], {} as IntersectionObserver);
}

const original = { ...VizEnvironment };

beforeEach(() => {
  calls = [];
  mounted = null;
  observers = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  VizEnvironment.canObserve = () => true;
  VizEnvironment.webgl = () => true;
  VizEnvironment.reducedMotion = () => false;
  VizEnvironment.loadEngine = async () => async (_hosts, options, step, animate) => {
    mounted = { options, step };
    calls.push(`mount ${options.slide} ${step} ${animate}`);
    const scene: MountedScene = {
      slideSteps: 5,
      title: "Buffers & upload",
      show: (s, a) => void calls.push(`show ${s} ${a}`),
      stepHtml: (s) => `The text of <b>step ${s}</b>`,
      rebuild: (o, s, a) => void calls.push(`rebuild ${o.api} ${o.lang} ${o.theme} ${o.model} ${o.mode} ${s} ${a}`),
      showCode: (on) => {
        calls.push(`code ${on}`);
        return true;
      },
      setPaused: (p) => void calls.push(`paused ${p}`),
      destroy: () => void calls.push("destroy"),
    };
    return scene;
  };
});

afterEach(() => {
  cleanup();
  Object.assign(VizEnvironment, original);
  vi.unstubAllGlobals();
});

const props = (over: Partial<PipelineSceneProps> = {}): PipelineSceneProps => ({
  spec: Scenes.indices, // input-assembly, steps 1-3
  name: "indices",
  alt: "Indices",
  api: "opengl",
  lang: "en",
  theme: "dark",
  texts,
  fallback: <img alt="the still picture" />,
  ...over,
});

async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

describe("PipelineScene", () => {
  it("startar först nära skärmen, stegar med knappar, punkter och tangenter, och stannar när kapitlet går", async () => {
    const { container, unmount } = render(<PipelineScene {...props()} />);
    const root = container.querySelector(".cs-viz")!;
    expect(root.getAttribute("data-state")).toBe("idle");
    expect(calls).toEqual([]);

    act(() => intersect(true));
    await settle();
    expect(root.getAttribute("data-state")).toBe("live");
    expect(mounted!.options).toEqual({ slide: "input-assembly", api: "opengl", lang: "en", theme: "dark", mode: "data", model: "cube" });
    expect(calls[0]).toBe("mount input-assembly 0 true");
    expect(screen.getByText("Buffers & upload")).toBeTruthy();
    expect(container.querySelector(".cs-viz-step")!.innerHTML).toBe("The text of <b>step 0</b>");
    expect(screen.getAllByRole("button", { name: /^Step \d of 3$/ }).length).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(calls).toContain("show 1 true");
    expect(root.getAttribute("data-step")).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Step 3 of 3" }));
    expect(calls).toContain("show 2 true");
    expect((screen.getByRole("button", { name: "Next step" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(root, { key: "Home" });
    expect(calls).toContain("show 0 true");
    fireEvent.keyDown(root, { key: "ArrowRight" });
    expect(root.getAttribute("data-step")).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(calls.at(-2)).toBe("rebuild opengl en dark cube data 1 true");

    fireEvent.click(screen.getByRole("button", { name: "{ } Code" }));
    expect(calls).toContain("code true");
    unmount();
    expect(calls.at(-1)).toBe("destroy");
  });

  it("följer fönstrets API, språk och tema, och elevens modell och läge", async () => {
    const { rerender } = render(<PipelineScene {...props()} />);
    act(() => intersect(true));
    await settle();
    rerender(<PipelineScene {...props({ api: "vulkan", lang: "sv", theme: "light" })} />);
    expect(calls).toContain("rebuild vulkan sv light cube data 0 false");
    fireEvent.change(screen.getByRole("combobox", { name: "Model" }), { target: { value: "teapot" } });
    expect(calls).toContain("rebuild vulkan sv light teapot data 0 false");
    fireEvent.click(screen.getByRole("button", { name: "Concept" }));
    expect(calls).toContain("rebuild vulkan sv light teapot concept 0 false");
  });

  it("pausas utom synhåll; utan rörelse spelas inget upp", async () => {
    VizEnvironment.reducedMotion = () => true;
    render(<PipelineScene {...props()} />);
    act(() => intersect(true));
    await settle();
    expect(calls[0]).toBe("mount input-assembly 0 false");
    act(() => intersect(false));
    expect(calls).toContain("paused true");
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(calls).toContain("show 1 false");
  });

  it("utan WebGL, eller när scenen inte kan köra, visas stillbilden", async () => {
    VizEnvironment.webgl = () => false;
    const { container } = render(<PipelineScene {...props()} />);
    expect(container.querySelector(".cs-viz")!.getAttribute("data-state")).toBe("fallback");
    expect(screen.getByAltText("the still picture")).toBeTruthy();
    cleanup();

    VizEnvironment.webgl = () => true;
    VizEnvironment.loadEngine = async () => async () => {
      throw new Error("no context");
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const second = render(<PipelineScene {...props()} />);
    act(() => intersect(true));
    await settle();
    expect(second.container.querySelector(".cs-viz")!.getAttribute("data-state")).toBe("fallback");
    expect(screen.getByAltText("the still picture")).toBeTruthy();
  });

  it("högst två scener kör samtidigt; den som fick stanna startar när eleven ber om det", async () => {
    render(
      <>
        <PipelineScene {...props({ name: "a" })} />
        <PipelineScene {...props({ name: "b" })} />
        <PipelineScene {...props({ name: "c" })} />
      </>,
    );
    act(() => intersect(true));
    await settle();
    await settle();
    expect(calls.filter((c) => c.startsWith("mount")).length).toBe(2);
    expect(document.querySelectorAll('.cs-viz[data-state="live"]').length).toBe(2);
    expect(document.querySelector('.cs-viz[data-state="parked"]')!.getAttribute("data-scene")).toBe("a");
    fireEvent.click(screen.getByRole("button", { name: "▶ Start the scene" }));
    await settle();
    expect(document.querySelector('.cs-viz[data-scene="a"]')!.getAttribute("data-state")).toBe("live");
    expect(document.querySelectorAll('.cs-viz[data-state="live"]').length).toBe(2);
    expect(calls.filter((c) => c === "destroy").length).toBe(1);
  });
});
