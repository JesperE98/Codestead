// Several graphics pipelines (the lighting chapters draw the lit object and the lamp with different shaders): each
// vkCreateGraphicsPipelines(…, &name) with the shaders read before it – also through a helper function called with
// the file names, e.g. createPipeline("shaders/lighting.vert.spv", "shaders/lighting.frag.spv", lightingPipeline).
// (VulkanReader.Pipelines.cs: a part of the partial class VulkanReader, as functions of the reader.)
import { clamp, formatDouble, parseInt32, toInt, trimChars, trimNet } from "../internal/dotnet.js";
import { escapeRegex } from "../internal/regex.js";
import { CullMode } from "../Scene/CullMode.js";
import { ShaderSyntaxException } from "../Shading/ShaderErrors.js";
import { ShaderParser } from "../Shading/ShaderParser.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import type { ShaderValue } from "../Shading/ShaderValue.js";
import { CppSource } from "./CppSource.js";
import { PipelineInfo } from "./PipelineInfo.js";
import { PipelineState } from "./PipelineState.js";
import type { VulkanDevice } from "./VulkanDevice.js";
import { topologyOf, type VulkanReader } from "./VulkanReader.js";

function cullOf(cull: string): CullMode {
  return cull.includes("FRONT_AND_BACK") ? CullMode.FrontAndBack : cull.includes("BACK") ? CullMode.Back : cull.includes("FRONT") ? CullMode.Front : CullMode.None;
}

const frontCcwOf = (front: string): boolean => !front.includes("_CLOCKWISE") || front.includes("COUNTER_CLOCKWISE");

export function pipelines(r: VulkanReader): Map<string, PipelineInfo> {
  const src = r.src;
  const result = new Map<string, PipelineInfo>();
  for (const create of src.calls("vkCreateGraphicsPipelines")) {
    const fn = src.functionAt(create.offset);
    const range = fn === null ? undefined : src.functions.get(fn);
    if (fn === null || range === undefined) continue;
    const outVar = trimNet(trimChars(trimNet(create.arg(5)), "&", true, false));
    const reads = src.calls("readFile", range.start, create.offset).map((c) => trimNet(c.arg(0)));
    const params = parameters(r, fn);
    // A helper: one pipeline per call of it, with the call's arguments for the parameters.
    const sites: Map<string, string>[] = params.length > 0 && (params.includes(outVar) || reads.some((x) => params.includes(x)))
      ? src.calls(fn).map((c) => new Map(params.map((p, i) => [p, c.arg(i)] as const)))
      : [new Map()];
    for (const args of sites) {
      const sub = (x: string): string => {
        const v = args.get(x);
        return v !== undefined ? trimNet(v) : x;
      };
      const name = trimNet(trimChars(sub(outVar), "&", true, false));
      const files = reads.map((x) => CppSource.stringArg(sub(x))).filter((f): f is string => f !== null);
      const vs = shaderFor(r, files.find((f) => f.includes("vert")) ?? null, ".vert");
      const fs = shaderFor(r, files.find((f) => f.includes("frag")) ?? null, ".frag");
      if (vs === null || fs === null) continue;
      // A geometry stage: a .geom file named for this pipeline (createPipeline(…, "shaders/x.geom.spv", …)).
      const gsFile = files.find((f) => f.includes(".geom")) ?? null;
      const gs = gsFile === null ? null : shaderFor(r, gsFile, ".geom", true);
      const fieldOr = (f: string, fallback: string | null): string | null => {
        const values = src.fieldAssignments(f).filter((a) => a.offset >= range.start && a.offset < create.offset).map((a) => sub(a.value));
        return values[values.length - 1] ?? fallback;
      };
      const field = (f: string, fallback: string): string => fieldOr(f, fallback)!;
      const cull = field("cullMode", "VK_CULL_MODE_NONE");
      const front = field("frontFace", "VK_FRONT_FACE_COUNTER_CLOCKWISE");
      // An array of blend attachment states (std::array<VkPipelineColorBlendAttachmentState, 2>, set element by
      // element): each attachment's own fields, attachmentCount of them.
      let attachments: ((f: string) => string | null)[] | null = null;
      if (src.fieldAssignments("blendEnable").some((a) => a.offset >= range.start && a.offset < create.offset && /\[\s*\d+\s*\]$/.test(a.target))) {
        const count = clamp(src.int(field("attachmentCount", "1")) ?? 1, 1, 8);
        attachments = Array.from({ length: count }, (_, i) => (f: string): string | null => {
          const values = src.fieldAssignments(f).filter((a) => {
            if (a.offset < range.start || a.offset >= create.offset) return false;
            const m = /\[\s*(\d+)\s*\]$/.exec(a.target);
            return m !== null ? parseInt32(m[1]!) === i : true;
          }).map((a) => sub(a.value));
          return values[values.length - 1] ?? null;
        });
      }
      const tesc = files.find((f) => f.includes(".tesc"));
      const tese = files.find((f) => f.includes(".tese"));
      result.set(name, new PipelineInfo(name, vs, fs, "main", "main",
        cullOf(cull),
        frontCcwOf(front),
        field("polygonMode", "FILL").includes("LINE"),
        /TRUE/.test(field("depthTestEnable", "VK_FALSE")),
        topologyOf(field("topology", "TRIANGLE_LIST")),
        {
          state: PipelineState.vulkan((f) => fieldOr(f, null), (f) => src.int(field(f, "")), attachments),
          gs,
          // Tessellation: .tesc / .tese files for this pipeline, patchControlPoints of its tessellation state.
          tcs: tesc !== undefined ? shaderFor(r, tesc, ".tesc", true) : null,
          tes: tese !== undefined ? shaderFor(r, tese, ".tese", true) : null,
          patchPoints: src.int(field("patchControlPoints", "3")) ?? 3,
        }));
    }
  }
  return result;
}

