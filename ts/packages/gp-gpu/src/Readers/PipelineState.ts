import { BlendFactor } from "../Scene/BlendFactor.js";
import { BlendOp } from "../Scene/BlendOp.js";
import { BlendState } from "../Scene/BlendState.js";
import { CompareFunc } from "../Scene/CompareFunc.js";
import { StencilOp } from "../Scene/StencilOp.js";
import { StencilState } from "../Scene/StencilState.js";

/**
 * A pipeline's depth, stencil and blend state. `attachments`: blending per colour attachment when it differs between
 * them (D3D12's IndependentBlendEnable, Vulkan's pAttachments array), else null: every attachment blends with `blend`.
 * (A C# record: PipelineState.Fixed.)
 */
export class Fixed {
  constructor(
    readonly depthFunc: CompareFunc,
    readonly depthWrite: boolean,
    readonly stencil: StencilState | null,
    readonly blend: BlendState | null,
    readonly attachments: readonly (BlendState | null)[] | null = null,
  ) {}
}

type Field = (name: string) => string | null;

const sameBlend = (a: BlendState | null, b: BlendState | null): boolean => (a === null ? b === null : a.equals(b));

/** The attachments' blending, or null when they all blend alike. */
function distinct(blends: (BlendState | null)[]): (BlendState | null)[] | null {
  return blends.length > 1 && blends.slice(1).some((b) => !sameBlend(b, blends[0]!)) ? blends : null;
}

/**
 * The depth, stencil and blend state of a Vulkan pipeline or a DirectX 12 pipeline state object, read from the fields
 * the program assigns before creating it (depthStencil.depthCompareOp = …, psoDesc.DepthStencilState.DepthFunc = …).
 */
export const PipelineState = {
  /**
   * Vulkan: VkPipelineDepthStencilStateCreateInfo and VkPipelineColorBlendAttachmentState fields. `attachments`: the
   * fields of each element of pAttachments (attachmentCount of them), when the program sets them element by element.
   */
  vulkan(field: Field, num: (name: string) => number | null, attachments: readonly Field[] | null = null): Fixed {
    const d = field("depthCompareOp");
    const depthFunc = d !== null ? vkCompare(d) : CompareFunc.Less;
    const depthWrite = !/FALSE|^0$/.test(field("depthWriteEnable") ?? "VK_TRUE");
    let stencil: StencilState | null = null;
    if (/TRUE|^1$/.test(field("stencilTestEnable") ?? "")) {
      const c = field("compareOp");
      stencil = new StencilState(
        c !== null ? vkCompare(c) : CompareFunc.Always,
        num("reference") ?? 0,
        num("compareMask") ?? 0xff,
        num("writeMask") ?? 0xff,
        vkStencilOp(field("failOp")),
        vkStencilOp(field("depthFailOp")),
        vkStencilOp(field("passOp")));
    }
    const blend = (f: Field): BlendState | null => (!/TRUE|^1$/.test(f("blendEnable") ?? "") ? null
      : new BlendState(
        vkFactor(f("srcColorBlendFactor"), BlendFactor.One), vkFactor(f("dstColorBlendFactor"), BlendFactor.Zero),
        vkFactor(f("srcAlphaBlendFactor"), BlendFactor.One), vkFactor(f("dstAlphaBlendFactor"), BlendFactor.Zero),
        vkOp(f("colorBlendOp")), vkOp(f("alphaBlendOp"))));
    const perAttachment = attachments !== null && attachments.length > 1 ? distinct(attachments.map(blend)) : null;
    return new Fixed(depthFunc, depthWrite, stencil, attachments !== null && attachments.length > 0 ? blend(attachments[0]!) : blend(field), perAttachment);
  },

  /**
   * DirectX 12: D3D12_DEPTH_STENCIL_DESC and D3D12_RENDER_TARGET_BLEND_DESC fields. With IndependentBlendEnable, `target`
   * gives the fields of BlendState.RenderTarget[i] (otherwise every target blends as RenderTarget[0]).
   */
  d3d12(field: Field, num: (name: string) => number | null, target: ((i: number) => Field) | null = null): Fixed {
    const d = field("DepthFunc");
    const depthFunc = d !== null ? dxCompare(d) : CompareFunc.Less;
    const depthWrite = !(field("DepthWriteMask") ?? "").includes("ZERO");
    let stencil: StencilState | null = null;
    if (/TRUE|true|^1$/.test(field("StencilEnable") ?? "")) {
      const c = field("StencilFunc");
      stencil = new StencilState(
        c !== null ? dxCompare(c) : CompareFunc.Always,
        0,
        num("StencilReadMask") ?? 0xff,
        num("StencilWriteMask") ?? 0xff,
        dxStencilOp(field("StencilFailOp")),
        dxStencilOp(field("StencilDepthFailOp")),
        dxStencilOp(field("StencilPassOp")));
    }
    const blend = (f: Field): BlendState | null => (!/TRUE|true|^1$/.test(f("BlendEnable") ?? "") ? null
      : new BlendState(
        dxFactor(f("SrcBlend"), BlendFactor.One), dxFactor(f("DestBlend"), BlendFactor.Zero),
        dxFactor(f("SrcBlendAlpha"), BlendFactor.One), dxFactor(f("DestBlendAlpha"), BlendFactor.Zero),
        dxOp(f("BlendOp")), dxOp(f("BlendOpAlpha"))));
    if (target !== null) {
      // RenderTarget[0] is the blending of every target, unless IndependentBlendEnable lets each have its own.
      const first = blend(target(0));
      const perTarget = /TRUE|true|^1$/.test(field("IndependentBlendEnable") ?? "")
        ? distinct(Array.from({ length: 8 }, (_, i) => blend(target(i)))) : null;
      return new Fixed(depthFunc, depthWrite, stencil, first, perTarget);
    }
    return new Fixed(depthFunc, depthWrite, stencil, blend(field));
  },
};

