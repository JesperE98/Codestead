// GlReader.Dsa.cs: direct state access (OpenGL 4.5): the calls name the object they change (glNamedBufferStorage(VBO, …),
// glTextureParameteri(texture, …)) instead of the one bound to a target, and the separate vertex attribute format of
// OpenGL 4.3 (an attribute reads a buffer binding point: glVertexArrayAttribBinding / glVertexArrayVertexBuffer).
import { trimChars, trimNet } from "../internal/dotnet.js";
import { isFloatFormat, writeNumbers } from "./GlReader.Advanced.js";
import { bufferName, call, names, objOf, vaoOf } from "./GlReader.Calls.js";
import { texImage } from "./GlReader.Textures.js";
import type { GlReader } from "./GlReader.js";
import { Attribute, BufferBinding, type VertexArray } from "./GlState.js";

/** @internal Handles a direct state access call; false when it is not one of them. */
export function dsaCall(r: GlReader, name: string, a: readonly string[], line: number): boolean {
  const A = (i: number): string => (i < a.length ? trimNet(a[i]!) : "");
  const gl = r.gl;
  switch (name) {
    // ---------- objects ----------
    case "glCreateBuffers":
      call(r, "glGenBuffers", a, null, line);
      return true;
    case "glCreateVertexArrays":
      call(r, "glGenVertexArrays", a, null, line);
      return true;
    case "glCreateFramebuffers":
      call(r, "glGenFramebuffers", a, null, line);
      return true;
    case "glCreateRenderbuffers":
      call(r, "glGenRenderbuffers", a, null, line);
      return true;
    case "glCreateTextures": {
      // glCreateTextures(target, n, &texture): made for its target now (a cube map is one from the start).
      call(r, "glGenTextures", [A(1), A(2)], null, line);
      if (A(0).includes("CUBE_MAP"))
        for (const n of names(r, A(1), A(2))) {
          const cube = gl.textureObjects.get(n);
          if (cube !== undefined) cube.isCube = true;
        }
      return true;
    }

    // ---------- buffers ----------
    case "glNamedBufferStorage":
    case "glNamedBufferData": {
      const buffer = bufferName(r, A(0));
      if (!gl.buffers.has(buffer)) return true;
      gl.buffers.set(buffer, A(2) === "NULL" || A(2) === "nullptr" || A(2) === "0"
        ? new Array<number>(Math.max(0, Math.trunc((r.int(A(1)) ?? 0) / 4))).fill(0)
        : r.numbers(r.dataName(A(2))));
      return true;
    }
    case "glNamedBufferSubData": {
      const buffer = bufferName(r, A(0));
      if (!gl.buffers.has(buffer)) return true;
      const offset = r.int(A(1)) ?? 0;
      const expr = trimChars(A(3).replace(/^(?:glm::)?value_ptr\s*\((.*)\)$/, "$1"), "&", true, false);
      // A uniform block's member (by its byte offset), and the numbers (vertex or index data).
      const value = r.eval(expr);
      if (value !== null) {
        let writes = gl.bufferWrites.get(buffer);
        if (writes === undefined) gl.bufferWrites.set(buffer, (writes = new Map()));
        writes.set(offset, value);
      }
      const numbers = r.numbers(r.dataName(A(3)));
      if (numbers !== null) writeNumbers(r, buffer, offset, numbers);
      return true;
    }

    // ---------- vertex arrays ----------
    case "glVertexArrayElementBuffer": {
      const withIndices = namedVao(r, A(0));
      if (withIndices !== null) withIndices.elementBuffer = r.obj(A(1)) === "0" ? null : bufferName(r, A(1));
      return true;
    }
    case "glEnableVertexArrayAttrib":
    case "glDisableVertexArrayAttrib": {
      const toggled = namedVao(r, A(0));
      if (toggled !== null) attributeOf(toggled, r.int(A(1)) ?? 0).enabled = name === "glEnableVertexArrayAttrib";
      return true;
    }
    case "glVertexArrayAttribFormat": {
      const formatted = namedVao(r, A(0));
      if (formatted !== null) format(formatted, r.int(A(1)) ?? 0, r.int(A(2)) ?? 4, r.int(A(5)) ?? 0);
      return true;
    }
    case "glVertexAttribFormat": {
      const current = vaoOf(r);
      if (current !== null) format(current, r.int(A(0)) ?? 0, r.int(A(1)) ?? 4, r.int(A(4)) ?? 0);
      return true;
    }
    case "glVertexArrayAttribBinding": {
      const bound = namedVao(r, A(0));
      if (bound !== null) bindAttribute(bound, r.int(A(1)) ?? 0, r.int(A(2)) ?? 0);
      return true;
    }
    case "glVertexAttribBinding": {
      const currentBinding = vaoOf(r);
      if (currentBinding !== null) bindAttribute(currentBinding, r.int(A(0)) ?? 0, r.int(A(1)) ?? 0);
      return true;
    }
    case "glVertexArrayVertexBuffer": {
      const withBuffer = namedVao(r, A(0));
      if (withBuffer !== null) setBufferBinding(r, withBuffer, r.int(A(1)) ?? 0, A(2), r.int(A(3)) ?? 0, r.int(A(4)) ?? 0);
      return true;
    }
    case "glBindVertexBuffer": {
      const currentBuffer = vaoOf(r);
      if (currentBuffer !== null) setBufferBinding(r, currentBuffer, r.int(A(0)) ?? 0, A(1), r.int(A(2)) ?? 0, r.int(A(3)) ?? 0);
      return true;
    }
    case "glVertexArrayBindingDivisor":
    case "glVertexBindingDivisor": {
      const vao = name === "glVertexArrayBindingDivisor" ? namedVao(r, A(0)) : vaoOf(r);
      const o = name === "glVertexArrayBindingDivisor" ? 1 : 0;
      if (vao === null) return true;
      const index = r.int(A(o)) ?? 0;
      let binding = vao.bindings.get(index);
      if (binding === undefined) vao.bindings.set(index, (binding = new BufferBinding()));
      binding.divisor = r.int(A(o + 1)) ?? 0;
      resolve(vao);
      return true;
    }

    // ---------- textures ----------
    case "glTextureParameteri":
    case "glTextureParameterf":
    case "glTextureParameteriv":
    case "glTextureParameterfv":
      onTexture(r, A(0), () => call(r, name.replaceAll("glTexture", "glTex"), ["GL_TEXTURE_2D", A(1), A(2)], null, line));
      return true;
    case "glTextureStorage2D": {
      // Immutable storage: the size and format; the image comes with glTextureSubImage2D.
      const stored = gl.textureObjects.get(objOf(r, A(0), (n) => gl.textureObjects.has(n)));
      if (stored !== undefined) {
        stored.storageFormat = A(2);
        stored.width = r.int(A(3)) ?? 0;
        stored.height = r.int(A(4)) ?? 0;
        stored.float = isFloatFormat(A(2));
        stored.isDepth = A(2).includes("DEPTH");
        stored.srgb = A(2).includes("SRGB");
      }
      return true;
    }
    case "glTextureSubImage2D": {
      // The data of level 0 (a whole image) as glTexImage2D would upload it, in the storage's format.
      const level = r.int(A(1));
      if (level === 0 || level === null)
        onTexture(r, A(0), () => texImage(r, ["GL_TEXTURE_2D", "0", r.namedTexture?.storageFormat ?? A(6), A(4), A(5), "0", A(6), A(7), A(8)], line));
      return true;
    }
    case "glGenerateTextureMipmap":
      onTexture(r, A(0), () => call(r, "glGenerateMipmap", ["GL_TEXTURE_2D"], null, line));
      return true;
    case "glBindTextureUnit": {
      // glBindTextureUnit(unit, texture): the texture on that unit, for its kind of sampler.
      const unit = r.int(A(0)) ?? 0;
      if (r.obj(A(1)) === "0") {
        gl.units.delete(unit);
        gl.units2D.delete(unit);
        gl.unitsCube.delete(unit);
        return true;
      }
      const texture = objOf(r, A(1), (n) => gl.textureObjects.has(n));
      gl.units.set(unit, texture);
      const cube = gl.textureObjects.get(texture)?.isCube ?? false;
      (cube ? gl.unitsCube : gl.units2D).set(unit, texture);
      return true;
    }
  }
  return false;
}

