import { Apis } from "../Apis.js";
import type { GpuProject } from "../GpuProject.js";
import { Scene } from "../Scene/Scene.js";
import { SimNote } from "../Scene/SimNote.js";
import type * as A from "../Shading/ShaderAst.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import type { Image } from "../Textures/Image.js";
import { CppSource } from "./CppSource.js";
import type { DrawTextures } from "./DrawTextures.js";
import type { PipelineInfo } from "./PipelineInfo.js";
import { registerReader } from "./ReaderRegistry.js";
import { allShaderBlocks, type VkLayout } from "./VulkanReader.Device.js";
import { frame } from "./VulkanReader.Frame.js";

/**
 * Reads a Vulkan program written like vulkan-tutorial.com's HelloTriangleApplication: which objects it creates
 * (in initVulkan's order), whether drawFrame presents, the clear value, the graphics pipeline's fixed functions
 * and shaders, the vertex and index buffers and the draw command. Missing pieces become the notes a validation
 * layer or a crash would give.
 *
 * (A C# partial class: VulkanReader.Device.ts, VulkanReader.Frame.ts and VulkanReader.Pipelines.ts hold the other parts
 * as functions of the reader; the members they use are internal.)
 */
export class VulkanReader {
  /** @internal */
  readonly project: GpuProject;
  /** @internal */
  readonly src: CppSource;
  /** @internal */
  readonly scene = new Scene({ api: Apis.Vulkan });

  /** @internal */
  readonly time: number;

  // ---------- the other parts' state ----------

  /** The vertex input of the program, read once (VulkanReader.Device.cs). @internal */
  layout: VkLayout | null = null;
  /** The texture sizes of the last deviceTextures call (textureSize, texelFetch). @internal */
  deviceTextureSizes: ((name: string) => Image | null) | null = null;
  /** The cube maps of the last deviceTextures call read at a mip level (textureLod). @internal */
  deviceCubeLod: ((name: string, x: number, y: number, z: number, lod: number) => number[] | null) | null = null;
  /** @internal */
  drawTextures: DrawTextures | null = null;
  /** The indices of a model loaded with tinyobjloader (null when the program has none). @internal */
  modelIndices: number[] | null = null;
  /** @internal */
  readonly runtimePipelines = new Map<string, PipelineInfo | null>();

  private constructor(project: GpuProject, time: number) {
    this.time = time;
    this.project = project;
    const main = project.mainFile;
    this.src = new CppSource(main, project.mainText());
  }

  static read(project: GpuProject, time = 1.0): Scene {
    return new VulkanReader(project, time).run();
  }

  /**
   * The uniform blocks / cbuffers of every shader of the project (with several pipelines, the first shader alone
   * may have none), each block type once. (The Direct3D 12 reader uses it too.)
   */
  static allShaderBlocks(project: GpuProject, extensions: string[], ...known: ShaderProgram[]): A.Global[] {
    return allShaderBlocks(project, extensions, ...known);
  }

  /** Is a function called (somewhere in the program)? The tutorial calls its create* functions from initVulkan. */
  private called(fn: string): boolean {
    return this.src.hasCall(fn);
  }

  /** A Vulkan function is used inside a function body that is itself reached from main. @internal */
  reached(vkFunction: string): boolean {
    for (const call of this.src.calls(vkFunction)) {
      const fn = this.src.functionAt(call.offset);
      if (fn === null || fn === "main" || this.isReachable(fn, new Set())) return true;
    }
    return false;
  }

  private isReachable(fn: string, seen: Set<string>): boolean {
    if (seen.has(fn)) return false;
    seen.add(fn);
    if (fn === "main" || fn === "run") return true;
    for (const caller of this.src.functions.keys())
      if (caller !== fn && this.src.callsFunction(caller, fn) && this.isReachable(caller, seen)) return true;
    return false;
  }

  private run(): Scene {
    const src = this.src, scene = this.scene;
    if (!src.functions.has("main")) {
      scene.notes.push(SimNote.error("noMain"));
      return scene;
    }
    this.window();
    if (!scene.windowCreated) return scene;
    const instance = this.reached("vkCreateInstance");
    if (!instance) {
      scene.notes.push(SimNote.info("vkNoInstance"));
      return scene;
    }
    scene.log.push("vkCreateInstance: VK_SUCCESS");
    // The validation layer is on; a program with its own debug callback prints the layer's messages itself.
    if ((this.reached("vkCreateDebugUtilsMessengerEXT") || src.uses("CreateDebugUtilsMessengerEXT")) && !/\.pfnUserCallback\s*=\s*&?\s*\w+\s*;/.test(src.code))
      scene.log.push("validation layer: VK_LAYER_KHRONOS_validation enabled");
    if (!this.reached("vkEnumeratePhysicalDevices")) return this.done("vkNoPhysicalDevice");
    scene.log.push("GPU: Codestead Virtual GPU (simulated)");
    if (!this.reached("vkCreateDevice")) return this.done("vkNoDevice");
    if (!this.reached("glfwCreateWindowSurface") && !this.reached("vkCreateWin32SurfaceKHR")) return this.done("vkNoSurface");
    if (!this.reached("vkCreateSwapchainKHR")) return this.done("vkNoSwapchain");
    if (!this.reached("vkCreateImageView")) return this.done("vkNoImageViews");
    const dynamicRendering = src.hasCall("vkCmdBeginRendering") || src.hasCall("vkCmdBeginRenderingKHR");
    if (!dynamicRendering && !this.reached("vkCreateRenderPass")) return this.done("vkNoRenderPass");
    if (!dynamicRendering && !this.reached("vkCreateFramebuffer")) return this.done("vkNoFramebuffers");
    if (!this.reached("vkCreateCommandPool") || !this.reached("vkAllocateCommandBuffers")) return this.done("vkNoCommandBuffer");
    if (!this.reached("vkQueueSubmit")) return this.done("vkNoSubmit");
    if (!this.reached("vkQueuePresentKHR") || !this.reached("vkAcquireNextImageKHR")) return this.done("vkNoPresent");
    scene.presents = scene.renderLoop;
    if (!src.hasCall("vkDeviceWaitIdle")) scene.notes.push(SimNote.warning("vkNoWaitIdle"));
    if (!src.hasCall("vkWaitForFences")) scene.notes.push(SimNote.warning("vkNoFenceWait"));
    frame(this, dynamicRendering);
    return scene;
  }

  private done(note: string): Scene {
    this.scene.notes.push(SimNote.info(note));
    return this.scene;
  }

  private window(): void {
    const src = this.src, scene = this.scene;
    const create = src.calls("glfwCreateWindow")[0] ?? null;
    if (create === null || !src.hasCall("glfwInit")) {
      scene.notes.push(SimNote.info("noWindow"));
      return;
    }
    scene.windowCreated = true;
    scene.width = src.int(create.arg(0)) ?? 800;
    scene.height = src.int(create.arg(1)) ?? 600;
    scene.windowTitle = CppSource.stringArg(create.arg(2)) ?? "";
    scene.renderLoop = /while\s*\(\s*!\s*glfwWindowShouldClose\s*\(/.test(src.code);
    if (!scene.renderLoop) scene.notes.push(SimNote.warning("noLoop"));
    else if (!src.hasCall("glfwPollEvents")) scene.notes.push(SimNote.warning("noPollEvents"));
    if (!src.code.includes("GLFW_NO_API")) scene.notes.push(SimNote.warning("vkNoApiHint"));
  }
}


registerReader(Apis.Vulkan, (project, time) => VulkanReader.read(project, time));
