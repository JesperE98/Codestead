import { trimNet } from "../internal/dotnet.js";
import { escapeRegex } from "../internal/regex.js";
import type { GpuProject } from "../GpuProject.js";
import type { Scene } from "../Scene/Scene.js";
import { SimNote } from "../Scene/SimNote.js";
import type { Image } from "../Textures/Image.js";
import { Png } from "../Textures/Png.js";
import { RadianceHdr } from "../Textures/RadianceHdr.js";
import { Wrap } from "../Textures/Wrap.js";
import { CppSource } from "./CppSource.js";

const Assign = /(?<var>[A-Za-z_]\w*)\s*=\s*(?:\([^()]*\)\s*)?$/;

/** The last index of ';', '{' or '}' at or before an offset (string.LastIndexOfAny). */
function lastStatementStart(code: string, from: number): number {
  for (let i = from; i >= 0; i--) {
    const c = code[i];
    if (c === ";" || c === "{" || c === "}") return i;
  }
  return -1;
}

/**
 * The images a program loads with stb_image (learnopengl.com and vulkan-tutorial.com use it; so do the course's DirectX
 * 12 projects): <c>stbi_load("container.png", &amp;width, &amp;height, &amp;nrChannels, 0)</c>, flipped when the program
 * calls <c>stbi_set_flip_vertically_on_load(true)</c>. (A C# record.)
 */
export class StbImage {
  constructor(
    readonly file: string,
    readonly image: Image | null,
    readonly offset: number,
    readonly variable: string | null,
    readonly arg: string = "",
    readonly flip: boolean = false,
    readonly wanted: number = 0,
  ) {}

  /** The record's `with { File = …, Image = … }`. */
  with(changes: { file?: string; image?: Image | null }): StbImage {
    return new StbImage(changes.file ?? this.file, changes.image !== undefined ? changes.image : this.image, this.offset, this.variable, this.arg, this.flip, this.wanted);
  }

  /** Loads an image file of the project the way stbi_load would (null when missing or not a PNG). */
  static load(project: GpuProject, file: string, flip: boolean, wanted: number): Image | null {
    const bytes = project.findAsset(file);
    let image = bytes === null ? null : StbImage.decode(bytes);
    if (image === null) return null;
    if (wanted > 0) image = image.with({ channels: wanted });
    return flip ? image.flippedVertically() : image;
  }

  /**
   * The byte at an offset into the pixels stbi_load returns (read through a pointer: pixelOffset[0]): rows of `channels`
   * tightly packed channels – a grey image's grey, then its alpha.
   */
  static byte(img: Image, channels: number, at: number): number | null {
    if (channels <= 0 || at < 0 || at >= img.width * img.height * channels) return at >= 0 ? 0 : null;
    const pixel = Math.trunc(at / channels);
    let c = at % channels;
    // A grey image (one or two channels): the grey, then the alpha.
    if (channels <= 2 && c === 1) c = 3;
    return img.rgba[pixel * 4 + c]!;
  }

  /** The number of channels of an image file (what stbi_load reports in its channels out-parameter). */
  static fileChannels(project: GpuProject, file: string): number {
    const bytes = project.findAsset(file);
    const image = bytes === null ? null : StbImage.decode(bytes);
    return image !== null ? image.channels : 4;
  }

  /** A PNG, or a Radiance .hdr (its floats kept: radiance above 1.0). */
  static decode(bytes: Uint8Array): Image | null {
    return RadianceHdr.isHdr(bytes) ? RadianceHdr.decode(bytes) : Png.decode(bytes);
  }

