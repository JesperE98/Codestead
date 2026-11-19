// The Vulkan reader (VulkanReader*, VulkanDevice*): what it reads from the course's programs, compared with what the C#
// reader and rasterizer make of them, and focused cases of its behaviour.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Apis, CullMode, GlReader, GpuProject, NoteLevel, Rasterizer, Scene, Simulator, Topology } from "../src/index.js";
import { Memory } from "../src/Readers/VulkanDevice.js";
import { VulkanReader } from "../src/Readers/VulkanReader.js";
import { applyEdit, exerciseProject, solutionProject, startProject, tasks } from "./CourseProjects.js";

const api = Apis.Vulkan;

/** SHA-256 of a frame's pixels (the first 16 hex digits), as the C# comparison harness printed it. */
function frameHash(scene: Scene, width = 160, time = 1.0): string {
  const f = Rasterizer.render(scene, width, time);
  expect(f.errors).toEqual([]);
  return `${f.width}x${f.height} ${createHash("sha256").update(f.pixels).digest("hex").slice(0, 16)}`;
}

const notes = (scene: Scene): string[] => scene.notes.map((n) => `${NoteLevel[n.level]} ${n.key}`);

function build(project: GpuProject): Scene {
  const r = Simulator.build(project, api);
  expect(r.succeeded).toBe(true);
  return r.scene!;
}

/** The main.cpp of a project with a piece of text replaced (it must be there). */
function edited(project: GpuProject, from: string | RegExp, to: string): GpuProject {
  const copy = project.clone();
  const text = copy.files.get("main.cpp")!;
  if (typeof from === "string") expect(text).toContain(from);
  else expect(text).toMatch(from);
  copy.files.set("main.cpp", text.replace(from, () => to));
  return copy;
}

// ---------- the course's programs, as C# draws them ----------

/**
 * Frames of the course's Vulkan programs (start, solution, exercise) at 160 pixels wide – and at a later time for the
 * animated ones – with the hashes, draw counts and notes the C# reader and rasterizer gave (see PORTING.md; every Vulkan
 * project and exercise was compared at the times the course's checks use).
 */
