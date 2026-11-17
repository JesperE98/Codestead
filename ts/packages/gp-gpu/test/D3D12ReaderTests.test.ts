// D3D12Reader and D3D12Device (no C# test class of their own: the C# tests run the reader through the course – TaskTests,
// SimulatorTests, which belong to gp-course). Two kinds of cases:
// * the finished program (solution/) of a few chapters of every part, read and rendered at 160 pixels as the course's
//   checks do: the frame's pixels must hash as the C# simulator's do (hashes captured from C# for the same projects; the
//   port was compared with C# over every D3D12 start, solution and exercise project, see the gp-gpu port's report);
// * the reader's behaviour on small changes to those programs (the notes it gives, what the device model follows).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { Apis, ClearOp, CullMode, D3D12Reader, GpuProject, NoteLevel, Rasterizer, readerFor, Simulator, Topology, type DrawCall, type Scene } from "../src/index.js";
import { Repo } from "./Repo.js";

/** GpCourse.IsAsset: binary files of a project (images, models), loaded as assets rather than code. */
const isAsset = (path: string): boolean => [".png", ".jpg", ".hdr", ".obj", ".mtl", ".otf", ".ttf", ".gltf", ".bin"].some((e) => path.toLowerCase().endsWith(e));

/** GpCourse.Order: main.cpp first, then headers, then shaders – the order of the editor's tabs. */
function rank(path: string): number {
  if (path.slice(path.lastIndexOf("/") + 1) === "main.cpp") return 0;
  if (path.endsWith(".h")) return 1;
  return path.includes("vert") || path.endsWith(".vs") ? 2 : 3;
}

const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

/** A chapter's D3D12 project folder (start/ or solution/) as the course loads it. */
function load(chapter: string, folder: "start" | "solution" = "solution"): GpuProject {
  const dir = join(Repo.content, "projects", "d3d12", chapter, folder);
  const names = filesUnder(dir).map((f) => relative(dir, f).replaceAll("\\", "/"));
  const text = names.filter((n) => !isAsset(n)).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  const project = new GpuProject(text.map((n) => [n, readFileSync(join(dir, n), "utf8")]));
  for (const n of names.filter(isAsset)) project.assets.set(n, new Uint8Array(readFileSync(join(dir, n))));
  return project;
}

/** A project with main.cpp changed. */
function edited(project: GpuProject, change: (main: string) => string): GpuProject {
  const copy = project.clone();
  const main = copy.files.get("main.cpp")!;
  const changed = change(main);
  expect(changed).not.toBe(main);
  copy.files.set("main.cpp", changed);
  return copy;
}

/** The first 16 hex digits of the SHA-256 of the frame's pixels (as the C# harness printed them). */
const pixelHash = (pixels: Uint8Array): string => createHash("sha256").update(pixels).digest("hex").slice(0, 16).toUpperCase();

const keys = (scene: Scene): string[] => scene.notes.map((n) => n.key);

