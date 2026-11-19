// GlReader.Advanced.cs: the calls of learnopengl.com's "Advanced OpenGL" part: the depth function and mask, the stencil
// test, blending, the colour mask, framebuffer objects and renderbuffers, blits, cube maps, uniform buffer objects,
// buffer updates (glBufferSubData, glMapBuffer, glCopyBufferSubData), instancing and point sizes.
import { parseInt32, roundEven, toInt, trimChars, trimNet } from "../internal/dotnet.js";
// libm: sin, cos, pow … as C#'s Math.Sin, Math.Pow … compute them on Linux (glibc), instead of V8's Math.* (see internal/libm.ts).
import * as libm from "../internal/libm.js";
import { BlendFactor } from "../Scene/BlendFactor.js";
import { BlendOp } from "../Scene/BlendOp.js";
import type { BlendState } from "../Scene/BlendState.js";
import { CompareFunc } from "../Scene/CompareFunc.js";
import { CopyOp } from "../Scene/FrameOp.js";
import { RenderTarget } from "../Scene/RenderTarget.js";
import { StencilOp } from "../Scene/StencilOp.js";
import { ShaderRunner } from "../Shading/ShaderRunner.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import { CppSource } from "./CppSource.js";
import { FormatChannels } from "./FormatChannels.js";
import { names, objOf, vaoOf } from "./GlReader.Calls.js";
import { draw } from "./GlReader.Draw.js";
import { boundTexture } from "./GlReader.Textures.js";
import type { GlReader } from "./GlReader.js";
import { Attribute, FramebufferObject, Renderbuffer, TextureObject, type ProgramObject } from "./GlState.js";

