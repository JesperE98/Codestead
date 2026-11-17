// The readers by API. In C#, Simulator.Read calls GlReader.Read, VulkanReader.Read and D3D12Reader.Read directly; in
// the port each reader module registers itself here (the readers are ported by separate agents in parallel, and the
// core must compile without them). src/index.ts imports every reader, so a program that imports the package has all
// three registered.
import type { GpuProject } from "../GpuProject.js";
import type { Scene } from "../Scene/Scene.js";

/** A reader: what the program does when its clock reads `time` seconds. */
export type ReadProgram = (project: GpuProject, time: number) => Scene;

const readers = new Map<string, ReadProgram>();

/** Registers the reader of an API ("opengl", "vulkan", "d3d12"). */
export function registerReader(api: string, read: ReadProgram): void {
  readers.set(api, read);
}

/** The reader of an API, or null when it is not registered (not ported yet). */
export function readerFor(api: string): ReadProgram | null {
  return readers.get(api) ?? null;
}
