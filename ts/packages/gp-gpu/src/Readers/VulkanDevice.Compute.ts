// Compute: vkCreateComputePipelines, the compute bind point's pipeline and descriptor sets, push constants for the
// compute stage, and vkCmdDispatch – run when it is recorded, writing the storage images its descriptor set names (the
// frame's draws then sample what it wrote). (VulkanDevice.Compute.cs: a part of the partial class VulkanDevice, as
// functions of the device.)
import { toInt } from "../internal/dotnet.js";
import { Rasterizer } from "../Raster/Rasterizer.js";
import { StorageImage } from "../Raster/StorageImage.js";
import type * as A from "../Shading/ShaderAst.js";
import { ShaderSyntaxException } from "../Shading/ShaderErrors.js";
import { ShaderParser } from "../Shading/ShaderParser.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import { type ImageObject, VulkanDevice } from "./VulkanDevice.js";

function isComputeBindPoint(v: ShaderValue | null): boolean {
  return (v?.text ?? "").includes("COMPUTE");
}

export function computeCall(d: VulkanDevice, name: string, args: readonly A.Expr[]): ShaderValue | null {
  const { text: Text, field: Field, items: Items, strip: Strip } = VulkanDevice;
  switch (name) {
    case "vkCreateComputePipelines": {
      if (args.length < 6) break;
      const handles: ShaderValue[] = [];
      for (const info of Items(d.eval(Strip(args[3]!))).slice(0, Math.max(0, toInt(Math.max(1, d.num(args[2]!)))))) {
        const handle = d.newHandle("pipe");
        handles.push(ShaderValue.str(handle));
        const module = Text(Field(info, "stage"), "module");
        const file = module !== null ? d.moduleFiles.get(module) : undefined;
        if (file !== undefined) d.computePipelines.set(handle, file);
      }
      if (handles.length === 1) d.set(args[5]!, handles[0]!);
      else if (handles.length > 1) d.set(args[5]!, ShaderValue.array(handles));
      return ShaderValue.str("VK_SUCCESS");
    }
    case "vkCmdBindPipeline":
      if (args.length < 3 || !isComputeBindPoint(d.eval(args[1]!))) break;
      d.boundCompute = d.handle(args[2]!);
      return ShaderValue.scalar(0);
    case "vkCmdBindDescriptorSets": {
      if (args.length < 6 || !isComputeBindPoint(d.eval(args[1]!))) break;
      const first = toInt(d.num(args[3]!));
      const bound = Items(d.eval(Strip(args[5]!)));
      for (let i = 0; i < bound.length && i < Math.max(1, toInt(d.num(args[4]!))); i++) {
        const s = bound[i]!.text;
        if (s !== null) d.computeSets.set(first + i, s);
      }
      return ShaderValue.scalar(0);
    }
    case "vkCmdPushConstants":
      if (args.length < 6 || !(d.eval(args[2]!)?.text ?? "").includes("COMPUTE")) break;
      d.computeConstants = d.eval(Strip(args[5]!))?.clone() ?? null;
      return ShaderValue.scalar(0);
    case "vkCmdDispatch":
      if (args.length < 4) break;
      dispatch(d, toInt(d.num(args[1]!)), toInt(d.num(args[2]!)), toInt(d.num(args[3]!)));
      return ShaderValue.scalar(0);
  }
  return null;
}

function computeProgram(d: VulkanDevice, spv: string): ShaderProgram | null {
  const known = d.computePrograms.get(spv);
  if (known !== undefined) return known;
  const source = spv.endsWith(".spv") ? spv.slice(0, -4) : spv;
  let program: ShaderProgram | null = null;
  const text = d.project.find(source);
  if (text !== null) {
    try {
      program = ShaderParser.parseProgram(text);
    } catch (e) {
      if (!(e instanceof ShaderSyntaxException)) throw e;
    }
  }
  d.computePrograms.set(spv, program);
  return program;
}

function dispatch(d: VulkanDevice, x: number, y: number, z: number): void {
  const file = d.boundCompute !== null ? d.computePipelines.get(d.boundCompute) : undefined;
  const program = file !== undefined ? computeProgram(d, file) : null;
  if (program === null) return;
  // The push constants: the struct's fields by name (and, for a block whose names differ, by order).
  const uniforms = new Map<string, ShaderValue>();
  const fields = d.computeConstants?.fields ?? null;
  if (fields !== null) {
    for (const [k, v] of fields) uniforms.set(k, v);
    const block = program.globals.find((g) => g.pushConstant && g.block !== null);
    if (block !== undefined) {
      // Zip: as many as the shorter has; TryAdd keeps a name already there.
      const values = [...fields.values()];
      for (let i = 0; i < block.block!.length && i < values.length; i++) if (!uniforms.has(block.block![i]!.id)) uniforms.set(block.block![i]!.id, values[i]!);
    }
  }
  // The storage images: binding b of the bound set 0 (or the set the layout names).
  const images = new Map<string, StorageImage>();
  const written: { image: ImageObject; storage: StorageImage }[] = [];
  for (const g of program.globals.filter((g) => g.storage === "uniform" && g.type.startsWith("image"))) {
    const set = d.computeSets.get(0);
    const b = set !== undefined ? d.sets.get(set)?.get(g.binding ?? 0) : undefined;
    const view = b !== undefined && b.view !== null ? d.views.get(b.view) : undefined;
    const img = view !== undefined ? d.imageOf(view.image) : null;
    if (img === null) continue;
    const storage = StorageImage.from(img.layerImages[0] ?? null, img.width, img.height);
    images.set(g.id, storage);
    written.push({ image: img, storage });
  }
  const exec = d.exec!;
  const errors = Rasterizer.dispatch(program, "main", false, uniforms, images, [x, y, z], exec.runner.time);
  for (const e of errors) exec.runner.output?.("compute shader: " + e);
  for (const { image, storage } of written) {
    if (image.layerImages.length === 0) image.layerImages.push(null);
    image.layerImages[0] = storage.toImage();
    image.float = true;
  }
}