/** @internal Handles a call of the advanced part; false when it is not one of them. */
export function advancedCall(r: GlReader, name: string, a: readonly string[], lhs: string | null, line: number): boolean {
  const A = (i: number): string => (i < a.length ? trimNet(a[i]!) : "");
  const gl = r.gl;
  const scene = r.scene;
  switch (name) {
    case "glDepthFunc":
      gl.depthFunc = compareOf(A(0));
      return true;
    case "glDepthMask":
      gl.depthMask = isTrue(A(0));
      return true;
    case "glStencilFunc":
    case "glStencilFuncSeparate": {
      const o = name === "glStencilFuncSeparate" ? 1 : 0;
      gl.stencil = gl.stencil.with({ func: compareOf(A(o)), ref: r.int(A(o + 1)) ?? 0, readMask: r.int(A(o + 2)) ?? 0xff });
      return true;
    }
    case "glStencilOp":
    case "glStencilOpSeparate": {
      const o = name === "glStencilOpSeparate" ? 1 : 0;
      gl.stencil = gl.stencil.with({ stencilFail: stencilOpOf(A(o)), depthFail: stencilOpOf(A(o + 1)), pass: stencilOpOf(A(o + 2)) });
      return true;
    }
    case "glStencilMask":
    case "glStencilMaskSeparate":
      gl.stencil = gl.stencil.with({ writeMask: r.int(A(name === "glStencilMask" ? 0 : 1)) ?? 0xff });
      return true;
    // The calls without i set every draw buffer's blending; glBlendFunci & co. one buffer's (OpenGL 4.0).
    case "glBlendFunc":
      setBlend(r, null, (b) => b.with({ srcColor: factorOf(A(0)), dstColor: factorOf(A(1)), srcAlpha: factorOf(A(0)), dstAlpha: factorOf(A(1)) }));
      return true;
    case "glBlendFuncSeparate":
      setBlend(r, null, (b) => b.with({ srcColor: factorOf(A(0)), dstColor: factorOf(A(1)), srcAlpha: factorOf(A(2)), dstAlpha: factorOf(A(3)) }));
      return true;
    case "glBlendEquation":
      setBlend(r, null, (b) => b.with({ colorOp: blendOpOf(A(0)), alphaOp: blendOpOf(A(0)) }));
      return true;
    case "glBlendEquationSeparate":
      setBlend(r, null, (b) => b.with({ colorOp: blendOpOf(A(0)), alphaOp: blendOpOf(A(1)) }));
      return true;
    case "glBlendFunci":
      setBlend(r, r.int(A(0)) ?? 0, (b) => b.with({ srcColor: factorOf(A(1)), dstColor: factorOf(A(2)), srcAlpha: factorOf(A(1)), dstAlpha: factorOf(A(2)) }));
      return true;
    case "glBlendFuncSeparatei":
      setBlend(r, r.int(A(0)) ?? 0, (b) => b.with({ srcColor: factorOf(A(1)), dstColor: factorOf(A(2)), srcAlpha: factorOf(A(3)), dstAlpha: factorOf(A(4)) }));
      return true;
    case "glBlendEquationi":
      setBlend(r, r.int(A(0)) ?? 0, (b) => b.with({ colorOp: blendOpOf(A(1)), alphaOp: blendOpOf(A(1)) }));
      return true;
    case "glBlendEquationSeparatei":
      setBlend(r, r.int(A(0)) ?? 0, (b) => b.with({ colorOp: blendOpOf(A(1)), alphaOp: blendOpOf(A(2)) }));
      return true;
    case "glEnablei":
    case "glDisablei": {
      if (!A(0).includes("GL_BLEND")) break;
      const buffer = r.int(A(1)) ?? 0;
      if (name === "glDisablei") gl.bufferBlends.set(buffer, null);
      else gl.bufferBlends.delete(buffer);
      return true;
    }
    case "glBlendColor":
      gl.blendState = gl.blendState.with({ constant: a.map((x) => r.eval(x)?.x ?? 0) });
      return true;
    case "glColorMask":
      gl.colorMask = [0, 1, 2, 3].map((i) => isTrue(A(i)));
      return true;
    case "glPointSize":
      gl.pointSize = r.eval(A(0))?.x ?? 1;
      return true;

    // ---------- framebuffers ----------
    case "glGenFramebuffers":
      for (const n of names(r, A(0), A(1))) gl.framebuffers.set(n, new FramebufferObject());
      return true;
    case "glBindFramebuffer": {
      const fbo = r.obj(A(1)) === "0" ? null : r.obj(A(1));
      if (A(0).includes("GL_READ_FRAMEBUFFER")) gl.readFramebuffer = fbo;
      else if (A(0).includes("GL_DRAW_FRAMEBUFFER")) gl.drawFramebuffer = fbo;
      else gl.readFramebuffer = gl.drawFramebuffer = fbo;
      return true;
    }
    case "glGenRenderbuffers":
      for (const n of names(r, A(0), A(1))) gl.renderbuffers.set(n, new Renderbuffer());
      return true;
    case "glBindRenderbuffer":
      gl.currentRenderbuffer = r.obj(A(1)) === "0" ? null : r.obj(A(1));
      return true;
    case "glRenderbufferStorage":
    case "glRenderbufferStorageMultisample": {
      const rb = gl.currentRenderbuffer !== null ? gl.renderbuffers.get(gl.currentRenderbuffer) : undefined;
      if (rb === undefined) return true;
      const o = name === "glRenderbufferStorage" ? 1 : 2;
      rb.samples = name === "glRenderbufferStorage" ? 1 : r.int(A(1)) ?? 1;
      rb.format = A(o);
      rb.width = r.int(A(o + 1)) ?? 0;
      rb.height = r.int(A(o + 2)) ?? 0;
      return true;
    }
    case "glFramebufferRenderbuffer": {
      const fb = boundFramebuffer(r, A(0));
      if (fb === null) return true;
      const rbo = gl.renderbuffers.get(r.obj(A(3))) ?? null;
      if (A(1).includes("DEPTH_STENCIL")) fb.depth = fb.stencil = true;
      else if (A(1).includes("DEPTH")) fb.depth = true;
      else if (A(1).includes("STENCIL")) fb.stencil = true;
      if (rbo !== null) {
        fb.samples = Math.max(fb.samples, rbo.samples);
        if (fb.width === 0) [fb.width, fb.height] = [rbo.width, rbo.height];
        if (A(1).includes("COLOR_ATTACHMENT"))
          fb.colors.set(attachmentIndex(r, A(1)), new TextureObject({ width: rbo.width, height: rbo.height, samples: rbo.samples, float: isFloatFormat(rbo.format), minFilter: "GL_LINEAR" }));
      }
      return true;
    }
    case "glFramebufferTexture2D":
    case "glFramebufferTexture": {
      const fb = boundFramebuffer(r, A(0));
      if (fb === null) return true;
      const texArg = name === "glFramebufferTexture2D" ? A(3) : A(2);
      // The texture itself (its own name: mip.texture of a struct copied into a vector names the texture it
      // got, not the last one made through that variable).
      const texName = objOf(r, texArg, (n) => gl.textureObjects.has(n));
      const tex = gl.textureObjects.get(texName);
      if (tex === undefined) return true;
      const fboName = A(0).includes("READ") ? gl.readFramebuffer! : gl.drawFramebuffer!;
      // Another texture in place of the one attached (learnopengl's bloom mip chain: one framebuffer, a
      // texture per level): from now on each draw goes to the texture attached then, as for a mip level.
      const before = fb.colors.get(0);
      if (!fb.perTexture && !A(1).includes("DEPTH") && attachmentIndex(r, A(1)) === 0 && fb.colors.size === 1 && before !== undefined && before !== tex) {
        perTextureFrom(r, fboName, before);
        fb.perTexture = true;
      }
      // A face of a cube map (GL_TEXTURE_CUBE_MAP_POSITIVE_X + i) or a mip level: the attachment changes from
      // draw to draw, so each draw goes to the texture's own target for that face and level.
      let cubeFace = -1;
      const level = r.int(A(name === "glFramebufferTexture2D" ? 4 : 3)) ?? 0;
      const faceOf = name === "glFramebufferTexture2D" ? /GL_TEXTURE_CUBE_MAP_(POSITIVE|NEGATIVE)_([XYZ])\s*(?:\+\s*(.+))?$/.exec(A(2)) : null;
      if (faceOf !== null)
        cubeFace = "XYZ".indexOf(faceOf[2]![0]!) * 2 + (faceOf[1] === "NEGATIVE" ? 1 : 0) + (faceOf[3] !== undefined ? r.int(faceOf[3]) ?? 0 : 0);
      if (!A(1).includes("DEPTH") && (cubeFace >= 0 || level > 0 || fb.perTexture)) {
        fb.perTexture = true;
        fb.targetTexture = texName;
        fb.targetFace = cubeFace;
        fb.targetLevel = level;
        fb.colors.clear();
        fb.colors.set(0, tex);
        [fb.width, fb.height] = [Math.max(1, tex.width >> level), Math.max(1, tex.height >> level)];
        tex.framebuffer = "tex:" + fb.targetTexture;
        tex.attachment = 0;
        tex.targetLevels = Math.max(tex.targetLevels, level + 1);
        return true;
      }
      // A depth texture another framebuffer has attached already: both use one depth buffer (its owner's,
      // which a shader that samples the texture reads).
      const owner = tex.framebuffer;
      if (A(1).includes("DEPTH") && owner !== null && owner !== fboName && gl.framebuffers.has(owner)) fb.depthOf = owner;
      else tex.framebuffer = fboName;
      fb.samples = Math.max(fb.samples, tex.samples);
      // glFramebufferTexture (not …2D) attaches every layer: a cube map's six faces.
      if (name === "glFramebufferTexture" && tex.isCube) fb.layers = 6;
      // … and a texture array's layers (gl_Layer picks one).
      else if (name === "glFramebufferTexture" && tex.layers > 1) fb.layers = tex.layers;
      if (fb.width === 0) [fb.width, fb.height] = [tex.width, tex.height];
      if (A(1).includes("DEPTH")) {
        fb.depth = true;
        if (A(1).includes("STENCIL")) fb.stencil = true;
        tex.isDepth = true;
      } else {
        tex.attachment = attachmentIndex(r, A(1));
        fb.colors.set(tex.attachment, tex);
      }
      return true;
    }
    case "glCheckFramebufferStatus":
      return true;
    case "glDrawBuffer":
    case "glDrawBuffers":
    case "glReadBuffer":
      return true;
    case "glBlitFramebuffer":
      if (r.inLoop) {
        // The mask says what is copied: GL_COLOR_BUFFER_BIT, GL_DEPTH_BUFFER_BIT (or both).
        const mask = a.length > 8 ? A(8) : "GL_COLOR_BUFFER_BIT";
        scene.ops.push(new CopyOp(scene.draws.length, gl.readFramebuffer, gl.drawFramebuffer,
          mask.includes("COLOR"), mask.includes("DEPTH") || mask.includes("STENCIL")));
      }
      return true;
    case "glTexImage2DMultisample": {
      const tex = boundTexture(r);
      if (tex === null) return true;
      tex.samples = r.int(A(1)) ?? 1;
      tex.float = isFloatFormat(A(2));
      tex.width = r.int(A(3)) ?? 0;
      tex.height = r.int(A(4)) ?? 0;
      tex.minFilter = "GL_LINEAR";
      return true;
    }

    // ---------- instancing, buffers, uniform blocks ----------
    case "glVertexAttribDivisor": {
      const vao = vaoOf(r);
      if (vao === null) return true;
      const loc = r.int(A(0)) ?? 0;
      let attr = vao.attributes.get(loc);
      if (attr === undefined) vao.attributes.set(loc, (attr = new Attribute()));
      attr.divisor = r.int(A(1)) ?? 0;
      return true;
    }
    case "glDrawArraysInstanced":
      draw(r, A(0), null, r.int(A(1)) ?? 0, r.int(A(2)) ?? 0, name, line, r.int(A(3)) ?? 1);
      return true;
    case "glDrawElementsInstanced":
      draw(r, A(0), A(2), r.int(A(3)) ?? 0, r.int(A(1)) ?? 0, name, line, r.int(A(4)) ?? 1);
      return true;
    case "glGetUniformBlockIndex": {
      const block = lhs !== null ? CppSource.stringArg(A(1)) : null;
      if (lhs !== null && block !== null) gl.blockIndices.set(lhs, block);
      return true;
    }
    case "glUniformBlockBinding": {
      const program = gl.programs.get(r.obj(A(0)));
      if (program === undefined) return true;
      const quoted = /"([^"]+)"/.exec(A(1));
      const blockName = gl.blockIndices.get(r.obj(A(1))) ?? (quoted !== null ? quoted[1]! : null);
      if (blockName !== null) program.blockBindings.set(blockName, r.int(A(2)) ?? 0);
      return true;
    }
    case "glBindBufferBase":
    case "glBindBufferRange":
      if (A(0).includes("GL_UNIFORM_BUFFER")) {
        const binding = r.int(A(1)) ?? 0;
        gl.uniformBindings.set(binding, { buffer: r.obj(A(2)), offset: name === "glBindBufferRange" ? r.int(A(3)) ?? 0 : 0 });
      }
      return true;
    case "glBufferSubData": {
      const target = bufferOf(r, A(0));
      if (target === null) return true;
      const offset = r.int(A(1)) ?? 0;
      if (A(0).includes("GL_UNIFORM_BUFFER")) {
        const expr = trimChars(A(3).replace(/^(?:glm::)?value_ptr\s*\((.*)\)$/, "$1"), "&", true, false);
        const value = r.eval(expr);
        if (value !== null) {
          let writes = gl.bufferWrites.get(target);
          if (writes === undefined) gl.bufferWrites.set(target, (writes = new Map()));
          writes.set(offset, value);
        }
        return true;
      }
      const numbers = r.numbers(r.dataName(A(3)));
      if (numbers !== null) writeNumbers(r, target, offset, numbers);
      return true;
    }
    case "glMapBuffer":
    case "glMapBufferRange": {
      const mapped = lhs !== null ? bufferOf(r, A(0)) : null;
      if (lhs !== null && mapped !== null) gl.mapped.set(lhs, mapped);
      return true;
    }
    case "glUnmapBuffer":
      return true;
    case "glCopyBufferSubData": {
      const from = bufferOf(r, A(0));
      const to = bufferOf(r, A(1));
      const source = from !== null ? gl.buffers.get(from) ?? null : null;
      if (from === null || to === null || source === null) return true;
      const readAt = Math.trunc((r.int(A(2)) ?? 0) / 4), writeAt = Math.trunc((r.int(A(3)) ?? 0) / 4), count = Math.trunc((r.int(A(4)) ?? 0) / 4);
      const data = gl.buffers.get(to) ?? [];
      while (data.length < writeAt + count) data.push(0);
      for (let i = 0; i < count && readAt + i < source.length; i++) data[writeAt + i] = source[readAt + i]!;
      gl.buffers.set(to, data);
      return true;
    }
  }
  return false;
}

