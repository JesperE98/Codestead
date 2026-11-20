import { describe, expect, it } from "vitest";
import { clampStep, isVizSource, parseVizSource, SceneBudget, Scenes, slidePlaces, slideStep, stepCount, stepForKey, scenePicture } from "../src/index.js";

describe("VizSource", () => {
  it("viz:<scen> ger scenens bild, steg, modell och läge", () => {
    const p = parseVizSource("viz:buffers")!;
    expect(p.name).toBe("buffers");
    expect(p.spec).toBe(Scenes.buffers);
    expect([p.spec.slide, p.spec.first, p.spec.last]).toEqual(["buffers", 1, 5]);
    expect([p.model, p.mode]).toEqual(["triangle", "data"]);
    expect(p.picture).toBe("images/viz-buffers.webp");
  });

  it("en annan modell eller ett annat läge efter ?", () => {
    const p = parseVizSource("viz:indices?model=teapot&mode=concept")!;
    expect([p.spec.slide, p.model, p.mode]).toEqual(["input-assembly", "teapot", "concept"]);
  });

  it("varje slide visas i den första scenen i kapitlens ordning som visar den", () => {
    const places = slidePlaces([
      { id: "one", text: "Text\n\n![Pic](images/a.webp \"x\")\n\n![Indices](viz:indices \"Indices\")\n\n![Nope](viz:nope)" },
      { id: "two", text: "![Buffers](viz:buffers?model=teapot \"B\")\n\n![Strip](viz:strip)" },
      { id: "three", text: "![Again](viz:buffers)" },
    ]);
    expect(Object.fromEntries(places)).toEqual({
      "input-assembly": { chapter: "one", scene: "indices" },
      buffers: { chapter: "two", scene: "buffers" },
    });
  });

  it("okända scener, modeller, lägen och parametrar är inga scener", () => {
    for (const href of ["viz:nope", "viz:buffers?model=dragon", "viz:buffers?mode=fast", "viz:buffers?steps=2", "images/viz-buffers.webp", "viz:"])
      expect(parseVizSource(href), href).toBeNull();
    expect(isVizSource("viz:anything")).toBe(true);
    expect(isVizSource("images/a.webp")).toBe(false);
  });

  it("varje scen har steg inom sin slide och en stillbild med sitt namn", () => {
    for (const [name, spec] of Object.entries(Scenes)) {
      expect(spec.first, name).toBeGreaterThanOrEqual(1);
      expect(spec.last, name).toBeGreaterThanOrEqual(spec.first);
      expect(scenePicture(name as keyof typeof Scenes)).toBe(`images/viz-${name}.webp`);
    }
  });
});

describe("SceneSteps", () => {
  const spec = { first: 2, last: 4 };

  it("scenens steg är slidens steg first..last", () => {
    expect(stepCount(spec)).toBe(3);
    expect([0, 1, 2].map((i) => slideStep(spec, i))).toEqual([1, 2, 3]);
    expect(slideStep(spec, 9)).toBe(3);
    expect(clampStep(spec, -1)).toBe(0);
    expect(stepCount({ first: 4, last: 4 })).toBe(1);
  });

  it("tangenterna stegar inom scenen", () => {
    expect(stepForKey(spec, 0, "ArrowRight")).toBe(1);
    expect(stepForKey(spec, 2, "ArrowRight")).toBe(2);
    expect(stepForKey(spec, 0, "ArrowLeft")).toBe(0);
    expect(stepForKey(spec, 2, "PageUp")).toBe(1);
    expect(stepForKey(spec, 1, "Home")).toBe(0);
    expect(stepForKey(spec, 0, "End")).toBe(2);
    expect(stepForKey(spec, 0, " ")).toBeNull();
    expect(stepForKey(spec, 0, "a")).toBeNull();
  });
});

describe("SceneBudget", () => {
  const entry = (visible: boolean, log: string[], name: string) => {
    const e = { visible, evict: () => log.push(name) };
    return e;
  };

  it("högst max scener kör; den som inte syns stoppas först, annars den som använts längst sedan", () => {
    const log: string[] = [];
    const b = new SceneBudget(2);
    const a = entry(true, log, "a");
    const c = entry(false, log, "c");
    const d = entry(true, log, "d");
    expect(b.acquire(a)).toBe(true);
    expect(b.acquire(c)).toBe(true);
    expect(b.acquire(d)).toBe(true);
    expect(log).toEqual(["c"]); // out of sight, though newer than a
    expect(b.size).toBe(2);
    b.touch(a);
    const e = entry(true, log, "e");
    b.acquire(e);
    expect(log).toEqual(["c", "d"]); // both on screen: d was used longest ago
    expect([b.has(a), b.has(d), b.has(e)]).toEqual([true, false, true]);
    // A scene only near the screen does not stop one on screen.
    expect(b.acquire(entry(false, log, "f"))).toBe(false);
    expect(log).toEqual(["c", "d"]);
    b.release(a);
    expect(b.size).toBe(1);
    expect(new SceneBudget(0).acquire(a)).toBe(false);
  });
});