describe("D3D12Reader: kapitlens färdiga program ritar samma bild som i C#", () => {
  // chapter, the frame at 1 s (160 × 120) as the C# simulator hashes it, the number of draws.
  const cases: [string, string, number][] = [
    ["hello-triangle", "B76DF0599309E792", 1],
    ["textures", "204F615EAA928D89", 1],
    ["coordinate-systems", "EEB19F935B722640", 10],
    ["basic-lighting", "3816D7A4591FD161", 2],
    ["lighting-maps", "24BA32076FA81844", 2],
    ["model", "FCA7487DA3543676", 2],
    ["stencil-testing", "60DAB21F8E523136", 5],
    ["blending", "C4E10FE7EF4AAE17", 8],
    ["framebuffers", "BD6376AA93B0EA3D", 4],
    ["cubemaps", "42352A345009C7C9", 3],
    ["geometry-shader", "F370C8B502DF4570", 4],
    ["anti-aliasing", "D10FE8C7FC323D9D", 2],
    ["gamma-correction", "3B8B7983C6F82F8C", 1],
    ["normal-mapping", "4910F5C1541B5996", 1],
    ["shadow-mapping", "B13BF5B8C9EBEB72", 8],
    ["pbr-theory", "FDCC84924967A070", 49],
    ["debugging", "16FD2C027A188385", 1],
    ["text-rendering", "E0E108F4B1A2794B", 2],
    ["rendering-sprites", "2B1A720C79D02A80", 1],
    ["levels", "402C46B46086C187", 70],
    ["oit-introduction", "144C4C567A5E6900", 3],
    ["weighted-blended", "3EA37B32EA472EFB", 5],
    ["skeletal-animation", "0263F331C5A948F2", 1],
    ["scene-graph", "F7206661968D2A64", 22],
    ["compute-shaders", "750F77ECE2D87F66", 1],
    ["tessellation", "62556BE7EC545EF2", 1],
  ];
  it.each(cases)("%s", (chapter, hash, draws) => {
    const build = Simulator.build(load(chapter), Apis.D3D12);
    expect(build.diagnostics.filter((d) => d.isError).map(String)).toEqual([]);
    const scene = build.scene!;
    expect(scene.notes.filter((n) => n.level !== NoteLevel.Info).map((n) => n.key)).toEqual([]);
    expect(scene.draws.length).toBe(draws);
    const frame = Rasterizer.render(scene, 160);
    expect(frame.errors).toEqual([]);
    expect(pixelHash(frame.pixels)).toBe(hash);
  });
});

