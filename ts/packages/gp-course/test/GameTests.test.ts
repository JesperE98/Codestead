// Codestead GP's achievements (GpAchievements) with the course's rules (GpGame.rules): every achievement can be
// unlocked, and the ones that look at a "Check my code" are not unlocked by near misses. The facts a check gives
// (BuildFacts.from) are tested with small changes to the course's own programs in every API.
import { Apis, Simulator } from "@codestead/gp-gpu";
import { AchievementContext, GameState, ProgressView, SolvedTask } from "@codestead/learning";
import { describe, expect, it } from "vitest";
import { BuildFacts, type BuildFactsInit, CheckContext, Edits, GpAchievements, GpCourse, GpGame } from "../src/index.js";
import { itNeeds } from "./Repo.js";

const noon = new Date(2026, 10, 3, 12, 0, 0);
const rules = GpGame.rules;

interface PInit {
  tasks?: Iterable<string>;
  checkpoints?: number;
  exams?: Record<string, number>;
  complete?: Iterable<string>;
  /** Parts whose optional project is complete. */
  projects?: Iterable<string>;
}

function P(init: PInit = {}): ProgressView {
  const t = [...(init.tasks ?? [])];
  return new ProgressView(t, init.checkpoints ?? 0, new Map(Object.entries(init.exams ?? {})), new Set(init.complete ?? []), t.length, 1000, new Set(init.projects ?? []));
}

/** n task keys: "ch/t0@opengl" … (prefix "ex-" for exercises). */
function keys(n: number, { api = "opengl", prefix = "t" } = {}): string[] {
  return Array.from({ length: n }, (_, i) => `ch/${prefix}${i}@${api}`);
}

function facts(init: BuildFactsInit = {}, names: readonly string[] = []): BuildFacts {
  const f = new BuildFacts({ line: "build", succeeded: true, ...init });
  f.names.push(...names);
  return f;
}

/** A program that runs and shows something: what most of the "your project" checks build on. */
const shown: BuildFactsInit = { succeeded: true, showsFrames: true, drew: true, clearColor: [0.2, 0.3, 0.3, 1], windowWidth: 800, windowHeight: 600, drawnPixels: 2000 };

interface CheckInit {
  p?: ProgressView;
  now?: Date;
  solved?: readonly SolvedTask[];
}

/** One "Check my code" with these facts; the ids of the achievements it unlocked. */
function check(g: GameState, f: BuildFacts | BuildFactsInit, init: CheckInit = {}): string[] {
  const cmd = f instanceof BuildFacts ? f : facts(f);
  return rules.onCommand(g, init.p ?? P(), cmd, "ch", init.solved ?? [], init.now ?? noon).achievements;
}

function part(g: GameState, partId: string): void {
  rules.sync(g, P({ complete: GpCourse.lessonsIn(partId).map((c) => c.id) }), noon);
}

function days(g: GameState, n: number): void {
  for (let i = 0; i < n; i++) rules.onCheckpoint(g, P(), new Date(2026, 10, 3 + i, 12, 0, 0));
}

const examParts = GpCourse.outline.parts.filter((p) => p.hasExam).map((p) => p.id);

/** For every achievement: something that unlocks it. */
const projectParts = GpCourse.outline.parts.filter((p) => p.hasProject).map((p) => p.id);

