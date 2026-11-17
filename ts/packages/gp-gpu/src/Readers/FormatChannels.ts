import { matchesAll } from "../internal/regex.js";

/**
 * The colour channels a render target format stores: an R8 / R16F target keeps red only, so a shader that samples it
 * reads (r, 0, 0, 1); an RG target (r, g, 0, 1). The APIs' format names: GL_R8, GL_RED, GL_RG16F; VK_FORMAT_R8_UNORM,
 * VK_FORMAT_R16G16_SFLOAT; DXGI_FORMAT_R8_UNORM, DXGI_FORMAT_R16G16_FLOAT.
 */
export const FormatChannels = {
  of(format: string | null | undefined): number {
    if (!format) return 4;
    const f = format.trim();
    if (/^GL_(?:RED|R\d+(?:F|I|UI|_SNORM)?)$/.test(f)) return 1;
    if (/^GL_(?:RG|RG\d+(?:F|I|UI|_SNORM)?)$/.test(f)) return 2;
    // VK_FORMAT_R16G16_SFLOAT, DXGI_FORMAT_R8_UNORM: the component letters before the numeric type.
    const m = /^(?:VK_FORMAT_|DXGI_FORMAT_)((?:[RGBAX]\d+)+)_/.exec(f);
    if (m === null) return 4;
    const letters = matchesAll(/[RGBA]/g, m[1]!).length;
    return letters >= 1 && letters <= 4 ? letters : 4;
  },

  /** The channels of each attachment, or null when every one keeps at least red, green and blue. */
  list(channels: Iterable<number>): number[] | null {
    const list = [...channels];
    return list.some((c) => c < 3) ? list : null;
  },
};