/**
 * @internal Writes numbers into a buffer's data at a byte offset (glBufferSubData, glNamedBufferSubData): the list the
 * buffer has is changed in place (a variable that aliases the buffer shares it), grown with zeros when needed.
 */
export function writeNumbers(r: GlReader, buffer: string, offset: number, numbers: readonly number[]): void {
  const data = r.gl.buffers.get(buffer) ?? [];
  const start = Math.trunc(offset / 4);
  while (data.length < start + numbers.length) data.push(0);
  for (let i = 0; i < numbers.length; i++) data[start + i] = numbers[i]!;
  r.gl.buffers.set(buffer, data);
}

/** Changes the blending of one draw buffer, or of all of them (null). */
function setBlend(r: GlReader, buffer: number | null, change: (b: BlendState) => BlendState): void {
  const gl = r.gl;
  if (buffer !== null) {
    const own = gl.bufferBlends.get(buffer) ?? null;
    gl.bufferBlends.set(buffer, change(own !== null ? own : gl.blendState));
    return;
  }
  gl.blendState = change(gl.blendState);
  for (const b of [...gl.bufferBlends.keys()]) {
    const state = gl.bufferBlends.get(b) ?? null;
    if (state !== null) gl.bufferBlends.set(b, change(state));
  }
}

/** @internal The blending of each draw buffer, when one differs from the others (glBlendFunci); else null. */
export function attachmentBlends(r: GlReader): (BlendState | null)[] | null {
  const gl = r.gl;
  if (!gl.blend || gl.bufferBlends.size === 0) return null;
  const count = Math.max(...gl.bufferBlends.keys()) + 1;
  return Array.from({ length: count }, (_, i) => (gl.bufferBlends.has(i) ? gl.bufferBlends.get(i)! : gl.blendState));
}