function suffix(v: string, prefix: string): string {
  const t = v.trim().replace(/;+$/, "").trim();
  const i = t.indexOf(prefix);
  return i >= 0 ? t.slice(i + prefix.length) : t;
}

function vkCompare(v: string): CompareFunc {
  switch (suffix(v, "VK_COMPARE_OP_")) {
    case "NEVER": return CompareFunc.Never;
    case "LESS": return CompareFunc.Less;
    case "EQUAL": return CompareFunc.Equal;
    case "LESS_OR_EQUAL": return CompareFunc.LessEqual;
    case "GREATER": return CompareFunc.Greater;
    case "NOT_EQUAL": return CompareFunc.NotEqual;
    case "GREATER_OR_EQUAL": return CompareFunc.GreaterEqual;
    default: return CompareFunc.Always;
  }
}

function dxCompare(v: string): CompareFunc {
  switch (suffix(v, "D3D12_COMPARISON_FUNC_")) {
    case "NEVER": return CompareFunc.Never;
    case "LESS": return CompareFunc.Less;
    case "EQUAL": return CompareFunc.Equal;
    case "LESS_EQUAL": return CompareFunc.LessEqual;
    case "GREATER": return CompareFunc.Greater;
    case "NOT_EQUAL": return CompareFunc.NotEqual;
    case "GREATER_EQUAL": return CompareFunc.GreaterEqual;
    default: return CompareFunc.Always;
  }
}

function vkStencilOp(v: string | null): StencilOp {
  switch (suffix(v ?? "", "VK_STENCIL_OP_")) {
    case "ZERO": return StencilOp.Zero;
    case "REPLACE": return StencilOp.Replace;
    case "INCREMENT_AND_CLAMP": return StencilOp.Increment;
    case "INCREMENT_AND_WRAP": return StencilOp.IncrementWrap;
    case "DECREMENT_AND_CLAMP": return StencilOp.Decrement;
    case "DECREMENT_AND_WRAP": return StencilOp.DecrementWrap;
    case "INVERT": return StencilOp.Invert;
    default: return StencilOp.Keep;
  }
}

