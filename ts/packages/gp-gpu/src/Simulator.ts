import { Apis } from "./Apis.js";
import { BuildChecker } from "./Build/BuildChecker.js";
import { BuildResult } from "./Build/BuildResult.js";
import type { GpuProject } from "./GpuProject.js";
import { readerFor } from "./Readers/ReaderRegistry.js";
import type { Scene } from "./Scene/Scene.js";

/** Path.GetDirectoryName of a project path ("" for a bare name). */
function directoryOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

/** "Build &amp; run" for a project: the compile step, then (when it compiled) what the program does. */
export const Simulator = {
  build(project: GpuProject, api: string): BuildResult {
    const commands = buildCommands(project, api);
    const diagnostics = BuildChecker.check(project, api);
    if (diagnostics.some((d) => d.isError)) return new BuildResult(api, commands, diagnostics, null);
    const scene = Simulator.read(project, api, 1.0);
    const copy = project.clone();
    scene.atTime = (t) => Simulator.read(copy, api, t);
    return new BuildResult(api, commands, diagnostics, scene);
  },

  /** What the program does when its clock reads `time` seconds (Vulkan, D3D12, else OpenGL – as in C#). */
  read(project: GpuProject, api: string, time: number): Scene {
    const key = api === Apis.Vulkan || api === Apis.D3D12 ? api : Apis.OpenGL;
    const read = readerFor(key);
    if (read === null) throw new Error(`The ${key} reader is not registered (import it, or the package's index).`);
    return read(project, time);
  },
};

/** The commands a real build would run (shown in the output, as in a terminal). */
function buildCommands(project: GpuProject, api: string): string[] {
  const list: string[] = [];
  switch (api) {
    case Apis.Vulkan:
      for (const f of [...project.files.keys()].filter((k) => [".vert", ".frag", ".geom", ".tesc", ".tese", ".comp"].some((e) => k.endsWith(e)))) {
        const dir = directoryOf(f.replaceAll("\\", "/"));
        // shader.vert → vert.spv (vulkan-tutorial's names); any other name → lighting.vert.spv.
        const file = f.slice(f.lastIndexOf("/") + 1);
        const spv = (dir.length > 0 ? dir + "/" : "") + (file === "shader.vert" || file === "shader.frag" ? (f.endsWith(".vert") ? "vert" : "frag") + ".spv" : file + ".spv");
        list.push(`$ glslc ${f} -o ${spv}`);
      }
      list.push("$ g++ -std=c++17 main.cpp -o app -lglfw -lvulkan");
      list.push("$ ./app");
      break;
    case Apis.D3D12:
      list.push("> cl /std:c++17 /EHsc main.cpp /link d3d12.lib dxgi.lib d3dcompiler.lib user32.lib");
      list.push("> main.exe");
      break;
    default:
      list.push("$ g++ -std=c++17 main.cpp glad.c -o app -lglfw -ldl");
      list.push("$ ./app");
      break;
  }
  return list;
}