describe("D3D12Reader", () => {
  it("läsaren är registrerad för d3d12 (Simulator.read)", () => {
    expect(readerFor(Apis.D3D12)).not.toBeNull();
    const scene = Simulator.read(load("hello-window"), Apis.D3D12, 1.0);
    expect(scene.api).toBe(Apis.D3D12);
    expect(scene.windowCreated).toBe(true);
  });

  it("utan main finns inget program att köra", () => {
    const scene = D3D12Reader.read(new GpuProject([["main.cpp", "int x = 1;\n"]]));
    expect(scene.notes.map((n) => [n.key, n.level])).toEqual([["noMain", NoteLevel.Error]]);
    expect(scene.windowCreated).toBe(false);
  });

  it("utan fönsterklass och fönster: inget fönster", () => {
    const scene = D3D12Reader.read(new GpuProject([["main.cpp", "int WINAPI wWinMain(HINSTANCE h, HINSTANCE, PWSTR, int) { return 0; }\n"]]));
    expect(keys(scene)).toEqual(["noWindow"]);
    expect(scene.windowCreated).toBe(false);
  });

  it("Hello Window: fönstret, dess storlek från swap chain, rensfärgen och loggen", () => {
    const scene = D3D12Reader.read(load("hello-window"));
    expect(scene.windowCreated).toBe(true);
    expect(scene.windowTitle).toBe("LearnDirectX");
    expect([scene.width, scene.height]).toEqual([800, 600]);
    expect(scene.renderLoop && scene.presents && scene.showsFrames).toBe(true);
    expect(scene.clearColor).toEqual([0.2, 0.3, 0.3, 1]);
    expect(scene.draws).toEqual([]);
    expect(scene.notes).toEqual([]);
    expect(scene.log).toEqual(["D3D12: debug layer enabled", "D3D12CreateDevice: S_OK (Codestead Virtual GPU, simulated)"]);
  });

  it("swap chain-beskrivningens bredd och höjd är fönstrets", () => {
    const scene = D3D12Reader.read(edited(load("hello-window"), (m) => m.replace("swapChainDesc.Width = m_width;", "swapChainDesc.Width = 640;")
      .replace("swapChainDesc.Height = m_height;", "swapChainDesc.Height = 480;")));
    expect([scene.width, scene.height]).toEqual([640, 480]);
  });

  it("varje saknad del av kedjan enhet – kö – swap chain ger sitt besked och stoppar läsningen", () => {
    const window = load("hello-window");
    const without = (call: string): string[] => keys(D3D12Reader.read(edited(window, (m) => m.replaceAll(call + "(", call + "_removed("))));
    expect(without("D3D12CreateDevice")).toEqual(["dxNoDevice"]);
    expect(without("CreateCommandQueue")).toEqual(["dxNoQueue"]);
    expect(without("CreateSwapChainForHwnd")).toEqual(["dxNoSwapChain"]);
    expect(without("ExecuteCommandLists")).toEqual(["dxNoExecute"]);
    expect(without("Present")).toEqual(["dxNoPresent"]);
  });

  it("utan barriärer klagar debuglagret (SimulatorTests: DirectX 12)", () => {
    const scene = D3D12Reader.read(edited(load("introduction"), (m) => m.replace(/m_commandList->ResourceBarrier\([^;]*;/g, "")));
    expect(scene.notes.find((n) => n.key === "dxNoBarriers")?.level).toBe(NoteLevel.Error);
  });

  it("en kommandolista som aldrig stängs", () => {
    const scene = D3D12Reader.read(edited(load("introduction"), (m) => m.replaceAll("->Close()", "->Closed()")));
    expect(keys(scene)).toContain("dxListNotClosed");
  });

  it("Hello Triangle: hörnen läses ur uppladdningsbufferten, indexen ur indexbufferten", () => {
    const scene = D3D12Reader.read(load("hello-triangle"));
    expect(scene.draws.length).toBe(1);
    const d = scene.draws[0]!;
    expect([d.hlsl, d.vertexEntry, d.fragmentEntry, d.topology, d.cull, d.frontCcw]).toEqual([true, "VSMain", "PSMain", Topology.Triangles, CullMode.Back, false]);
    expect(d.vertices.length).toBe(4);
    expect(d.vertices[0]!.get("POSITION0")!.v).toEqual([0.5, 0.5, 0]);
    expect(d.vertices[3]!.get("POSITION0")!.v).toEqual([-0.5, 0.5, 0]);
    expect(d.indices!.length).toBe(6);
    expect(d.count).toBe(6);
    // The clear before the draw is the window's (and the frame's clear colour).
    expect(scene.ops.map((o) => o instanceof ClearOp && o.target === null && o.beforeDraw === 0)).toEqual([true]);
  });

  it("utan topologi ritas inget", () => {
    const scene = D3D12Reader.read(edited(load("introduction"), (m) => m.replace(/m_commandList->IASetPrimitiveTopology\([^;]*;/g, "")));
    expect(keys(scene)).toContain("dxNoTopology");
    expect(scene.draws).toEqual([]);
  });

  it("en shaderfil som saknas", () => {
    const project = load("introduction");
    project.files.delete("shaders.hlsl");
    const scene = D3D12Reader.read(project);
    expect(scene.notes.map((n) => [n.key, [...n.args]])).toContainEqual(["shaderFileMissing", [["file", "shaders.hlsl"]]]);
  });

  it("flera pipeline state objects: varje ritning använder den som sattes före den (Basic Lighting: föremålet och lampan)", () => {
    const project = load("basic-lighting");
    const scene = D3D12Reader.read(project);
    expect(scene.draws.length).toBe(2);
    const [cube, lamp] = scene.draws as [DrawCall, DrawCall];
    expect(cube.fragmentShader).not.toBe(lamp.fragmentShader);
    expect(cube.fragmentShader.source).toBe(project.find("basic_lighting.hlsl"));
    expect(lamp.fragmentShader.source).toBe(project.find("light_cube.hlsl"));
    expect([cube.depthTest, cube.cull, cube.count]).toEqual([true, CullMode.None, 36]);
    expect(scene.animated).toBe(true);
  });

  it("Framebuffers: enhetsmodellen följer render target-vyerna – tre ritningar i texturen, en i fönstret", () => {
    const scene = D3D12Reader.read(load("framebuffers"));
    expect(scene.draws.map((d) => d.target)).toEqual(["res:10", "res:10", "res:10", null]);
    const target = scene.targets.get("res:10")!;
    expect([target.width, target.height, target.colorAttachments, target.depth, target.float]).toEqual([800, 600, 1, true, false]);
    const ops = scene.ops.map((o) => (o instanceof ClearOp ? [o.beforeDraw, o.target, o.color, o.depth] : null));
    expect(ops).toEqual([[0, "res:10", [0.1, 0.1, 0.1, 1], null], [0, "res:10", null, 1], [3, null, [1, 1, 1, 1], null]]);
    // The quad samples the texture through its descriptor table: the device's textures, with their sizes.
    const quad = scene.draws[3]!;
    expect([quad.textures !== null, quad.textureImages !== null, quad.depthTest]).toEqual([true, true, false]);
  });

  it("Debugging: debuglagret rapporterar en SRV utan mipnivåer (#31) och tabeller utan descriptor heap (#708), med objektens namn", () => {
    // The chapter's finished program with its two mistakes put back; the log is what the C# simulator prints for it.
    const scene = D3D12Reader.read(edited(load("debugging"), (m) => m.replace("m_commandList->SetDescriptorHeaps(_countof(ppHeaps), ppHeaps);", "")
      .replace("srvDesc.Texture2D.MipLevels = 1;", "")));
    const heap708 = (handle: string): string => `CGraphicsCommandList::SetGraphicsRootDescriptorTable: The descriptor heap (0x0000020B6E3C4F10:'CBV/SRV heap') containing handle 0x${handle} is different from currently set descriptor heap 0x0000000000000000:'(nullptr)'.`;
    const srv31 = "ID3D12Device::CreateShaderResourceView: The Dimensions of the View are invalid due to at least one of the following conditions. MostDetailedMip (value = 0) must be between 0 and MipLevels-1 of the Texture Resource, 0, inclusively. With the current MostDetailedMip, MipLevels (value = 0) must be between 1 and 1, inclusively, or -1 to default to all mips from MostDetailedMip, in order that the View fit on the Texture.";
    expect(scene.log).toEqual([
      "D3D12: debug layer enabled",
      "D3D12CreateDevice: S_OK (Codestead Virtual GPU, simulated)",
      "---------------", `Debug message (31): ${srv31}`, "Category: State creation", "Severity: ERROR", "",
      `ERROR #31: ${srv31} | main.cpp (547)`,
      "---------------", `Debug message (708): ${heap708("0000020B6E5B3000")}`, "Category: Execution", "Severity: ERROR", "",
      "---------------", `Debug message (708): ${heap708("0000020B6E5B3020")}`, "Category: Execution", "Severity: ERROR", "",
      `ERROR #708: ${heap708("0000020B6E5B3000")} | main.cpp (655)`,
      `ERROR #708: ${heap708("0000020B6E5B3020")} | main.cpp (655)`,
    ]);
    // Tables set without a heap: the draw sees nothing and is left out.
    expect(scene.draws).toEqual([]);
  });

  it("Compute Shaders: Dispatch skriver texturen som ritningen sedan samplar", () => {
    const scene = D3D12Reader.read(load("compute-shaders"));
    expect(scene.draws.length).toBe(1);
    const frame = Rasterizer.render(scene, 40);
    // Something other than the clear colour is drawn: the texture the compute shader filled.
    const clear = scene.clearColor!.map((c) => Math.round(c * 255));
    let drawn = 0;
    for (let i = 0; i < frame.pixels.length; i += 4) if (Math.abs(frame.pixels[i]! - clear[0]!) + Math.abs(frame.pixels[i + 1]! - clear[1]!) + Math.abs(frame.pixels[i + 2]! - clear[2]!) > 12) drawn++;
    expect(drawn).toBeGreaterThan(100);
  });
});