/** Runs a bind-to-edit texture call on the texture a direct state access call names. */
function onTexture(r: GlReader, texture: string, run: () => void): void {
  const tex = r.gl.textureObjects.get(objOf(r, texture, (n) => r.gl.textureObjects.has(n)));
  if (tex === undefined) return;
  const saved = r.namedTexture;
  r.namedTexture = tex;
  try {
    run();
  } finally {
    r.namedTexture = saved;
  }
}

function namedVao(r: GlReader, arg: string): VertexArray | null {
  return r.gl.vertexArrays.get(objOf(r, arg, (n) => r.gl.vertexArrays.has(n))) ?? null;
}

function attributeOf(vao: VertexArray, location: number): Attribute {
  let attr = vao.attributes.get(location);
  if (attr === undefined) vao.attributes.set(location, (attr = new Attribute()));
  return attr;
}

function format(vao: VertexArray, location: number, size: number, relativeOffset: number): void {
  const attr = attributeOf(vao, location);
  attr.size = size;
  attr.relativeOffset = relativeOffset;
  // An attribute reads binding point = its location until glVertexArrayAttribBinding says otherwise.
  attr.bindingIndex ??= location;
  resolve(vao);
}

function bindAttribute(vao: VertexArray, location: number, binding: number): void {
  attributeOf(vao, location).bindingIndex = binding;
  resolve(vao);
}

function setBufferBinding(r: GlReader, vao: VertexArray, index: number, buffer: string, offset: number, stride: number): void {
  let binding = vao.bindings.get(index);
  if (binding === undefined) vao.bindings.set(index, (binding = new BufferBinding()));
  binding.buffer = r.obj(buffer) === "0" ? null : bufferName(r, buffer);
  binding.offsetBytes = offset;
  binding.strideBytes = stride;
  resolve(vao);
}

/**
 * Each attribute with a separate format reads like a glVertexAttribPointer attribute: its binding point's buffer,
 * stride and divisor, at the binding's offset plus its own.
 */
function resolve(vao: VertexArray): void {
  for (const attr of vao.attributes.values()) {
    const index = attr.bindingIndex;
    const binding = index !== null ? vao.bindings.get(index) : undefined;
    if (binding === undefined) continue;
    attr.buffer = binding.buffer;
    attr.strideBytes = binding.strideBytes;
    attr.offsetBytes = binding.offsetBytes + attr.relativeOffset;
    attr.divisor = binding.divisor;
  }
}