/** @internal memcpy(ptr, data, size) into a buffer mapped with glMapBuffer. */
export function memcpy(r: GlReader, a: readonly string[]): void {
  const buffer = a.length < 2 ? undefined : r.gl.mapped.get(r.obj(a[0]!));
  if (buffer === undefined) return;
  const numbers = r.numbers(r.dataName(a[1]!));
  if (numbers !== null) r.gl.buffers.set(buffer, numbers.slice());
}

/** @internal The buffer bound to a target (GL_ARRAY_BUFFER, GL_ELEMENT_ARRAY_BUFFER, GL_UNIFORM_BUFFER, the copy targets). */
export function bufferOf(r: GlReader, target: string): string | null {
  const gl = r.gl;
  if (target.includes("ELEMENT_ARRAY")) return vaoOf(r)?.elementBuffer ?? null;
  if (target.includes("UNIFORM")) return gl.uniformBuffer;
  if (target.includes("COPY_READ")) return gl.copyReadBuffer;
  if (target.includes("COPY_WRITE")) return gl.copyWriteBuffer;
  return gl.arrayBuffer;
}

function boundFramebuffer(r: GlReader, target: string): FramebufferObject | null {
  const name = target.includes("READ") ? r.gl.readFramebuffer : r.gl.drawFramebuffer;
  return name !== null ? r.gl.framebuffers.get(name) ?? null : null;
}

