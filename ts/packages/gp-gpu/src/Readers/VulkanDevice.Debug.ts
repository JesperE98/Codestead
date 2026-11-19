// The validation layer (learnopengl's "Debugging" in Vulkan): vulkan-tutorial's debug messenger gets the layer's
// messages through the program's own callback – the loader's verbose lines when the messenger is made, and the error
// of a pipeline whose vertex shader reads an input location no attribute description gives (VUID-…-Input-07904), with
// the names objects got from vkSetDebugUtilsObjectNameEXT – in the layer's own wording. (VulkanDevice.Debug.cs: a part
// of the partial class VulkanDevice, as functions of the device.)
import { parseInt32, toInt, tryParseInt } from "../internal/dotnet.js";
import { matchesAll } from "../internal/regex.js";
import type * as A from "../Shading/ShaderAst.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import { CppSource } from "./CppSource.js";
import { type Attribute, VulkanDevice } from "./VulkanDevice.js";

const Verbose = 0x1, ErrorSeverity = 0x1000, General = 0x1, Validation = 0x2;

/** The debug-utils calls and the shader module bookkeeping; null: not one of them (or the call goes on). */
export function validationCall(d: VulkanDevice, name: string, args: readonly A.Expr[]): ShaderValue | null {
  const { strip: Strip } = VulkanDevice;
  switch (name) {
    case "readFile": {
      if (args.length < 1) break;
      const file = d.eval(args[0]!)?.text ?? null;
      if (file === null || !file.endsWith(".spv")) break;
      // The SPIR-V file a shader module is made of next (vulkan-tutorial reads both, then makes both modules).
      d.shaderFiles.push(file);
      return null;
    }
    case "vkCreateShaderModule": {
      if (args.length < 4) break;
      const module = d.newHandle("shader");
      if (d.shaderFiles.length > 0) d.moduleFiles.set(module, d.shaderFiles.shift()!);
      d.set(args[3]!, ShaderValue.str(module));
      return ShaderValue.str("VK_SUCCESS");
    }
    case "CreateDebugUtilsMessengerEXT": case "vkCreateDebugUtilsMessengerEXT": {
      if (args.length < 4) break;
      // The callback and the severities it asks for (createInfo.pfnUserCallback, createInfo.messageSeverity).
      const callback = /\.pfnUserCallback\s*=\s*(?:\(\s*\w+\s*\)\s*)?&?\s*(\w+)\s*;/.exec(d.src.code);
      d.messengerCallback = callback !== null && d.src.functions.has(callback[1]!) ? callback[1]! : null;
      const severity = d.eval(Strip(args[1]!))?.fields?.get("messageSeverity");
      d.messengerSeverities = severity !== undefined && severity.v !== null && severity.v.length > 0 ? toInt(severity.v[0]!) : Verbose | 0x10 | 0x100 | ErrorSeverity;
      d.set(args[3]!, ShaderValue.str(d.newHandle("messenger")));
      // The loader's and the layer's first messages (lavapipe's start with these too).
      message(d, Verbose, General, "Searching for ICD drivers named libvulkan_codestead.so (the simulated GPU)", null, 0, []);
      message(d, Verbose, General, "Loading layer library libVkLayer_khronos_validation.so", null, 0, []);
      return ShaderValue.str("VK_SUCCESS");
    }
    case "SetDebugUtilsObjectNameEXT": case "vkSetDebugUtilsObjectNameEXT": {
      if (args.length < 2) break;
      const info = d.eval(Strip(args[args.length - 1]!));
      const f = info?.fields ?? null;
      const label = f?.get("pObjectName")?.text ?? null;
      const key = label !== null ? handleKey(f!.get("objectHandle") ?? null) : null;
      if (label !== null && key !== null) d.objectNames.set(key, label);
      return ShaderValue.str("VK_SUCCESS");
    }
  }
  return null;
}

/** A handle as the program passes it ((uint64_t) module keeps the handle's name). */
function handleKey(v: ShaderValue | null): string | null {
  return v?.text !== null && v?.text !== undefined && v.text.length > 0 ? v.text : null;
}