const Chapters: { chapter: string; project: string; draws: number; frames: [number, string][]; notes?: string[] }[] = [
  { chapter: "hello-triangle", project: "solution", draws: 1, frames: [[1.0, "160x120 b76df0599309e792"]] },
  { chapter: "hello-triangle", project: "ex-house", draws: 1, frames: [[1.0, "160x120 6c16347253596927"]] },
  { chapter: "shaders", project: "ex-pulse", draws: 1, frames: [[1.0, "160x120 d9a00a2cba4bec05"], [4.0, "160x120 38fdbbc2d8636f60"]] },
  { chapter: "textures", project: "solution", draws: 1, frames: [[1.0, "160x120 fb19229bf8f3563e"]] },
  { chapter: "transformations", project: "solution", draws: 2, frames: [[1.0, "160x120 c5d3f15442df3226"], [4.0, "160x120 9e6fa2215192854b"]] },
  { chapter: "colors", project: "solution", draws: 2, frames: [[1.0, "160x120 9ec31ef2fa5d1ef2"]] },
  { chapter: "lighting-maps", project: "solution", draws: 2, frames: [[1.0, "160x120 24ba32076fa81844"]] },
  { chapter: "mesh", project: "solution", draws: 1, frames: [[1.0, "160x120 18daccd2d8690029"]] },
  { chapter: "model", project: "solution", draws: 1, frames: [[1.0, "160x120 fca7487da3543676"]] },
  { chapter: "depth-testing", project: "solution", draws: 3, frames: [[1.0, "160x120 d554f4ec0d48a9af"]] },
  { chapter: "stencil-testing", project: "solution", draws: 5, frames: [[1.0, "160x120 6106eef6cbd6e688"]] },
  { chapter: "blending", project: "solution", draws: 8, frames: [[1.0, "160x120 894ebc3b7f77c30f"]] },
  { chapter: "geometry-shader", project: "solution", draws: 2, frames: [[1.0, "160x120 f370c8b502df4570"]] },
  { chapter: "anti-aliasing", project: "solution", draws: 2, frames: [[1.0, "160x120 d10fe8c7fc323d9d"]] },
  { chapter: "advanced-lighting", project: "solution", draws: 1, frames: [[1.0, "160x120 07c9582f7f9f4cb6"]] },
  { chapter: "normal-mapping", project: "solution", draws: 1, frames: [[1.0, "160x120 4910f5c1541b5996"]] },
  { chapter: "shadow-mapping", project: "solution", draws: 8, frames: [[1.0, "160x120 b13bf5b8c9ebeb72"]] },
  { chapter: "pbr-theory", project: "solution", draws: 49, frames: [[1.0, "160x120 fdcc84924967a070"]] },
  { chapter: "debugging", project: "start", draws: 1, frames: [[1.0, "160x120 e4ac0f3543d3cd72"]] },
  { chapter: "text-rendering", project: "solution", draws: 35, frames: [[1.0, "160x120 e0e108f4b1a2794b"]] },
  { chapter: "rendering-sprites", project: "solution", draws: 1, frames: [[1.0, "160x120 9676cb1cc6a37249"]] },
  { chapter: "game-intro", project: "solution", draws: 0, frames: [[1.0, "160x120 586f7cc5ba7b3b6f"]] },
  { chapter: "oit-introduction", project: "solution", draws: 3, frames: [[1.0, "160x120 144c4c567a5e6900"]] },
  { chapter: "weighted-blended", project: "solution", draws: 5, frames: [[1.0, "160x120 85278dff8f41bdaf"]] },
  { chapter: "dsa", project: "solution", draws: 1, frames: [[1.0, "160x120 b76df0599309e792"]] },
  { chapter: "tessellation-height-map", project: "solution", draws: 255, frames: [[1.0, "160x120 6af9c5431a3a73ce"]] },
  { chapter: "compute-shaders", project: "solution", draws: 1, frames: [[1.0, "160x120 750f77ece2d87f66"]] },
];

describe("Vulkan-läsaren ger samma bild som C#", () => {
  for (const c of Chapters)
    it(`${c.chapter} ${c.project}`, () => {
      const project = c.project === "start" ? startProject(api, c.chapter) : c.project === "solution" ? solutionProject(api, c.chapter) : exerciseProject(api, c.chapter, c.project);
      const scene = build(project);
      expect(scene.draws.length).toBe(c.draws);
      expect(notes(scene)).toEqual(c.notes ?? []);
      for (const [time, hash] of c.frames) {
        const s = time === 1.0 || !scene.animated || scene.atTime === null ? scene : scene.atTime(time);
        expect(frameHash(s, 160, time)).toBe(hash);
      }
    });
});

// ---------- focused cases ----------