  /** Every stbi_load call in source order, with the image (null when the file is not in the project). */
  static all(src: CppSource, project: GpuProject, scene: Scene): StbImage[] {
    const flips = src.calls("stbi_set_flip_vertically_on_load").map((c) => ({ offset: c.offset, on: /^\s*(?:true|1|TRUE)\s*$/.test(c.arg(0)), fn: src.functionAt(c.offset) }));
    const list: StbImage[] = [];
    // stbi_load (8-bit images) and stbi_loadf (floats: a Radiance .hdr environment map), in source order.
    const calls = [...src.calls("stbi_load"), ...src.calls("stbi_loadf")].sort((a, b) => a.offset - b.offset);
    for (const call of calls) {
      // The flip in effect: a call earlier in the same function (learnopengl's loadCubemap turns it off), else the
      // program's setting (stbi_set_flip_vertically_on_load(true) in main).
      const fnHere = src.functionAt(call.offset);
      const local = flips.filter((f) => f.fn === fnHere && f.offset < call.offset).pop();
      const flip = local !== undefined && local.fn !== null ? local.on : flips.some((f) => f.on);
      // A path indexed by a variable (faces[i] in learnopengl's loadCubemap) is only known while the loop runs.
      const indexed = /\[\s*[A-Za-z_]/.test(call.arg(0));
      const literal = CppSource.stringArg(call.arg(0))
        ?? (indexed ? null : (src.evaluate(trimNet(call.arg(0)).replace(/\.c_str\(\)$/, ""))?.text ?? null));
      const file = literal ?? "";
      const wanted = src.int(call.arg(4).replaceAll("STBI_rgb_alpha", "4").replaceAll("STBI_rgb", "3").replaceAll("STBI_default", "0")) ?? 0;
      if (literal === null) {
        // The path is a variable (learnopengl's loadTexture(path)): the reader resolves it when it runs.
        const v0 = Assign.exec(src.code.slice(lastStatementStart(src.code, Math.max(0, call.offset - 1)) + 1, call.offset).trimEnd());
        list.push(new StbImage("", null, call.offset, v0 !== null ? v0.groups!["var"]! : null, call.arg(0), flip, wanted));
        continue;
      }
      const lineStart = lastStatementStart(src.code, Math.max(0, call.offset - 1)) + 1;
      const before = src.code.slice(lineStart, call.offset);
      const m = Assign.exec(before.trimEnd());
      const variable = m !== null ? m.groups!["var"]! : null;
      const bytes = project.findAsset(file);
      let image: Image | null = null;
      if (bytes === null) scene.notes.push(SimNote.error("textureFileMissing", ["file", file]));
      else if ((image = StbImage.decode(bytes)) === null) scene.notes.push(SimNote.error("textureNotPng", ["file", file]));
      if (image !== null) {
        if (wanted > 0) image = image.with({ channels: wanted });
        if (flip) image = image.flippedVertically();
      }
      list.push(new StbImage(file, image, call.offset, variable, call.arg(0), flip, wanted));
    }
    return list;
  }

  /**
   * The images in the order the program loads them, for the explicit APIs: a stbi_load inside a helper whose path is a
   * parameter (LoadTexture("container2.png", …)) counts once per call of the helper, with that call's file name.
   */
  static inLoadOrder(src: CppSource, project: GpuProject, scene: Scene): StbImage[] {
    const list: { order: number; image: StbImage }[] = [];
    for (const img of StbImage.all(src, project, scene)) {
      if (img.file !== "" || trimNet(img.arg) === "") {
        list.push({ order: img.offset, image: img });
        continue;
      }
      const fn = src.functionAt(img.offset);
      const header = fn === null ? null : new RegExp(String.raw`(?<![\w.>])` + escapeRegex(fn) + String.raw`\s*\(([^()]*)\)\s*(?:const\s*)?\{`).exec(src.code);
      if (header === null) continue;
      const parameters = CppSource.splitArgs(header[1]!).map((p) => /(\w+)\s*$/.exec(p)?.[1] ?? "");
      const index = parameters.indexOf(trimNet(img.arg).replace(/\.c_str\(\)$/, ""));
      if (index < 0) continue;
      const calls = [...src.calls(fn!), ...src.calls("." + fn)].sort((a, b) => a.offset - b.offset);
      for (const call of calls) {
        const file = CppSource.stringArg(call.arg(index));
        if (file === null) continue;
        const image = StbImage.load(project, file, img.flip, img.wanted);
        if (image === null) scene.notes.push(SimNote.error("textureFileMissing", ["file", file]));
        list.push({ order: call.offset, image: img.with({ file, image }) });
      }
    }
    // OrderBy is stable, as Array.prototype.sort is.
    return list.sort((a, b) => a.order - b.order).map((x) => x.image);
  }

  /** The sampler state of a Vulkan VkSamplerCreateInfo or a DirectX 12 sampler description, by its field values. */
  static wrapOf(value: string | null | undefined): Wrap {
    if (value === null || value === undefined) return Wrap.Repeat;
    if (value.includes("MIRROR")) return Wrap.MirroredRepeat;
    if (value.includes("BORDER")) return Wrap.ClampToBorder;
    if (value.includes("CLAMP")) return Wrap.ClampToEdge;
    return Wrap.Repeat;
  }
}