/**
 * A framebuffer whose colour texture is swapped for another one: what was drawn into it so far belongs to the
 * texture attached before, which becomes a target of its own ("tex:name"), like every texture attached later.
 */
function perTextureFrom(r: GlReader, fbo: string, before: TextureObject): void {
  // OrderBy is stable: the first own name ("texture#3"), else the first name.
  const keys = [...r.gl.textureObjects].filter(([, v]) => v === before).map(([k]) => k);
  const name = keys.find((k) => k.includes("#")) ?? keys[0];
  if (name === undefined) return;
  const target = "tex:" + name;
  before.framebuffer = target;
  before.attachment = 0;
  const drawn = r.scene.targets.get(fbo);
  if (drawn !== undefined) {
    r.scene.targets.set(target, new RenderTarget(target, { width: Math.max(1, before.width), height: Math.max(1, before.height), colorAttachments: 1, depth: drawn.depth, stencil: drawn.stencil, samples: 1, float: before.float }));
    r.scene.ops.push(new CopyOp(r.scene.draws.length, fbo, target));
  }
}

/** @internal The render target a draw goes to (registered in the scene), or null for the window. */
export function drawTarget(r: GlReader): string | null {
  const gl = r.gl;
  const id = gl.drawFramebuffer;
  const fb = id !== null ? gl.framebuffers.get(id) : undefined;
  if (id === null || fb === undefined) return null;
  const texture = fb.targetTexture;
  const tex = texture !== null ? gl.textureObjects.get(texture) : undefined;
  if (fb.perTexture && texture !== null && tex !== undefined) {
    // The texture's own target: "tex:name" (level 0), "tex:name~2" (mip level 2), "…@3" for cube face 3.
    const levelId = levelTarget(texture, fb.targetLevel);
    r.scene.targets.set(levelId, new RenderTarget(levelId, { width: Math.max(1, tex.width >> fb.targetLevel), height: Math.max(1, tex.height >> fb.targetLevel), colorAttachments: 1, depth: fb.depth, stencil: fb.stencil, samples: 1, float: tex.float }));
    return fb.targetFace > 0 ? levelId + "@" + fb.targetFace : levelId;
  }
  register(r, id, fb);
  // The framebuffer whose depth it shares is known to the rasterizer too (it may not have drawn yet).
  const owner = fb.depthOf;
  const ownerFb = owner !== null ? gl.framebuffers.get(owner) : undefined;
  if (owner !== null && !r.scene.targets.has(owner) && ownerFb !== undefined) register(r, owner, ownerFb);
  return id;
}