function dxStencilOp(v: string | null): StencilOp {
  switch (suffix(v ?? "", "D3D12_STENCIL_OP_")) {
    case "ZERO": return StencilOp.Zero;
    case "REPLACE": return StencilOp.Replace;
    case "INCR_SAT": return StencilOp.Increment;
    case "INCR": return StencilOp.IncrementWrap;
    case "DECR_SAT": return StencilOp.Decrement;
    case "DECR": return StencilOp.DecrementWrap;
    case "INVERT": return StencilOp.Invert;
    default: return StencilOp.Keep;
  }
}

const VkFactors: Record<string, BlendFactor> = {
  ZERO: BlendFactor.Zero, ONE: BlendFactor.One, SRC_COLOR: BlendFactor.SrcColor, ONE_MINUS_SRC_COLOR: BlendFactor.OneMinusSrcColor,
  DST_COLOR: BlendFactor.DstColor, ONE_MINUS_DST_COLOR: BlendFactor.OneMinusDstColor, SRC_ALPHA: BlendFactor.SrcAlpha,
  ONE_MINUS_SRC_ALPHA: BlendFactor.OneMinusSrcAlpha, DST_ALPHA: BlendFactor.DstAlpha, ONE_MINUS_DST_ALPHA: BlendFactor.OneMinusDstAlpha,
  CONSTANT_COLOR: BlendFactor.ConstantColor, ONE_MINUS_CONSTANT_COLOR: BlendFactor.OneMinusConstantColor,
  CONSTANT_ALPHA: BlendFactor.ConstantAlpha, ONE_MINUS_CONSTANT_ALPHA: BlendFactor.OneMinusConstantAlpha,
};

const DxFactors: Record<string, BlendFactor> = {
  ZERO: BlendFactor.Zero, ONE: BlendFactor.One, SRC_COLOR: BlendFactor.SrcColor, INV_SRC_COLOR: BlendFactor.OneMinusSrcColor,
  DEST_COLOR: BlendFactor.DstColor, INV_DEST_COLOR: BlendFactor.OneMinusDstColor, SRC_ALPHA: BlendFactor.SrcAlpha,
  INV_SRC_ALPHA: BlendFactor.OneMinusSrcAlpha, DEST_ALPHA: BlendFactor.DstAlpha, INV_DEST_ALPHA: BlendFactor.OneMinusDstAlpha,
  BLEND_FACTOR: BlendFactor.ConstantColor, INV_BLEND_FACTOR: BlendFactor.OneMinusConstantColor,
};

function vkFactor(v: string | null, fallback: BlendFactor): BlendFactor {
  if (v === null) return fallback;
  const s = suffix(v, "VK_BLEND_FACTOR_");
  return Object.prototype.hasOwnProperty.call(VkFactors, s) ? VkFactors[s]! : fallback;
}

function dxFactor(v: string | null, fallback: BlendFactor): BlendFactor {
  if (v === null) return fallback;
  const s = suffix(v, "D3D12_BLEND_");
  return Object.prototype.hasOwnProperty.call(DxFactors, s) ? DxFactors[s]! : fallback;
}

function vkOp(v: string | null): BlendOp {
  switch (suffix(v ?? "", "VK_BLEND_OP_")) {
    case "SUBTRACT": return BlendOp.Subtract;
    case "REVERSE_SUBTRACT": return BlendOp.ReverseSubtract;
    case "MIN": return BlendOp.Min;
    case "MAX": return BlendOp.Max;
    default: return BlendOp.Add;
  }
}

function dxOp(v: string | null): BlendOp {
  switch (suffix(v ?? "", "D3D12_BLEND_OP_")) {
    case "SUBTRACT": return BlendOp.Subtract;
    case "REV_SUBTRACT": return BlendOp.ReverseSubtract;
    case "MIN": return BlendOp.Min;
    case "MAX": return BlendOp.Max;
    default: return BlendOp.Add;
  }
}
