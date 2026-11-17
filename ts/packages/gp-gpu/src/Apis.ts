import { ApiInfo } from "./ApiInfo.js";

/** The graphics APIs the course teaches. The id is the variant id the learner chooses. */
export const Apis = {
  OpenGL: "opengl",
  Vulkan: "vulkan",
  D3D12: "d3d12",

  all: [
    new ApiInfo("opengl", "OpenGL", "OpenGL 3.3", "GLSL"),
    new ApiInfo("vulkan", "Vulkan", "Vulkan", "GLSL"),
    new ApiInfo("d3d12", "DirectX 12", "Direct3D 12", "HLSL"),
  ] as readonly ApiInfo[],

  /** The API the course starts with. */
  Default: "opengl",

  get(id: string | null | undefined): ApiInfo {
    return Apis.all.find((a) => a.id === id) ?? Apis.all[0]!;
  },

  isKnown(id: string | null | undefined): boolean {
    return Apis.all.some((a) => a.id === id);
  },
} as const;