/** vkCreateGraphicsPipelines: every input location of the vertex shader needs an attribute description. */
export function checkVertexInputs(d: VulkanDevice, info: ShaderValue, attributes: Attribute[], index: number): void {
  if (d.messengerCallback === null) return;
  const { text: Text, number: Number_, field: Field, items: Items } = VulkanDevice;
  const stages = Items(Field(info, "pStages")).slice(0, Math.max(0, toInt(Number_(info, "stageCount") ?? 2147483647)));
  const vertexStage = stages.find((st) => Text(st, "stage")?.includes("VERTEX") === true);
  const vertexModule = vertexStage !== undefined ? Text(vertexStage, "module") : null;
  const spv = vertexModule !== null ? d.moduleFiles.get(vertexModule) : undefined;
  if (vertexModule === null || spv === undefined) return;
  // The shader's GLSL next to its SPIR-V name (shaders/debugging.vert.spv ← shaders/debugging.vert).
  const glsl = d.project.find(spv.slice(0, -4));
  if (glsl === null) return;
  const described = new Set(attributes.map((a) => a.location));
  const inputs = [...new Set(matchesAll(/layout\s*\(\s*location\s*=\s*(\d+)\s*\)\s*in\s+\w+\s+\w+/g, CppSource.blankComments(glsl)).map((m) => parseInt32(m[1]!)))].sort((a, b) => a - b);
  for (const location of inputs.filter((l) => !described.has(l)))
    message(d, ErrorSeverity, Validation,
      `vkCreateGraphicsPipelines(): pCreateInfos[${index}].pVertexInputState->pVertexAttributeDescriptions does not have a Location ${location} but vertex shader has an input variable at that Location. The Vulkan spec states: If the pipeline is being created with vertex input state and pVertexInputState is not dynamic, then all variables with the Input storage class decorated with Location in the Vertex Execution Model OpEntryPoint must contain a location in VkVertexInputAttributeDescription::location (https://www.khronos.org/registry/vulkan/specs/1.3-extensions/html/vkspec.html#VUID-VkGraphicsPipelineCreateInfo-Input-07904)`,
      "VUID-VkGraphicsPipelineCreateInfo-Input-07904", 0xcc9c32be | 0, [{ handle: vertexModule, type: "VK_OBJECT_TYPE_SHADER_MODULE" }]);
}

/**
 * The layer reports a message: the program's callback gets it (when the messenger asks for its severity), with the
 * text as the layer formats it – "Validation Error: [ VUID ] Object 0: handle = …, name = …, type = …; | MessageID = … | …".
 * `id` is a C# int (unchecked((int)0xcc9c32be) is negative).
 */
function message(d: VulkanDevice, severity: number, type: number, text: string, vuid: string | null, id: number, objects: { handle: string; type: string }[]): void {
  if (d.messengerCallback === null || (d.messengerSeverities & severity) === 0) return;
  let msg = text;
  if (vuid !== null) {
    const described = objects.map((o, i) => {
      const n = d.objectNames.get(o.handle);
      return `Object ${i}: handle = 0x${handleNumber(o.handle).toString(16)}, ${n !== undefined ? "name = " + n + ", " : ""}type = ${o.type};`;
    }).join(" ");
    msg = `${severity === ErrorSeverity ? "Validation Error" : "Validation Warning"}: [ ${vuid} ] ${described} | MessageID = 0x${(id >>> 0).toString(16)} | ${text}`;
  }
  const data = ShaderValue.struct(new Map([
    ["pMessage", ShaderValue.str(msg)],
    ["pMessageIdName", ShaderValue.str(vuid ?? "")],
    ["messageIdNumber", ShaderValue.integer(id)],
    ["objectCount", ShaderValue.integer(objects.length)],
    ["pObjects", ShaderValue.array(objects.map((o) => ShaderValue.struct(new Map([
      ["objectType", ShaderValue.str(o.type)],
      ["objectHandle", ShaderValue.str(o.handle)],
      ["pObjectName", ShaderValue.str(d.objectNames.get(o.handle) ?? "")],
    ]))))],
  ]));
  const exec = d.exec!;
  exec.runner.globals.set("__vkCallbackData", data);
  exec.run(`${d.messengerCallback}(${severity}, ${type}, &__vkCallbackData, nullptr);`);
}

/** A handle's number as a driver shows it: "shader:15" → 0xf000000000f. (A C# long: a BigInt here.) */
function handleNumber(handle: string): bigint {
  const n = tryParseInt(handle.slice(handle.indexOf(":") + 1));
  return n !== null ? (BigInt(n) << 40n) | BigInt(n) : 0n;
}