function register(r: GlReader, id: string, fb: FramebufferObject): void {
  const colors = fb.colors.size === 0 ? 0 : Math.max(...fb.colors.keys()) + 1;
  r.scene.targets.set(id, new RenderTarget(id, {
    width: fb.width, height: fb.height, colorAttachments: colors, depth: fb.depth, stencil: fb.stencil, samples: fb.samples,
    float: [...fb.colors.values()].some((c) => c.float), layers: fb.layers, depthOf: fb.depthOf,
    channels: FormatChannels.list(Array.from({ length: colors }, (_, k) => fb.colors.get(k)?.channels ?? 4)),
  }));
}

const levelTarget = (texture: string, level: number): string => (level > 0 ? `tex:${texture}~${level}` : "tex:" + texture);

/**
 * @internal glGenerateMipmap on a texture that was drawn into (learnopengl's environment cube map after the capture):
 * every smaller level is the average of the level above, made now – between the draws before and after the call.
 */
export function generateTargetMips(r: GlReader, tex: TextureObject): void {
  const target = tex.framebuffer;
  if (target === null || !target.startsWith("tex:") || !r.scene.targets.has(target)) return;
  const texture = target.slice(4);
  const levels = 1 + Math.floor(libm.log2(Math.max(1, Math.max(tex.width, tex.height))));
  for (let level = 1; level < levels; level++) {
    const id = levelTarget(texture, level);
    r.scene.targets.set(id, new RenderTarget(id, { width: Math.max(1, tex.width >> level), height: Math.max(1, tex.height >> level), colorAttachments: 1, depth: false, stencil: false, samples: 1, float: tex.float }));
    for (let face = 0; face < (tex.isCube ? 6 : 1); face++) {
      const faceOf = (of: string): string => (face > 0 ? of + "@" + face : of);
      r.scene.ops.push(new CopyOp(r.scene.draws.length, faceOf(levelTarget(texture, level - 1)), faceOf(id), true, false, true));
    }
  }
  tex.targetLevels = Math.max(tex.targetLevels, levels);
}