const witnesses = new Map<string, (g: GameState) => void>([
  ["project-first", (g) => void rules.sync(g, P({ projects: [projectParts[0]!] }), noon)],
  ["project-all", (g) => void rules.sync(g, P({ projects: projectParts }), noon)],
  [
    "project-unaided",
    (g) => {
      const key = `${projectParts[0]!}-project/m1@opengl`;
      g.unaided.push(key);
      rules.sync(g, P({ tasks: [key], projects: [projectParts[0]!] }), noon);
    },
  ],
  ["project-perfect", (g) => void rules.sync(g, P({ exams: { [projectParts[0]!]: 100 }, projects: [projectParts[0]!] }), noon)],
  ["first-task", (g) => void rules.sync(g, P({ tasks: keys(1) }), noon)],
  ["first-chapter", (g) => void rules.sync(g, P({ complete: [GpCourse.lessonsIn("getting-started")[0]!.id] }), noon)],
  ["tasks-25", (g) => void rules.sync(g, P({ tasks: keys(25) }), noon)],
  ["tasks-100", (g) => void rules.sync(g, P({ tasks: keys(100) }), noon)],
  ["tasks-all", (g) => void rules.sync(g, new ProgressView(keys(5), 0, new Map(), new Set(), 5, 5), noon)],
  ...GpCourse.parts.map((id): [string, (g: GameState) => void] => [`part-${id}`, (g) => part(g, id)]),
  ["all-apis", (g) => void rules.sync(g, P({ tasks: Apis.all.map((a) => `ch/t@${a.id}`) }), noon)],
  ["checkpoints-25", (g) => void rules.sync(g, P({ checkpoints: 25 }), noon)],
  ["exercise-first", (g) => void rules.sync(g, P({ tasks: ["hello-triangle/ex-colour@opengl"] }), noon)],
  ["exercises-25", (g) => void rules.sync(g, P({ tasks: [...keys(13, { prefix: "ex-" }), ...keys(12, { api: "vulkan", prefix: "ex-" })] }), noon)],
  ["exam-first", (g) => void rules.onExam(g, P({ exams: { lighting: 80 } }), "lighting", 80, noon)],
  ["exam-perfect", (g) => void rules.onExam(g, P({ exams: { lighting: 100 } }), "lighting", 100, noon)],
  ["exam-all", (g) => void rules.sync(g, P({ exams: Object.fromEntries(examParts.map((p) => [p, 85])) }), noon)],
  ["first-check", (g) => void check(g, { succeeded: false })],
  ["first-build", (g) => void check(g, { succeeded: true })],
  ["first-frame", (g) => void check(g, { succeeded: true, showsFrames: true })],
  ["first-draw", (g) => void check(g, shown)],
  ["first-texture", (g) => void check(g, { ...shown, textured: true })],
  ["first-depth", (g) => void check(g, { ...shown, depthTested: true })],
  ["wireframe", (g) => void check(g, { ...shown, wireframe: true })],
  [
    "builds-100",
    (g) => {
      for (let i = 0; i < 100; i++) check(g, { succeeded: false });
    },
  ],
  ["functions-25", (g) => void check(g, facts({}, Array.from({ length: 25 }, (_, i) => `glFunction${i}`)))],
  ["unaided-10", (g) => void check(g, shown, { p: P({ tasks: keys(10) }), solved: keys(10).map((k) => new SolvedTask(k, false)) })],
  ["streak-3", (g) => days(g, 3)],
  ["streak-7", (g) => days(g, 7)],
  ["streak-30", (g) => days(g, 30)],
  ["magenta", (g) => void check(g, { ...shown, clearColor: [1, 0, 1, 1] })],
  ["night-owl", (g) => void check(g, shown, { p: P({ tasks: keys(1) }), now: new Date(2026, 10, 3, 2, 30, 0), solved: [new SolvedTask("ch/t0@opengl", true)] })],
  ["cornflower", (g) => void check(g, { ...shown, clearColor: [0.392, 0.584, 0.929, 1] })],
  ["tiny", (g) => void check(g, { ...shown, drew: false, drawnPixels: 1 })],
  ["triangles-1m", (g) => void check(g, { ...shown, triangles: 1_000_000 })],
  ["hello-world", (g) => void check(g, { ...shown, windowTitle: "Hello, World!" })],
  ["full-hd", (g) => void check(g, { ...shown, windowWidth: 1920, windowHeight: 1080 })],
  ["new-year", (g) => void check(g, shown, { p: P({ tasks: keys(1) }), now: new Date(2027, 0, 1, 15, 0, 0), solved: [new SolvedTask("ch/t0@opengl", false)] })],
]);