describe("Vulkan-läsaren", () => {
  it("är registrerad: Simulator.read läser ett Vulkan-program", () => {
    const scene = Simulator.read(solutionProject(api, "hello-triangle"), api, 1.0);
    expect(scene.api).toBe(api);
    expect(scene.draws.length).toBe(1);
  });

  it("utan main säger den till", () => {
    const scene = VulkanReader.read(new GpuProject([["main.cpp", "int helper() { return 0; }"]]));
    expect(notes(scene)).toEqual(["Error noMain"]);
    expect(scene.windowCreated).toBe(false);
  });

  it("utan fönster: inget visas", () => {
    const scene = VulkanReader.read(new GpuProject([["main.cpp", "int main() { return 0; }"]]));
    expect(notes(scene)).toEqual(["Info noWindow"]);
    expect(scene.showsFrames).toBe(false);
  });

  it("läser fönstret, loggen och rensningsfärgen", () => {
    const scene = build(solutionProject(api, "hello-window"));
    expect(scene.windowCreated).toBe(true);
    expect([scene.width, scene.height]).toEqual([800, 600]);
    expect(scene.showsFrames).toBe(true);
    expect(scene.log.slice(0, 2)).toEqual(["vkCreateInstance: VK_SUCCESS", "GPU: Codestead Virtual GPU (simulated)"]);
    expect(scene.clearColor).not.toBeNull();
  });

  it("valideringslagret skickar sina meddelanden till programmets callback, med objektens namn", () => {
    const start = build(startProject(api, "debugging"));
    expect(start.log).toContain("validation layer: Searching for ICD drivers named libvulkan_codestead.so (the simulated GPU)");
    const vuid = start.log.find((l) => l.includes("VUID-VkGraphicsPipelineCreateInfo-Input-07904"));
    expect(vuid).toBeDefined();
    expect(vuid!.startsWith("validation layer: Validation Error: [ VUID-VkGraphicsPipelineCreateInfo-Input-07904 ] Object 0: handle = 0x40000000004, type = VK_OBJECT_TYPE_SHADER_MODULE; | MessageID = 0xcc9c32be | vkCreateGraphicsPipelines(): pCreateInfos[0].pVertexInputState->pVertexAttributeDescriptions does not have a Location 1 but vertex shader has an input variable at that Location.")).toBe(true);
    // The first two steps: only warnings and errors, and the shader modules get names.
    const named = startProject(api, "debugging");
    for (const t of tasks(api, "debugging").slice(0, 2)) for (const e of t.edits) expect(applyEdit(named, e)).toBe(true);
    const scene = build(named);
    expect(scene.log.some((l) => l.includes("Searching for ICD drivers"))).toBe(false);
    expect(scene.log.find((l) => l.includes("Input-07904"))).toMatch(/Object 0: handle = 0x[0-9a-f]+, name = [^,]+, type = VK_OBJECT_TYPE_SHADER_MODULE;/);
  });

  it("utan GLFW_NO_API varnar den", () => {
    const scene = build(edited(solutionProject(api, "hello-triangle"), "glfwWindowHint(GLFW_CLIENT_API, GLFW_NO_API);", ""));
    expect(notes(scene)).toContain("Warning vkNoApiHint");
  });

  it("utan vkQueuePresentKHR visas inga bilder", () => {
    const scene = build(edited(solutionProject(api, "hello-triangle"), /vkQueuePresentKHR\([^;]*;/, ""));
    expect(notes(scene)).toContain("Info vkNoPresent");
    expect(scene.presents).toBe(false);
    expect(scene.draws.length).toBe(0);
  });

  it("Vulkan: utan vkCmdSetViewport ritas inget (dynamiskt tillstånd)", () => {
    const p = solutionProject(api, "introduction");
    const text = p.files.get("main.cpp")!;
    const at = text.indexOf("vkCmdSetViewport(");
    const end = text.indexOf(";", at);
    const scene = build(edited(p, text.slice(at, end + 1), ""));
    expect(scene.notes.some((n) => n.key === "vkDynamicStateNotSet")).toBe(true);
    expect(scene.draws).toEqual([]);
  });

  it("loadOp LOAD rensar inte och varnar", () => {
    const scene = build(edited(solutionProject(api, "hello-triangle"), "colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;", "colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_LOAD;"));
    expect(scene.clearColor).toBeNull();
    expect(notes(scene)).toContain("Warning vkLoadOpNotClear");
  });

  it("trådram kräver fillModeNonSolid", () => {
    const line = edited(solutionProject(api, "hello-triangle"), "rasterizer.polygonMode = VK_POLYGON_MODE_FILL;", "rasterizer.polygonMode = VK_POLYGON_MODE_LINE;");
    const without = build(line);
    expect(notes(without)).toContain("Error vkFillModeNonSolid");
    expect(without.draws[0]!.wireframe).toBe(true);
    const scene = build(exerciseProject(api, "hello-triangle", "ex-wireframe"));
    expect(notes(scene)).toEqual([]);
    expect(scene.draws[0]!.wireframe).toBe(true);
  });

  it("hörnen och indexen kommer från buffertarna som kommandobufferten binder", () => {
    const scene = build(solutionProject(api, "hello-triangle"));
    const d = scene.draws[0]!;
    expect(d.vertices.length).toBe(4);
    expect(d.indices).toEqual([0, 1, 2, 2, 3, 0]);
    expect(d.matchByLocation).toBe(true);
    expect(d.vertices[0]!.get("0")!.v).toEqual([-0.5, -0.5, 0]);
    expect(d.cull).toBe(CullMode.Back);
    expect(d.topology).toBe(Topology.Triangles);
  });

  it("en topologi läses ur sitt namn (GlReader.topologyOf, som C#-läsaren använder)", () => {
    expect(GlReader.topologyOf("VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST")).toBe(Topology.Triangles);
    expect(GlReader.topologyOf("VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP")).toBe(Topology.TriangleStrip);
    expect(GlReader.topologyOf("VK_PRIMITIVE_TOPOLOGY_TRIANGLE_FAN")).toBe(Topology.TriangleFan);
    expect(GlReader.topologyOf("VK_PRIMITIVE_TOPOLOGY_LINE_LIST")).toBe(Topology.Lines);
    expect(GlReader.topologyOf("VK_PRIMITIVE_TOPOLOGY_LINE_STRIP")).toBe(Topology.LineStrip);
    expect(GlReader.topologyOf("VK_PRIMITIVE_TOPOLOGY_POINT_LIST")).toBe(Topology.Points);
    expect(GlReader.topologyOf("VK_PRIMITIVE_TOPOLOGY_PATCH_LIST")).toBe(Topology.Triangles);
    expect(GlReader.topologyOf("GL_PATCHES")).toBe(Topology.Patches);
  });

  it("VulkanReader.allShaderBlocks tar varje blocktyp en gång", () => {
    const project = new GpuProject([
      ["main.cpp", "int main() {}"],
      ["a.vert", "#version 450\nlayout(binding = 0) uniform UBO { mat4 model; } ubo;\nlayout(push_constant) uniform PC { vec4 c; } pc;\nvoid main() {}"],
      ["b.frag", "#version 450\nlayout(binding = 0) uniform UBO { mat4 model; } ubo;\nlayout(location = 0) out vec4 o;\nvoid main() { o = vec4(1.0); }"],
      ["c.frag", "this is not GLSL {"],
    ]);
    const blocks = VulkanReader.allShaderBlocks(project, [".vert", ".frag"]);
    expect(blocks.map((b) => `${b.type}|${b.pushConstant}`)).toEqual(["UBO|false", "PC|true"]);
  });
});

describe("Vulkan-enhetens minne", () => {
  it("små skrivningar lagras per tal, stora som en följd", () => {
    const m = new Memory();
    m.write(8, 4, [1, 2, 3]);
    expect([m.tryGet(8), m.tryGet(12), m.tryGet(16), m.tryGet(20)]).toEqual([1, 2, 3, undefined]);
    expect(m.runs.length).toBe(0);
    const big = Array.from({ length: 1024 }, (_, i) => i / 2);
    m.write(4, 4, big);
    expect(m.runs.length).toBe(1);
    // The run replaced the single numbers it covers.
    expect(m.bytes.size).toBe(0);
    expect(m.tryGet(4 + 4 * 10)).toBe(5);
    expect(m.tryGet(6)).toBeUndefined();
    m.set(4 + 4 * 10, 99);
    expect(m.runs[0]!.values[10]).toBe(99);
    expect(m.any(0, 4)).toBe(false);
    expect(m.any(0, 5)).toBe(true);
  });

  it("range ger talen i ett intervall", () => {
    const m = new Memory();
    m.write(0, 4, [1, 2, 3, 4]);
    expect([...m.range(4, 8)]).toEqual([{ at: 4, value: 2 }, { at: 8, value: 3 }]);
  });
});