/**
 * A pipeline as the device saw it made (its stages' files, its create-info): for programs that keep pipelines where
 * the reader cannot follow them by name (std::map&lt;std::string, VkPipeline&gt; Shaders).
 */
export function runtimePipeline(r: VulkanReader, device: VulkanDevice, handle: string): PipelineInfo | null {
  const known = r.runtimePipelines.get(handle);
  if (known !== undefined) return known;
  const src = r.src;
  let result: PipelineInfo | null = null;
  const made = device.createdPipelines.get(handle);
  if (made !== undefined) {
    const vs = shaderFor(r, made.files.find((f) => f.includes(".vert")) ?? null, ".vert", true);
    const fs = shaderFor(r, made.files.find((f) => f.includes(".frag")) ?? null, ".frag", true);
    const gsFile = made.files.find((f) => f.includes(".geom")) ?? null;
    const gs = gsFile === null ? null : shaderFor(r, gsFile, ".geom", true);
    const field = (name: string): string | null => fieldText(find(made.info, name, 0));
    if (vs !== null && fs !== null) {
      const cull = field("cullMode") ?? "VK_CULL_MODE_NONE";
      const front = field("frontFace") ?? "VK_FRONT_FACE_COUNTER_CLOCKWISE";
      const depth = field("depthTestEnable");
      const tesc = made.files.find((f) => f.includes(".tesc"));
      const tese = made.files.find((f) => f.includes(".tese"));
      const points = field("patchControlPoints");
      const n = points !== null ? src.int(points) : null;
      result = new PipelineInfo(handle, vs, fs, "main", "main",
        cullOf(cull),
        frontCcwOf(front),
        (field("polygonMode") ?? "FILL").includes("LINE"),
        depth !== null && (depth.includes("TRUE") || depth === "1"),
        topologyOf(field("topology") ?? "TRIANGLE_LIST"),
        {
          state: PipelineState.vulkan((f) => field(f), (f) => {
            const v = field(f);
            return v !== null ? src.int(v) : null;
          }, runtimeAttachments(made.info)),
          gs,
          tcs: tesc !== undefined ? shaderFor(r, tesc, ".tesc", true) : null,
          tes: tese !== undefined ? shaderFor(r, tese, ".tese", true) : null,
          patchPoints: n !== null ? n : 3,
        });
    }
  }
  r.runtimePipelines.set(handle, result);
  return result;
}

/** A field's value as text: its text, else its first number (invariant culture), else null. */
function fieldText(v: ShaderValue | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return v.text ?? (v.v !== null && v.v.length > 0 ? formatDouble(v.v[0]!) : null);
}

/** The fields of each blend attachment state the create-info's pColorBlendState lists (attachmentCount of them). */
function runtimeAttachments(info: ShaderValue | null): ((name: string) => string | null)[] | null {
  const blend = find(info, "pColorBlendState", 0) ?? info;
  const items = find(blend, "pAttachments", 0)?.items ?? null;
  if (items === null || items.length === 0) return null;
  const count = clamp(toInt(find(blend, "attachmentCount", 0)?.x ?? 1), 1, items.length);
  return items.slice(0, count).map((item) => (name: string) => fieldText(item.fields?.get(name)));
}

/** A field of a create-info by its name, anywhere in it (pColorBlendState → pAttachments → dstColorBlendFactor). */
function find(v: ShaderValue | null, name: string, depth: number): ShaderValue | null {
  if (v === null || depth > 6) return null;
  const f = v.fields;
  if (f !== null) {
    const direct = f.get(name);
    if (direct !== undefined) return direct;
    for (const child of f.values()) {
      const found = find(child, name, depth + 1);
      if (found !== null) return found;
    }
  }
  const items = v.items;
  if (items !== null && items.length > 0) return find(items[0]!, name, depth + 1);
  return null;
}

/** The parameter names of a function definition. */
export function parameters(r: VulkanReader, fn: string): string[] {
  const m = new RegExp(String.raw`(?<![\w.>])` + escapeRegex(fn) + String.raw`\s*\(([^()]*)\)\s*(?:const\s*)?\{`).exec(r.src.code);
  if (m === null) return [];
  return CppSource.splitArgs(m[1]!).map((p) => /(\w+)\s*(?:=[^,]*)?$/.exec(p)?.[1] ?? "").filter((p) => p !== "");
}

/** The project's shader behind a SPIR-V path: "shaders/lighting.vert.spv" → shaders/lighting.vert; "shaders/vert.spv" → the .vert file. */
function shaderFor(r: VulkanReader, spv: string | null, extension: string, exact = false): ShaderProgram | null {
  if (spv === null) return null;
  const source = spv.endsWith(".spv") ? spv.slice(0, -4) : spv;
  let text = source.endsWith(extension) ? r.project.find(source) : null;
  if (!exact) text ??= [...r.project.files].find(([k]) => k.endsWith(extension))?.[1] ?? null;
  if (text === null) return null;
  try {
    return ShaderParser.parseProgram(text);
  } catch (e) {
    if (!(e instanceof ShaderSyntaxException)) throw e;
    return null;
  }
}
