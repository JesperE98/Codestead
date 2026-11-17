// SimulatorTests.cs: the simulated GPU tells the learner about the usual mistakes, the way a compiler, a driver or a
// validation layer would. (Moved here from @codestead/gp-gpu, where they waited for GpCourse.)
import { Simulator, type GpuProject } from "@codestead/gp-gpu";
import { describe, expect } from "vitest";
import { Edits, GpCourse } from "../src/index.js";
import { itNeeds } from "./Repo.js";

function finished(api: string, chapter: string): GpuProject {
  const p = GpCourse.startProject(chapter, api);
  for (const e of GpCourse.tasks(chapter, api).flatMap((t) => t.edits)) Edits.apply(p, e);
  return p;
}

function withChange(p: GpuProject, file: string, from: string, to: string): GpuProject {
  const copy = p.clone();
  expect(copy.files.get(file)).toContain(from);
  copy.files.set(file, copy.files.get(file)!.replaceAll(from, to));
  return copy;
}

describe("SimulatorTests", { timeout: 60_000 }, () => {
  for (const [api, from, to, suggestion] of [
    ["opengl", "glClearColor(", "glClearColour(", "glClearColor"],
    ["vulkan", "vkCmdDraw(", "vkCmdDraww(", "vkCmdDraw"],
    ["d3d12", "->DrawInstanced(", "->DrawInstance(", "DrawInstanced"],
  ] as const)
    itNeeds([api], `ett felstavat API-namn ger "did you mean" (${api}, ${from} → ${to})`, () => {
      const r = Simulator.build(withChange(finished(api, "introduction"), "main.cpp", from, to), api);
      expect(r.succeeded).toBe(false);
      expect(r.diagnostics.some((d) => d.message.includes(`did you mean '${suggestion}'`))).toBe(true);
    });

  itNeeds(["opengl"], "en saknad klammer stoppar bygget", () => {
    const p = finished("opengl", "introduction");
    const r = Simulator.build(withChange(p, "main.cpp", "glfwPollEvents();\n    }", "glfwPollEvents();\n"), "opengl");
    expect(r.succeeded).toBe(false);
  });

  itNeeds(["opengl"], "OpenGL: ett avstängt attribut ritar inget och säger varför", () => {
    const r = Simulator.build(withChange(finished("opengl", "introduction"), "main.cpp", "glEnableVertexAttribArray(0);", ""), "opengl");
    expect(r.scene!.notes.some((n) => n.key === "attribDisabled")).toBe(true);
  });

  itNeeds(["opengl"], "OpenGL: utan glClear säger simulatorn till", () => {
    const r = Simulator.build(withChange(finished("opengl", "hello-window"), "main.cpp", "glClear(GL_COLOR_BUFFER_BIT);", ""), "opengl");
    expect(r.scene!.clearColor).toBeNull();
    expect(r.scene!.notes.some((n) => n.key === "noClear")).toBe(true);
  });

  itNeeds(["vulkan"], "Vulkan: utan vkCmdSetViewport ritas inget (dynamiskt tillstånd)", () => {
    const p = finished("vulkan", "introduction");
    const text = p.files.get("main.cpp")!;
    const at = text.indexOf("vkCmdSetViewport(");
    const end = text.indexOf(";", at);
    const r = Simulator.build(withChange(p, "main.cpp", text.slice(at, end + 1), ""), "vulkan");
    expect(r.scene!.notes.some((n) => n.key === "vkDynamicStateNotSet")).toBe(true);
    expect(r.scene!.draws).toHaveLength(0);
  });

  itNeeds(["d3d12"], "DirectX 12: utan barriärer klagar debuglagret", () => {
    const p = finished("d3d12", "introduction");
    const copy = p.clone();
    copy.files.set("main.cpp", copy.files.get("main.cpp")!.replace(/m_commandList->ResourceBarrier\([^;]*;/g, ""));
    const r = Simulator.build(copy, "d3d12");
    expect(r.scene!.notes.some((n) => n.key === "dxNoBarriers")).toBe(true);
  });
});
