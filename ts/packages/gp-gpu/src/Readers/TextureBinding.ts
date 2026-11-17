import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import type { Image } from "../Textures/Image.js";
import { SamplerState } from "../Textures/SamplerState.js";
import { Texture } from "../Textures/Texture.js";
import { StbImage } from "./StbImage.js";

/**
 * Textures for the explicit APIs: the shaders' textures (GLSL sampler2D, HLSL Texture2D), in binding / register order,
 * read the images the program loads with stb_image, in the order it loads them – the course's Vulkan and DirectX 12
 * projects create their textures in that order.
 */
export const TextureBinding = {
  shaderTextures(...shaders: ShaderProgram[]): string[] {
    const globals = shaders.flatMap((s) => s.globals)
      .filter((g) => (g.type.startsWith("sampler") && !g.type.startsWith("SamplerState")) || g.type.startsWith("Texture"));
    // OrderBy is stable, as Array.prototype.sort is.
    const ordered = globals.map((g, i) => ({ g, i })).sort((a, b) => (a.g.binding ?? 0) - (b.g.binding ?? 0) || a.i - b.i).map((x) => x.g.id);
    return [...new Set(ordered)];
  },

  /**
   * The texture lookup: shader texture i reads image i, with the sampler state `samplerFor` gives for (texture name,
   * sampler name or null).
   */
  bind(names: string[], images: StbImage[], samplerFor: (name: string, sampler: string | null) => SamplerState): (id: string, u: number, v: number) => number[] {
    const images2 = new Map<string, Image | null>();
    for (let i = 0; i < names.length; i++) images2.set(names[i]!, i < images.length ? images[i]!.image : null);
    const cache = new Map<string, Texture | null>();
    return (id, u, v) => {
      let t = cache.get(id);
      if (t === undefined) {
        const bar = id.indexOf("|");
        const name = bar < 0 ? id : id.slice(0, bar);
        const sampler = bar < 0 ? null : id.slice(bar + 1);
        const img = images2.get(name) ?? null;
        t = img !== null ? new Texture(img, samplerFor(name, sampler), { components: img.channels === 4 ? 4 : 3 }) : null;
        cache.set(id, t);
      }
      return t !== null ? t.sample(u, v) : [0, 0, 0, 1];
    };
  },

  /** A sampler state from the fields of a sampler description (Vulkan VkSamplerCreateInfo or D3D12 sampler desc). */
  fromFields(field: (name: string) => string | null, d3d: boolean): SamplerState {
    const wrapU = field(d3d ? "AddressU" : "addressModeU"), wrapV = field(d3d ? "AddressV" : "addressModeV");
    const filter = field(d3d ? "Filter" : "magFilter") ?? "LINEAR";
    const linear = d3d ? !/MAG_POINT|MIN_MAG_MIP_POINT|MIN_MAG_POINT/.test(filter) : !filter.includes("NEAREST");
    const border = field(d3d ? "BorderColor" : "borderColor") ?? "";
    const b = border.includes("WHITE") ? [1, 1, 1, 1] : border.includes("OPAQUE_BLACK") ? [0, 0, 0, 1] : null;
    return new SamplerState(StbImage.wrapOf(wrapU), StbImage.wrapOf(wrapV), linear, b);
  },
};
