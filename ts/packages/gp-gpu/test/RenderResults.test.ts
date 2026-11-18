// A tool for the course writers (the C# src/GP/tools/RenderResults, ported), not a test: it runs only when
// CODESTEAD_RENDER_RESULTS names a folder, and is skipped otherwise.
// Renders the result of every chapter – the course's own OpenGL solution, built and run by the simulated GPU – as
// frames for the chapter texts: one frame for a still scene, a short loop for an animated one. The frames are raw
// RGB files (<out>/<chapter>/<n>.rgb with size.txt); src/GP/content/images/make_results.py turns them into WebP pictures.
//   CODESTEAD_RENDER_RESULTS=<out dir> [CODESTEAD_RENDER_CHAPTERS=a,b] npx vitest run packages/gp-gpu/test/RenderResults.test.ts
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import { GpuProject, Rasterizer, Simulator } from "../src/index.js";
import { isAsset } from "./CourseProjects.js";
import { Repo } from "./Repo.js";

const output = process.env["CODESTEAD_RENDER_RESULTS"] ?? "";
const only = new Set((process.env["CODESTEAD_RENDER_CHAPTERS"] ?? "").split(",").filter((c) => c !== ""));
const Width = 480;
const Seconds = 3.0;
const Fps = 10;

const ordinal = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function filesUnder(dir: string, prefix = ""): string[] {
  return readdirSync(dir)
    .sort(ordinal)
    .flatMap((name) => (statSync(join(dir, name)).isDirectory() ? filesUnder(join(dir, name), prefix + name + "/") : [prefix + name]));
}

describe.skipIf(output === "")("RenderResults", () => {
  it("renders every chapter's result", () => {
    const projects = join(Repo.content, "projects", "opengl");
    for (const chapter of readdirSync(projects).sort(ordinal)) {
      if (only.size > 0 && !only.has(chapter)) continue;
      // Already rendered (a run that was stopped carries on where it was).
      if (only.size === 0 && existsSync(join(output, chapter, "size.txt"))) continue;
      const solution = join(projects, chapter, "solution");
      if (!existsSync(solution)) continue;
      const project = new GpuProject();
      for (const rel of filesUnder(solution)) {
        if (isAsset(rel)) project.assets.set(rel, new Uint8Array(readFileSync(join(solution, rel))));
        else project.files.set(rel, readFileSync(join(solution, rel), "utf8").replaceAll("\r\n", "\n"));
      }
      const scene = Simulator.build(project, "opengl").scene;
      if (scene === null || !scene.showsFrames) {
        console.log(`${chapter}: no frames`);
        continue;
      }
      const dir = join(output, chapter);
      mkdirSync(dir, { recursive: true });
      const frames = scene.animated ? Math.trunc(Seconds * Fps) : 1;
      const started = performance.now();
      let w = 0, h = 0;
      for (let i = 0; i < frames; i++) {
        const frame = Rasterizer.render(scene, Width, scene.animated ? 1.0 + i / Fps : 1.0);
        w = frame.width;
        h = frame.height;
        const rgb = new Uint8Array(w * h * 3);
        for (let p = 0; p < w * h; p++) {
          rgb[p * 3] = frame.pixels[p * 4 + 2]!;
          rgb[p * 3 + 1] = frame.pixels[p * 4 + 1]!;
          rgb[p * 3 + 2] = frame.pixels[p * 4]!;
        }
        writeFileSync(join(dir, String(i).padStart(3, "0") + ".rgb"), rgb);
      }
      writeFileSync(join(dir, "size.txt"), `${w} ${h} ${Math.trunc(1000 / Fps)} ${frames}`);
      console.log(`${chapter}: ${frames} frame(s) ${w}x${h} in ${((performance.now() - started) / 1000).toFixed(1)} s`);
    }
  }, 24 * 3600 * 1000);
});