/** GL_COLOR_ATTACHMENT1, or GL_COLOR_ATTACHMENT0 + i in learnopengl's loop (the offset worked out now). */
function attachmentIndex(r: GlReader, attachment: string): number {
  const m = /GL_COLOR_ATTACHMENT(\d+)(?:\s*\+\s*(.+))?$/.exec(attachment);
  return m !== null ? parseInt32(m[1]!) + (m[2] !== undefined ? toInt(roundEven(r.eval(m[2])?.x ?? 0)) : 0) : 0;
}

/** @internal */
export const isFloatFormat = (format: string): boolean => /16F|32F|R11F/.test(format);

const isTrue = (v: string): boolean => {
  const t = trimNet(v);
  return t === "GL_TRUE" || t === "true" || t === "1";
};

/** @internal */
export function compareOf(v: string): CompareFunc {
  switch (trimNet(v)) {
    case "GL_NEVER": return CompareFunc.Never;
    case "GL_LESS": return CompareFunc.Less;
    case "GL_EQUAL": return CompareFunc.Equal;
    case "GL_LEQUAL": return CompareFunc.LessEqual;
    case "GL_GREATER": return CompareFunc.Greater;
    case "GL_NOTEQUAL": return CompareFunc.NotEqual;
    case "GL_GEQUAL": return CompareFunc.GreaterEqual;
    default: return CompareFunc.Always;
  }
}

function stencilOpOf(v: string): StencilOp {
  switch (trimNet(v)) {
    case "GL_ZERO": return StencilOp.Zero;
    case "GL_REPLACE": return StencilOp.Replace;
    case "GL_INCR": return StencilOp.Increment;
    case "GL_INCR_WRAP": return StencilOp.IncrementWrap;
    case "GL_DECR": return StencilOp.Decrement;
    case "GL_DECR_WRAP": return StencilOp.DecrementWrap;
    case "GL_INVERT": return StencilOp.Invert;
    default: return StencilOp.Keep;
  }
}

function factorOf(v: string): BlendFactor {
  switch (trimNet(v)) {
    case "GL_ZERO": return BlendFactor.Zero;
    case "GL_SRC_COLOR": return BlendFactor.SrcColor;
    case "GL_ONE_MINUS_SRC_COLOR": return BlendFactor.OneMinusSrcColor;
    case "GL_DST_COLOR": return BlendFactor.DstColor;
    case "GL_ONE_MINUS_DST_COLOR": return BlendFactor.OneMinusDstColor;
    case "GL_SRC_ALPHA": return BlendFactor.SrcAlpha;
    case "GL_ONE_MINUS_SRC_ALPHA": return BlendFactor.OneMinusSrcAlpha;
    case "GL_DST_ALPHA": return BlendFactor.DstAlpha;
    case "GL_ONE_MINUS_DST_ALPHA": return BlendFactor.OneMinusDstAlpha;
    case "GL_CONSTANT_COLOR": return BlendFactor.ConstantColor;
    case "GL_ONE_MINUS_CONSTANT_COLOR": return BlendFactor.OneMinusConstantColor;
    case "GL_CONSTANT_ALPHA": return BlendFactor.ConstantAlpha;
    case "GL_ONE_MINUS_CONSTANT_ALPHA": return BlendFactor.OneMinusConstantAlpha;
    default: return BlendFactor.One;
  }
}

