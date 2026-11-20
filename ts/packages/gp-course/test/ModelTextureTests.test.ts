// The Model chapter's planet: "draw-model" is solved only with the texture upright. Both poles of planet_diffuse.png
// are white, so the picture's pole cannot tell; the seas below it can (TaskChecks.ModelLoading.ts: textureUpright).
// One flip is right; two (OpenGL: stbi_set_flip_vertically_on_load(true) as well) or none (Direct3D 12: without
// aiProcess_FlipUVs) turn the texture upside down. (Vulkan's picture cannot show it: see textureUpright.)
import { Simulator } from "@codestead/gp-gpu";
import { describe, expect } from "vitest";
import { CheckContext, Edits, GpCourse, TaskChecks } from "../src/index.js";
import { itNeeds } from "./Repo.js";

const upsideDown: Record<string, { file: string; find: string; replace: string }> = {
  opengl: {
    file: "main.cpp",
    find: "    // (no stbi_set_flip_vertically_on_load(true) here: aiProcess_FlipUVs in model.h already turns the texture\n    // coordinates the right way up - doing both would turn the textures upside down)",
    replace: "    stbi_set_flip_vertically_on_load(true);",
  },
  d3d12: { file: "main.cpp", find: "aiProcess_GenSmoothNormals | aiProcess_FlipUVs |", replace: "aiProcess_GenSmoothNormals |" },
};

describe("ModelTextureTests", () => {
  for (const [api, edit] of Object.entries(upsideDown))
    itNeeds([api], `planeten med texturen upp och ner löser inte draw-model, upprätt gör den det (${api})`, () => {
      const project = GpCourse.startProject("model", api);
      const tasks = GpCourse.tasks("model", api);
      for (const task of tasks.slice(0, tasks.findIndex((t) => t.id === "draw-model") + 1))
        for (const e of task.edits) expect(Edits.apply(project, e)).not.toBeNull();
      const check = TaskChecks.for("model", "draw-model")!;
      expect(check(new CheckContext(api, project.clone(), Simulator.build(project, api)))).toBe(true);
      expect(Edits.apply(project, edit)).not.toBeNull();
      expect(check(new CheckContext(api, project.clone(), Simulator.build(project, api)))).toBe(false);
    }, 120_000);
});
