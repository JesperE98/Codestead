import { trimNet } from "../internal/dotnet.js";
import { escapeRegex } from "../internal/regex.js";
import type { GpuProject } from "../GpuProject.js";
import { Scene } from "../Scene/Scene.js";
import type { Image } from "../Textures/Image.js";
import { SamplerState } from "../Textures/SamplerState.js";
import type { CppCall } from "./CppCall.js";
import { CppSource } from "./CppSource.js";
import { StbImage } from "./StbImage.js";

/**
 * Textures that change from draw to draw in the explicit APIs, followed through the program's helpers:
 * - Vulkan: the descriptor set bound before a draw (vkCmdBindDescriptorSets) was written by a helper such as
 *   <c>createDescriptorSet(cubeTextureImageView, textureSampler, cubeDescriptorSet)</c>; its image info names the view,
 *   and the view was made by <c>loadTexture("textures/marble.png", image, memory, cubeTextureImageView)</c>.
 * - DirectX 12: the descriptor table set before a draw (SetGraphicsRootDescriptorTable) starts at a heap slot
 *   (<c>CD3DX12_GPU_DESCRIPTOR_HANDLE h(heapStart, 2, size)</c>); slot N holds the texture of
 *   <c>LoadTexture("metal.png", texture, upload, 2)</c>, and register tk reads slot N + k.
 * When a program does not follow such a pattern, the readers keep binding textures in load order.
 */
export class DrawTextures {
  /** Every argument of a helper call that loaded an image (the view, the image, the slot …) → the image. */
  private readonly imageByArg = new Map<string, Image>();
  /** D3D12: heap slot → image. */
  private readonly imageBySlot = new Map<number, Image>();

  constructor(private readonly src: CppSource, private readonly project: GpuProject) {
    for (const load of StbImage.all(src, project, new Scene({ api: "" })).filter((i) => i.file === "" && trimNet(i.arg) !== "")) {
      const fn = src.functionAt(load.offset);
      if (fn === null) continue;
      const parameters = this.parameters(fn);
      const pathIndex = parameters.indexOf(trimNet(load.arg).replace(/\.c_str\(\)$/, ""));
      if (pathIndex < 0) continue;
      for (const call of this.callsOf(fn)) {
        const file = CppSource.stringArg(call.arg(pathIndex));
        const image = file === null ? null : StbImage.load(project, file, load.flip, load.wanted);
        if (image === null) continue;
        for (let i = 0; i < call.args.length; i++) {
          if (i === pathIndex) continue;
          const arg = nameOf(call.arg(i));
          if (arg !== null) this.imageByArg.set(arg, image);
          // A heap slot: the parameter that names a descriptor index (descriptorIndex, slot, heapIndex …).
          if (i < parameters.length && /index|slot|descriptor/i.test(parameters[i]!)) {
            const slot = src.int(call.arg(i));
            if (slot !== null) this.imageBySlot.set(slot, image);
          }
        }
      }
    }
  }

  get any(): boolean {
    return this.imageByArg.size > 0;
  }

  /** The calls of a function (also as a method: obj.fn(…) / obj->fn(…)), in source order. */
  private callsOf(fn: string): CppCall[] {
    return [...this.src.calls(fn), ...this.src.calls("." + fn)].sort((a, b) => a.offset - b.offset);
  }

  /** The parameter names of a function definition. */
  private parameters(fn: string): string[] {
    const m = new RegExp(String.raw`(?<![\w.>])` + escapeRegex(fn) + String.raw`\s*\(([^()]*)\)\s*(?:const\s*)?\{`).exec(this.src.code);
    return m !== null ? CppSource.splitArgs(m[1]!).map((p) => /(\w+)\s*(?:=[^,]*)?$/.exec(p)?.[1] ?? "") : [];
  }

  // ---------- Vulkan ----------

  /**
   * The textures of a descriptor set, by binding, with their samplers: from the helper calls that write sets (dstSet =
   * a parameter) – null when the set was not written that way.
   */
  vulkanSet(setText: string, samplerByName: (name: string) => SamplerState | null): Map<number, { image: Image; sampler: SamplerState }> | null {
    const set = nameOf(setText);
    if (set === null) return null;
    const src = this.src;
    for (const fn of src.functions.keys()) {
      const body = src.functionBody(fn)!;
      if (!body.includes("pImageInfo")) continue;
      const parameters = this.parameters(fn);
      if (parameters.length === 0) continue;
      const { start, end } = src.functions.get(fn)!;
      const fieldIn = (target: string, field: string): string | null => {
        const values = src.fieldAssignments(field).filter((a) => a.offset >= start && a.offset < end && a.target === target);
        return values.length > 0 ? values[values.length - 1]!.value : null;
      };
      const writes = src.fieldAssignments("pImageInfo").filter((a) => a.offset >= start && a.offset < end);
      for (const call of this.callsOf(fn)) {
        const sub = (x: string): string => {
          const i = parameters.indexOf(x.trim());
          return i >= 0 ? call.arg(i).trim() : x.trim();
        };
        const result = new Map<number, { image: Image; sampler: SamplerState }>();
        let ours = false;
        for (const w of writes) {
          const dst = fieldIn(w.target, "dstSet");
          if (dst === null || nameOf(sub(dst)) !== set) continue;
          ours = true;
          const info = w.value.trim().replace(/^&+/, "").trim();
          const view = fieldIn(info, "imageView");
          const sampler = fieldIn(info, "sampler");
          const binding = src.int(fieldIn(w.target, "dstBinding") ?? "0") ?? 0;
          const viewName = view === null ? null : nameOf(sub(view));
          const image = viewName === null ? undefined : this.imageByArg.get(viewName);
          if (image === undefined) continue;
          const sn = sampler !== null ? nameOf(sub(sampler)) : null;
          const state = sn !== null ? samplerByName(sn) : null;
          result.set(binding, { image, sampler: state ?? SamplerState.Default });
        }
        if (ours && result.size > 0) return result;
      }
    }
    return null;
  }

  // ---------- DirectX 12 ----------

  /** The heap slot a descriptor table starts at, from the handle bound (null when it cannot tell). */
  d3d12Slot(handleText: string): number | null {
    const text = handleText.trim();
    if (text.endsWith("GetGPUDescriptorHandleForHeapStart()")) return 0;
    let args: string | null = null;
    const call = /^CD3DX12_GPU_DESCRIPTOR_HANDLE\(([^\n]*)\)$/.exec(text);
    if (call !== null) args = call[1]!;
    else {
      const name = nameOf(text);
      if (name !== null) {
        const decl = new RegExp(String.raw`CD3DX12_GPU_DESCRIPTOR_HANDLE\s+` + escapeRegex(name) + String.raw`\s*\(([^;]*)\)\s*;`).exec(this.src.code);
        if (decl !== null) args = decl[1]!;
      }
    }
    if (args === null) return null;
    const parts = CppSource.splitArgs(args);
    return parts.length >= 2 ? this.src.int(parts[1]!) : 0;
  }

  /** The image in a heap slot (loaded by a helper called with that slot), or null. */
  slotImage(slot: number): Image | null {
    return this.imageBySlot.get(slot) ?? null;
  }

  get hasSlots(): boolean {
    return this.imageBySlot.size > 0;
  }
}

function nameOf(arg: string): string | null {
  const a = arg.trim().replace(/^&+/, "").trim().replace(/\.Get\(\)$|\[[^\]]*\]$/, "");
  return /^[A-Za-z_]\w*$/.test(a) ? a : null;
}
