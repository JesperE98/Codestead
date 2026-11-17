// SimulatorTests.cs: the simulated GPU tells the learner about the usual mistakes, the way a compiler, a driver or a
// validation layer would. Every case builds a finished course project (GpCourse, in @codestead/gp-course) and reads it
// with a reader (GlReader, VulkanReader, D3D12Reader): the course and the readers are ported in wave 2, so the cases
// wait for them.
import { describe, it } from "vitest";

const needs = "needs the readers (wave 2) and GpCourse (@codestead/gp-course)";

describe("SimulatorTests", () => {
  it.todo(`ett felstavat API-namn ger "did you mean" (opengl: glClearColour → glClearColor) – ${needs}`);
  it.todo(`ett felstavat API-namn ger "did you mean" (vulkan: vkCmdDraww → vkCmdDraw) – ${needs}`);
  it.todo(`ett felstavat API-namn ger "did you mean" (d3d12: ->DrawInstance → DrawInstanced) – ${needs}`);
  it.todo(`en saknad klammer stoppar bygget – ${needs}`);
  it.todo(`OpenGL: ett avstängt attribut ritar inget och säger varför – ${needs}`);
  it.todo(`OpenGL: utan glClear säger simulatorn till – ${needs}`);
  it.todo(`Vulkan: utan vkCmdSetViewport ritas inget (dynamiskt tillstånd) – ${needs}`);
  it.todo(`DirectX 12: utan barriärer klagar debuglagret – ${needs}`);
});
