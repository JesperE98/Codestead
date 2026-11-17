// GlReader.Textures.cs: glTexImage2D and the images it reads: the bound texture, stb_image's data, formats with other
// channel counts.
import { clamp, roundEven, toByte, trimNet } from "../internal/dotnet.js";
import { SimNote } from "../Scene/SimNote.js";
import { Image } from "../Textures/Image.js";
import { FormatChannels } from "./FormatChannels.js";
import { isFloatFormat } from "./GlReader.Advanced.js";
import { GlInvalidEnum, glError } from "./GlReader.Debug.js";
import type { GlReader } from "./GlReader.js";
import type { TextureObject } from "./GlState.js";
import { StbImage } from "./StbImage.js";

/** @internal The texture the texture calls change: the one a glTexture* call names, else the one bound to the active unit. */
export function boundTexture(r: GlReader): TextureObject | null {
  if (r.namedTexture !== null) return r.namedTexture;
  const name = r.gl.units.get(r.gl.activeUnit);
  return name !== undefined ? r.gl.textureObjects.get(name) ?? null : null;
}

/**
 * @internal glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data): the image stb_image
 * loaded into <c>data</c>. A format with another number of channels than the data reads the bytes wrongly, as on a real
 * GPU.
 */
export function texImage(r: GlReader, a: readonly string[], line: number): void {
  const tex = boundTexture(r);
  if (tex === null || a.length < 9) {
    r.scene.notes.push(SimNote.warning("noTextureBound", ["line", String(line)]));
    return;
  }
  // Not a texture target (glTexImage2D(GL_FRAMEBUFFER, …): learnopengl's debugging mistake): an error, no upload.
  const targetName = trimNet(a[0]!);
  if (/^GL_[A-Z0-9_]+$/.test(targetName) && !/^GL_(?:PROXY_)?TEXTURE_(?:2D|1D_ARRAY|RECTANGLE|CUBE_MAP)/.test(targetName)) {
    glError(r, GlInvalidEnum, `GL_INVALID_ENUM in glTexImage2D(target=${targetName})`);
    return;
  }
  // A cube map face: GL_TEXTURE_CUBE_MAP_POSITIVE_X + i.
  let face = -1;
  const faceMatch = /GL_TEXTURE_CUBE_MAP_(POSITIVE|NEGATIVE)_([XYZ])\s*(?:\+\s*(.+))?$/.exec(trimNet(a[0]!));
  if (faceMatch !== null) {
    face = "XYZ".indexOf(faceMatch[2]![0]!) * 2 + (faceMatch[1] === "NEGATIVE" ? 1 : 0)
      + (faceMatch[3] !== undefined ? r.int(faceMatch[3]) ?? 0 : 0);
    tex.isCube = true;
  }
  const data = r.dataName(a[8]!);
  const heldData = data === "NULL" || data === "nullptr" || data === "0" ? null : r.eval(data)?.text ?? null;
  if (data === "NULL" || data === "nullptr" || data === "0" || heldData === "nullptr" || heldData === "NULL") {
    // No data: the texture is drawn into (a framebuffer's colour or depth attachment).
    tex.width = r.int(a[3]!) ?? 0;
    tex.height = r.int(a[4]!) ?? 0;
    tex.float = isFloatFormat(a[2]!);
    tex.isDepth = a[2]!.includes("DEPTH");
    tex.components = 4;
    tex.channels = FormatChannels.of(a[2]!);
    // An empty image (a space's glyph: 0 × 0): a texture with nothing in it, which reads 0.
    if (tex.width === 0 || tex.height === 0) tex.image = new Image(1, 1, 4, new Uint8Array([0, 0, 0, 0]), [0, 0, 0, 0]);
    return;
  }
  // The image the data names: one loaded while the program ran (its variable holds its name), or the last
  // stbi_load into a variable of that name before this call.
  const held = r.eval(data)?.text ?? null;
  const remembered = held !== null ? r.loadedImages.get(held) : undefined;
  let loaded: StbImage | null = remembered !== undefined ? remembered
    : r.images.filter((i) => i.variable === data && i.offset < r.statementOffset).at(-1) ?? null;
  let image = loaded?.image ?? null;
  if (loaded !== null && image === null && loaded.file === "") {
    const path = r.eval(loaded.arg)?.text ?? null;
    if (path !== null) {
      // stbi_load(path, …) inside a helper: the path is the helper's argument.
      image = StbImage.load(r.project, path, loaded.flip, loaded.wanted);
      if (image === null) r.scene.notes.push(SimNote.error("textureFileMissing", ["file", path]));
      loaded = loaded.with({ file: path });
    }
  }
  // Data computed by the program (the SSAO noise: std::vector<glm::vec3> ssaoNoise, &ssaoNoise[0]): its numbers,
  // GL_FLOAT values as they are, row by row from the bottom (OpenGL's first row is v = 0).
  if (image === null && loaded === null) {
    const values = r.numbers(data);
    const w = values !== null && values.length > 0 ? r.int(a[3]!) : null;
    const h = w !== null ? r.int(a[4]!) : null;
    if (values !== null && w !== null && h !== null && w > 0 && h > 0) {
      const per = Math.max(1, components(a[6]!));
      // Bytes (GL_UNSIGNED_BYTE: a FreeType glyph's coverage) are 0–255; each row starts at a multiple of
      // GL_UNPACK_ALIGNMENT (4 unless glPixelStorei says otherwise) – learnopengl sets 1 for its glyphs.
      const ofBytes = a[7]!.includes("UNSIGNED_BYTE");
      const align = r.gl.unpackAlignment;
      const rowLength = ofBytes ? Math.trunc((w * per + align - 1) / align) * align : w * per;
      const floats = new Array<number>(w * h * 4).fill(0);
      const bytes = new Uint8Array(w * h * 4);
      for (let i = 0; i < w * h; i++)
        for (let k = 0; k < 4; k++) {
          const at = Math.trunc(i / w) * rowLength + (i % w) * per + k;
          let v = k < per ? (at < values.length ? values[at]! : 0) : k === 3 ? 1 : 0;
          if (ofBytes && k < per) v /= 255.0;
          floats[i * 4 + k] = v;
          bytes[i * 4 + k] = toByte(roundEven(clamp(v, 0, 1) * 255));
        }
      tex.components = per === 4 ? 4 : 3;
      tex.float = isFloatFormat(a[2]!) || a[7]!.includes("FLOAT");
      const computed = new Image(w, h, 4, bytes, floats);
      if (face >= 0) {
        if (face < 6) tex.faces[face] = computed;
      } else tex.image = computed;
      tex.mipmaps = false;
      return;
    }
  }
  if (image === null) return;
  // The internal format: GL_SRGB / GL_SRGB_ALPHA (also through a variable: learnopengl's loadTexture with gammaCorrection).
  tex.srgb = a[2]!.includes("SRGB") || (r.eval(a[2]!)?.text ?? "").includes("SRGB");
  const count = components(a[6]!);
  // A format in a variable (learnopengl's loadTexture: GL_RED / GL_RGB / GL_RGBA by nrComponents) fits the image.
  tex.components = count === 4 || (count === 0 && image.channels === 4) ? 4 : 3;
  const uploaded = image.channels === count || count === 0 ? image : reinterpret(image, image.channels, count);
  if (face >= 0) {
    if (face < 6) tex.faces[face] = uploaded;
  } else tex.image = uploaded;
  if (image.channels !== count && count !== 0)
    r.scene.notes.push(SimNote.warning("textureFormatMismatch", ["file", loaded!.file], ["channels", String(image.channels)], ["format", trimNet(a[6]!)]));
  tex.mipmaps = false;
}

function components(format: string): number {
  switch (trimNet(format)) {
    case "GL_RGBA":
    case "GL_BGRA":
      return 4;
    case "GL_RGB":
    case "GL_BGR":
      return 3;
    case "GL_RG":
      return 2;
    case "GL_RED":
      return 1;
    default:
      return 0;
  }
}

/** The bytes of an image with `actual` channels read as if it had `assumed`. */
function reinterpret(image: Image, actual: number, assumed: number): Image {
  const n = image.width * image.height;
  const packed = new Uint8Array(n * actual);
  for (let i = 0; i < n; i++) for (let k = 0; k < actual; k++) packed[i * actual + k] = image.rgba[i * 4 + Math.min(k, 3)]!;
  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) {
      const at = i * assumed + Math.min(k, assumed - 1);
      rgba[i * 4 + k] = k < assumed ? (at < packed.length ? packed[at]! : 0) : k === 3 ? 255 : rgba[i * 4]!;
    }
  }
  return image.with({ rgba, channels: assumed });
}