function blendOpOf(v: string): BlendOp {
  switch (trimNet(v)) {
    case "GL_FUNC_SUBTRACT": return BlendOp.Subtract;
    case "GL_FUNC_REVERSE_SUBTRACT": return BlendOp.ReverseSubtract;
    case "GL_MIN": return BlendOp.Min;
    case "GL_MAX": return BlendOp.Max;
    default: return BlendOp.Add;
  }
}

/**
 * @internal The values of a program's uniform blocks (layout (std140) uniform Matrices { … }): the block's binding
 * point (glUniformBlockBinding, 0 by default), the buffer bound there, and the glBufferSubData writes at each member's
 * std140 offset.
 */
export function blockUniforms(r: GlReader, program: ProgramObject): Map<string, ShaderValue> {
  const d = new Map<string, ShaderValue>();
  const gl = r.gl;
  for (const s of program.allStages) {
    for (const g of s.globals) {
      if (!(g.storage === "uniform" && g.block !== null && !g.pushConstant)) continue;
      const binding = program.blockBindings.get(g.type) ?? 0;
      const buf = gl.uniformBindings.get(binding);
      const writes = buf !== undefined ? gl.bufferWrites.get(buf.buffer) : undefined;
      if (buf === undefined || writes === undefined) continue;
      let offset = 0;
      for (const f of g.block) {
        const [align, size] = std140(f.type, f.arraySize);
        offset = Math.trunc((offset + align - 1) / align) * align;
        const member = g.id === "" ? f.id : g.id + "." + f.id;
        if (f.arraySize > 0) {
          // An array (mat4 lightSpaceMatrices[16]): its elements at their std140 stride, written one by one
          // (glBufferSubData per element) or several at once (a whole std::vector).
          const stride = Math.trunc(size / f.arraySize);
          const items = new Array<ShaderValue | null>(f.arraySize).fill(null);
          for (let i = 0; i < f.arraySize; i++) {
            const written = writes.get(buf.offset + offset + i * stride);
            if (written === undefined) continue;
            const parts = written.items ?? [written];
            for (let k = 0; k < parts.length && i + k < f.arraySize; k++) items[i + k] = parts[k]!;
          }
          if (items.some((x) => x !== null)) d.set(member, ShaderValue.array(items.map((x) => x ?? zeroOf(f.type))));
        } else {
          const value = writes.get(buf.offset + offset);
          if (value !== undefined) d.set(member, value);
        }
        offset += size;
      }
    }
  }
  return d;
}

/** The value of a uniform block member nothing was written to: zero. */
function zeroOf(type: string): ShaderValue {
  const n = ShaderRunner.matrixSize(type);
  if (n > 0) return ShaderValue.matrix(n, new Array<number>(n * n).fill(0));
  const v = /^[iub]?vec([234])$/.exec(type);
  if (v !== null) return ShaderValue.vecOf(new Array<number>(v[1]!.charCodeAt(0) - 48).fill(0));
  return ShaderValue.scalar(0);
}

/** @internal The std140 alignment and size of a member, in bytes. */
export function std140(type: string, arraySize: number): [number, number] {
  let align: number, size: number;
  switch (type) {
    case "vec2": case "ivec2": case "uvec2": case "bvec2": [align, size] = [8, 8]; break;
    case "vec3": case "ivec3": case "uvec3": case "bvec3": [align, size] = [16, 12]; break;
    case "vec4": case "ivec4": case "uvec4": case "bvec4": [align, size] = [16, 16]; break;
    case "mat2": case "mat2x2": [align, size] = [16, 32]; break;
    case "mat3": case "mat3x3": [align, size] = [16, 48]; break;
    case "mat4": case "mat4x4": [align, size] = [16, 64]; break;
    default: [align, size] = [4, 4];
  }
  if (arraySize > 0) {
    const stride = Math.trunc((size + 15) / 16) * 16;
    return [16, stride * arraySize];
  }
  return [align, size];
}