/** Whether one check with these facts (on a fresh state) unlocks an achievement. */
function unlocks(id: string, f: BuildFactsInit, init: CheckInit = {}): boolean {
  return check(new GameState(), f, init).includes(id);
}

describe("GameTests (Codestead GP)", () => {
  it("utmärkelserna har unika id:n och emoji, och ett nytt tillstånd har inga", () => {
    const all = GpAchievements.all;
    expect(new Set(all.map((a) => a.id)).size).toBe(all.length);
    expect(new Set(all.map((a) => a.icon)).size, all.map((a) => a.icon).join(" ")).toBe(all.length);
    for (const a of all) expect(a.id, a.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    const hidden = all.filter((a) => a.hidden).length;
    expect(hidden >= 6 && hidden <= 12, `${hidden} hidden`).toBe(true);
    const g = new GameState();
    rules.sync(g, P(), noon);
    expect(g.achievements.size).toBe(0);
  });

  it.each(GpAchievements.all.map((a) => a.id))("varje utmärkelse kan låsas upp (%s)", (id) => {
    const witness = witnesses.get(id);
    expect(witness !== undefined, `No witness for ${id}`).toBe(true);
    const g = new GameState();
    witness!(g);
    expect(g.achievements.has(id), `${id} was not unlocked; got: ${[...g.achievements.keys()].join(", ")}`).toBe(true);
    const a = rules.find(id)!;
    if (a.counter !== null) {
      const { current, target } = a.counter(new AchievementContext(GpCourse.outline, new GameState(), P(), null, [], noon));
      expect(current < target || target === 0, `${id} counter on a fresh state: ${current}/${target}`).toBe(true);
    }
  });

  it("en vanlig kontroll av kursens program låser inte upp något dolt", () => {
    const got = check(new GameState(), shown);
    expect(got.filter((id) => rules.find(id)!.hidden)).toEqual([]);
  });

  // ---------- near misses ----------

  it("övningar är uppgifter vars id börjar med ex-", () => {
    const g = new GameState();
    rules.sync(g, P({ tasks: ["hello-triangle/draw@opengl", "textures/exercise@opengl", "ex-x/draw@vulkan", ...keys(24, { prefix: "ex-" })] }), noon);
    expect(GpAchievements.exercisesSolved(new AchievementContext(GpCourse.outline, g, P({ tasks: ["ex-x/draw@vulkan", "a/ex-b@d3d12"] }), null, [], noon))).toBe(1);
    expect(g.achievements.has("exercise-first")).toBe(true);
    expect(g.achievements.has("exercises-25")).toBe(false);
    const fresh = new GameState();
    rules.sync(fresh, P({ tasks: ["hello-triangle/draw@opengl", "textures/exercise@opengl", "ex-x/draw@vulkan"] }), noon);
    expect(fresh.achievements.has("exercise-first")).toBe(false);
  });

  it("99 uppgifter räcker inte till 100, ett underkänt prov inte till godkänt", () => {
    const g = new GameState();
    rules.sync(g, P({ tasks: keys(99) }), noon);
    expect(g.achievements.has("tasks-100")).toBe(false);
    rules.onExam(g, P({ exams: { lighting: 79 } }), "lighting", 79, noon);
    expect(g.achievements.has("exam-first")).toBe(false);
    rules.onExam(g, P({ exams: { lighting: 95 } }), "lighting", 95, noon);
    expect(g.achievements.has("exam-first")).toBe(true);
    expect(g.achievements.has("exam-perfect")).toBe(false);
    expect(g.achievements.has("exam-all")).toBe(false);
  });

  it("textur, djuptest och trådmodell kräver att något ritas med dem", () => {
    expect(unlocks("first-texture", shown)).toBe(false);
    expect(unlocks("first-depth", shown)).toBe(false);
    expect(unlocks("wireframe", shown)).toBe(false);
  });

  it.each([
    [[0.2, 0.3, 0.3, 1], false],
    [[0.35, 0.584, 0.929, 1], false],
    [[0.392, 0.584, 0.9, 1], false],
    [[0.39, 0.58, 0.93, 1], true],
    [[100 / 255, 149 / 255, 237 / 255, 1], true],
  ])("kornblått är just kornblått (%j)", (clearColor, expected) => {
    expect(unlocks("cornflower", { ...shown, clearColor })).toBe(expected);
    // A program whose window does not stay open shows no colour at all.
    expect(unlocks("cornflower", { succeeded: true, clearColor })).toBe(false);
  });

  it.each([
    [0, false],
    [1, true],
    [8, true],
    [9, false],
    [2000, false],
  ])("något mikroskopiskt täcker några få pixlar (%i)", (drawnPixels, expected) => {
    expect(unlocks("tiny", { ...shown, drawnPixels })).toBe(expected);
  });

  it("en miljon trianglar, inte en till kort, och bara när de visas", () => {
    expect(unlocks("triangles-1m", { ...shown, triangles: 999_999 })).toBe(false);
    expect(unlocks("triangles-1m", { ...shown, triangles: 1_000_000 })).toBe(true);
    expect(unlocks("triangles-1m", { succeeded: true, triangles: 2_000_000 })).toBe(false);
  });

  it.each([
    [{ windowTitle: "Hello, World!" }, true],
    [{ windowTitle: "hello world" }, true],
    [{ printed: ["Starting…", "Hello, World!"] }, true],
    [{ windowTitle: "LearnOpenGL" }, false],
    [{ windowTitle: "Hello" }, false],
    [{ printed: ["World, hello"] }, false],
    [{ succeeded: false, windowTitle: "Hello, World!" }, false],
  ])("Hello, World! i fönstrets titel eller utskriften (%j)", (f, expected) => {
    expect(unlocks("hello-world", { ...shown, ...f })).toBe(expected);
  });

  it.each([
    [1920, 1080, true],
    [2560, 1440, true],
    [1920, 1079, false],
    [1919, 1200, false],
    [1024, 576, false],
  ])("Full HD är minst 1920 × 1080 (%i × %i)", (windowWidth, windowHeight, expected) => {
    expect(unlocks("full-hd", { ...shown, windowWidth, windowHeight })).toBe(expected);
    expect(unlocks("full-hd", { succeeded: true, windowWidth, windowHeight })).toBe(false);
  });

  it.each([
    [new Date(2027, 0, 1, 0, 5, 0), true, true],
    [new Date(2027, 0, 1, 23, 55, 0), true, true],
    [new Date(2027, 0, 1, 12, 0, 0), false, false],
    [new Date(2026, 11, 31, 23, 59, 0), true, false],
    [new Date(2027, 0, 2, 0, 1, 0), true, false],
  ])("nyårsdagen: en löst uppgift den 1 januari (%s)", (now, solve, expected) => {
    const init: CheckInit = solve ? { now, p: P({ tasks: keys(1) }), solved: [new SolvedTask("ch/t0@opengl", false)] } : { now };
    expect(unlocks("new-year", shown, init)).toBe(expected);
  });

  // ---------- the facts of a real check ----------

  /** The facts of the course's program for a chapter, with some text replaced in its main.cpp. */
  function factsOf(chapter: string, api: string, ...replace: [string, string][]): BuildFacts {
    const project = GpCourse.solutionProject(chapter, api);
    for (const [find, by] of replace) {
      const main = project.pathOf("main.cpp")!;
      const text = project.files.get(main)!;
      expect(text.includes(find), `${api}: "${find}" is not in main.cpp`).toBe(true);
      project.files.set(main, text.replaceAll(find, by));
    }
    return BuildFacts.from(new CheckContext(api, project, Simulator.build(project, api)));
  }

  const titles: Record<string, string> = { opengl: '"LearnOpenGL"', vulkan: '"Vulkan"', d3d12: 'L"LearnDirectX"' };
  const sizes: Record<string, [string, string][]> = {
    opengl: [
      ["SCR_WIDTH = 800", "SCR_WIDTH = 1920"],
      ["SCR_HEIGHT = 600", "SCR_HEIGHT = 1080"],
    ],
    vulkan: [
      ["WIDTH = 800", "WIDTH = 1920"],
      ["HEIGHT = 600", "HEIGHT = 1080"],
    ],
    // The simulator takes Direct3D 12's client area from the swap chain's description.
    d3d12: [
      ["swapChainDesc.Width = m_width;", "swapChainDesc.Width = 1920;"],
      ["swapChainDesc.Height = m_height;", "swapChainDesc.Height = 1080;"],
    ],
  };

  for (const api of Apis.all.map((a) => a.id)) {
    itNeeds([api], `kursens Hello Triangle ger inga dolda fakta (${api})`, () => {
      const f = factsOf("hello-triangle", api);
      expect(f.drew).toBe(true);
      expect(f.textured || f.depthTested || f.wireframe).toBe(false);
      expect(f.triangles).toBe(2);
      expect(f.drawnPixels).toBeGreaterThan(100);
      expect([f.windowWidth, f.windowHeight]).toEqual([800, 600]);
      expect(f.windowTitle).toBe(titles[api]!.replace(/^L?"|"$/g, ""));
    });

    itNeeds([api], `kornblått, Hello, World!, Full HD och något mikroskopiskt i ett riktigt program (${api})`, () => {
      const cornflower = factsOf("hello-triangle", api, ["0.2f, 0.3f, 0.3f, 1.0f", "0.392f, 0.584f, 0.929f, 1.0f"]);
      expect(unlocks("cornflower", cornflower)).toBe(true);
      const hello = factsOf("hello-triangle", api, [titles[api]!, titles[api]!.startsWith("L") ? 'L"Hello, World!"' : '"Hello, World!"']);
      expect(unlocks("hello-world", hello)).toBe(true);
      const big = factsOf("hello-triangle", api, ...sizes[api]!);
      expect(unlocks("full-hd", big)).toBe(true);
      // A rectangle of 8 × 6 window pixels: 4 pixels of the check frame (160 pixels wide).
      const small = factsOf("hello-triangle", api, ["0.5f", "0.01f"]);
      expect(small.drawnPixels, `${small.drawnPixels} pixels`).toBeGreaterThanOrEqual(1);
      expect(unlocks("tiny", small)).toBe(true);
    });

    itNeeds([api], `texturer, djuptest och trådmodell i kursens program (${api})`, () => {
      expect(factsOf("textures", api).textured).toBe(true);
      expect(factsOf("coordinate-systems", api).depthTested).toBe(true);
      const project = GpCourse.solutionProject("hello-triangle", api);
      for (const e of GpCourse.exercises("hello-triangle", api).find((x) => x.id === "ex-wireframe")!.edits) Edits.apply(project, e);
      expect(BuildFacts.from(new CheckContext(api, project, Simulator.build(project, api))).wireframe).toBe(true);
    });
  }

  itNeeds(["opengl"], "ett program som skriver Hello, World! och trianglarna med instanser", () => {
    const hello = factsOf("hello-triangle", "opengl", ["glfwMakeContextCurrent(window);", 'glfwMakeContextCurrent(window); std::cout << "Hello, World!" << std::endl;']);
    expect(hello.printed).toContain("Hello, World!");
    expect(unlocks("hello-world", hello)).toBe(true);
    // The course's asteroid field: 500 rocks and a planet – far from a million.
    const rocks = factsOf("instancing", "opengl");
    expect(rocks.triangles).toBeGreaterThan(10_000);
    expect(rocks.triangles).toBeLessThan(1_000_000);
  });
});
