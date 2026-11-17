// GlReader.Calls.cs: the OpenGL, GLFW and GLAD calls the simulator follows, and learnopengl.com's Shader class.
import { parseInt32, toInt, trimChars, trimNet } from "../internal/dotnet.js";
import { matchesAll } from "../internal/regex.js";
import { ModelFiles } from "../Models/ModelFiles.js";
import type { ObjModel } from "../Models/ObjModel.js";
import { Rasterizer } from "../Raster/Rasterizer.js";
import { StorageImage } from "../Raster/StorageImage.js";
import { ClearOp } from "../Scene/FrameOp.js";
import { SimNote } from "../Scene/SimNote.js";
import { ShaderRuntimeException, ShaderSyntaxException } from "../Shading/ShaderErrors.js";
import { ShaderParser } from "../Shading/ShaderParser.js";
import type { ShaderProgram } from "../Shading/ShaderProgram.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import { SortedMap } from "../Shading/SortedMap.js";
import { CppSource } from "./CppSource.js";
import { advancedCall, blockUniforms, bufferOf, drawTarget, generateTargetMips, isFloatFormat, memcpy } from "./GlReader.Advanced.js";
import { debugCall, GlInvalidOperation, glError } from "./GlReader.Debug.js";
import { draw, drawModel } from "./GlReader.Draw.js";
import { dsaCall } from "./GlReader.Dsa.js";
import { boundTexture, texImage } from "./GlReader.Textures.js";
import type { GlReader } from "./GlReader.js";
import { Attribute, ProgramObject, ShaderObject, TextureObject, VertexArray, type VertexArray as Vao } from "./GlState.js";
import { StbImage } from "./StbImage.js";

/** @internal */
export function call(r: GlReader, name: string, a: readonly string[], lhs: string | null, line: number): void {
  const A = (i: number): string => (i < a.length ? a[i]! : "");
  const gl = r.gl;
  const scene = r.scene;
  if (debugCall(r, name, a)) return;
  switch (name) {
    case "glfwInit":
      r.glfwInit = true;
      return;
    case "glfwCreateWindow":
      r.windowCreated = r.glfwInit;
      scene.width = r.int(A(0)) ?? 800;
      scene.height = r.int(A(1)) ?? 600;
      scene.windowTitle = CppSource.stringArg(A(2)) ?? r.eval(A(2))?.text ?? "";
      return;
    case "glfwSetWindowTitle": {
      // The title a program sets while it runs (the frame's counts: "drawn: 37 / 101"): the window shows it.
      if (!r.inLoop) return;
      const title = CppSource.stringArg(A(1)) ?? r.eval(A(1))?.text ?? null;
      if (title !== null) scene.windowTitle = title;
      return;
    }
    case "gladLoadGLLoader":
    case "gladLoadGL":
      r.gladLoaded = true;
      return;
    case "glfwSwapBuffers":
      if (r.inLoop) scene.presents = true;
      return;
  }
  if (name === "memcpy") {
    memcpy(r, a);
    return;
  }
  if (name === "glfwWindowHint" && A(0).includes("GLFW_SAMPLES")) {
    scene.samples = r.int(A(1)) ?? 1;
    return;
  }
  if (!name.startsWith("gl") || name.startsWith("glfw")) return;
  if (!r.gladLoaded) {
    // Every OpenGL function is a null pointer until GLAD has loaded it: the program would crash here.
    if (!scene.notes.some((n) => n.key === "gladMissing")) scene.notes.push(SimNote.error("gladMissing", ["call", name], ["line", String(line)]));
    return;
  }
  if (advancedCall(r, name, a, lhs, line) || dsaCall(r, name, a, line)) return;
  switch (name) {
    case "glClearColor": {
      const v = a.map((x) => r.eval(x)?.x ?? 0);
      if (v.length === 4) {
        gl.clearColor = v;
        gl.clearColorSet = true;
      }
      return;
    }
    case "glClear":
      clearBound(r, A(0).includes("GL_COLOR_BUFFER_BIT") ? gl.clearColor.slice() : null,
        A(0).includes("GL_DEPTH_BUFFER_BIT") ? 1.0 : null,
        A(0).includes("GL_STENCIL_BUFFER_BIT") ? 0 : null);
      return;
    case "glClearBufferfv":
    case "glClearBufferiv":
    case "glClearBufferuiv":
    case "glClearBufferfi": {
      // One buffer of the bound framebuffer with a value of its own: colour attachment i (GL_COLOR, i, rgba),
      // the depth (GL_DEPTH, 0, &depth), the stencil, or both (glClearBufferfi(GL_DEPTH_STENCIL, 0, d, s)).
      const values = name === "glClearBufferfi" ? null : r.numbers(r.dataName(A(2)));
      if (A(0).includes("GL_COLOR") && values !== null && values.length > 0)
        clearBound(r, [...values.slice(0, 4), ...new Array<number>(Math.max(0, 4 - values.length)).fill(0)], null, null, r.int(A(1)) ?? 0);
      else if (A(0).includes("GL_DEPTH_STENCIL")) clearBound(r, null, r.eval(A(2))?.x ?? 1, r.int(A(3)) ?? 0);
      else if (A(0).includes("GL_DEPTH") && values !== null && values.length > 0) clearBound(r, null, values[0]!, null);
      else if (A(0).includes("GL_STENCIL") && values !== null && values.length > 0) clearBound(r, null, null, toInt(values[0]!));
      return;
    }
    case "glCreateShader":
      if (lhs !== null) {
        const s = new ShaderObject();
        s.stage = A(0).includes("FRAGMENT") ? "fragment" : A(0).includes("VERTEX") ? "vertex" : A(0).includes("GEOMETRY") ? "geometry"
          : A(0).includes("TESS_CONTROL") ? "tess_control" : A(0).includes("TESS_EVALUATION") ? "tess_evaluation" : A(0).includes("COMPUTE") ? "compute" : "other";
        gl.shaderObjects.set(lhs, s);
        ownName(r, "shader", lhs, (own) => gl.shaderObjects.set(own, gl.shaderObjects.get(lhs)!));
      }
      return;
    case "glShaderSource": {
      const so = gl.shaderObjects.get(objOf(r, A(0), (n) => gl.shaderObjects.has(n)));
      if (so !== undefined) so.source = r.eval(r.obj(A(2)))?.text ?? null;
      return;
    }
    case "glCompileShader": {
      const cs = gl.shaderObjects.get(objOf(r, A(0), (n) => gl.shaderObjects.has(n)));
      if (cs !== undefined) cs.compiled = true;
      return;
    }
    case "glCreateProgram":
      if (lhs !== null) {
        gl.programs.set(lhs, new ProgramObject());
        ownName(r, "program", lhs, (own) => gl.programs.set(own, gl.programs.get(lhs)!));
      }
      return;
    case "glAttachShader": {
      const ap = gl.programs.get(objOf(r, A(0), (n) => gl.programs.has(n)));
      if (ap !== undefined) ap.shaders.push(objOf(r, A(1), (n) => gl.shaderObjects.has(n)));
      return;
    }
    case "glLinkProgram": {
      const lp = gl.programs.get(objOf(r, A(0), (n) => gl.programs.has(n)));
      if (lp !== undefined) link(r, lp, line);
      return;
    }
    case "glUseProgram":
      gl.currentProgram = r.obj(A(0)) === "0" ? null : objOf(r, A(0), (n) => gl.programs.has(n));
      return;
    case "glGenVertexArrays":
    case "glGenBuffers": {
      const generated = names(r, A(0), A(1));
      for (const n of generated) {
        if (name === "glGenVertexArrays") gl.vertexArrays.set(n, new VertexArray());
        else {
          // The same variable name again (a local `unsigned int VBO;` in two functions): the buffer made before
          // keeps its data under a name of its own, and what refers to it (a VAO's attributes) follows.
          if (gl.buffers.has(n)) retireBuffer(r, n);
          gl.buffers.set(n, null);
        }
      }
      // A buffer's data is kept by name: its own name is an alias that later writes keep in step (see Alias).
      if (generated.length <= 2 && name === "glGenVertexArrays") ownName(r, "vao", A(1), (own) => gl.vertexArrays.set(own, gl.vertexArrays.get(generated.at(-1)!)!));
      else if (generated.length <= 2) ownName(r, "buffer", A(1), (own) => r.bufferAliases.set(own, generated.at(-1)!));
      return;
    }
    case "glBindVertexArray":
      gl.currentVertexArray = r.obj(A(0)) === "0" ? null : objOf(r, A(0), (n) => gl.vertexArrays.has(n));
      return;
    case "glBindBuffer": {
      const b = r.obj(A(1)) === "0" ? null : bufferName(r, A(1));
      if (A(0).includes("GL_ELEMENT_ARRAY_BUFFER")) {
        const vao = vaoOf(r);
        if (vao !== null) vao.elementBuffer = b;
      } else if (A(0).includes("GL_UNIFORM_BUFFER")) gl.uniformBuffer = b;
      else if (A(0).includes("GL_COPY_READ_BUFFER")) gl.copyReadBuffer = b;
      else if (A(0).includes("GL_COPY_WRITE_BUFFER")) gl.copyWriteBuffer = b;
      else if (A(0).includes("GL_ARRAY_BUFFER")) gl.arrayBuffer = b;
      return;
    }
    case "glBufferData": {
      const target = bufferOf(r, A(0));
      if (target === null) {
        scene.notes.push(SimNote.warning("noBufferBound", ["line", String(line)]));
        return;
      }
      if (A(0).includes("GL_UNIFORM_BUFFER")) return;
      // glBufferData(…, size, NULL, …) only makes room: glBufferSubData / glMapBuffer fill it later.
      const data = trimNet(A(2));
      gl.buffers.set(target, data === "NULL" || data === "nullptr" || data === "0"
        ? new Array<number>(Math.max(0, Math.trunc((r.int(A(1)) ?? 0) / 4))).fill(0)
        : r.numbers(r.dataName(A(2))));
      return;
    }
    case "glVertexAttribPointer": {
      const vao = vaoOf(r);
      if (vao === null) {
        scene.notes.push(SimNote.error("noVaoBound", ["call", name], ["line", String(line)]));
        return;
      }
      const loc = r.int(A(0)) ?? 0;
      let attr = vao.attributes.get(loc);
      if (attr === undefined) vao.attributes.set(loc, (attr = new Attribute()));
      attr.buffer = gl.arrayBuffer;
      attr.size = r.int(A(1)) ?? 4;
      attr.strideBytes = r.int(A(4)) ?? 0;
      attr.offsetBytes = r.int(A(5)) ?? 0;
      return;
    }
    case "glEnableVertexAttribArray":
    case "glDisableVertexAttribArray": {
      const vao = vaoOf(r);
      if (vao === null) return;
      const loc = r.int(A(0)) ?? 0;
      let attr = vao.attributes.get(loc);
      if (attr === undefined) vao.attributes.set(loc, (attr = new Attribute()));
      attr.enabled = name === "glEnableVertexAttribArray";
      return;
    }
    case "glGetUniformLocation": {
      const uname = lhs !== null ? CppSource.stringArg(A(1)) : null;
      if (lhs !== null && uname !== null) gl.locations.set(lhs, uname);
      return;
    }
    case "glPolygonMode":
      gl.wireframe = A(1).includes("GL_LINE");
      return;
    case "glEnable":
    case "glDisable": {
      const on = name === "glEnable";
      if (A(0).includes("GL_CULL_FACE")) gl.cullFace = on;
      if (A(0).includes("GL_DEPTH_TEST")) gl.depthTest = on;
      if (A(0).includes("GL_STENCIL_TEST")) gl.stencilTest = on;
      if (A(0).includes("GL_BLEND")) {
        gl.blend = on;
        // For every draw buffer: one switched off with glDisablei follows again.
        for (const off of [...gl.bufferBlends].filter(([, v]) => v === null).map(([k]) => k)) gl.bufferBlends.delete(off);
      }
      if (A(0).includes("GL_PROGRAM_POINT_SIZE")) gl.programPointSize = on;
      if (A(0).includes("GL_FRAMEBUFFER_SRGB")) scene.windowSrgb = on;
      return;
    }
    case "glCullFace":
      gl.cullFaceMode = trimNet(A(0));
      return;
    case "glFrontFace":
      gl.frontCcw = !A(0).includes("GL_CW") || A(0).includes("GL_CCW");
      return;
    case "glGenTextures": {
      const generated = names(r, A(0), A(1));
      for (const n of generated) gl.textureObjects.set(n, new TextureObject());
      if (generated.length <= 2) ownName(r, "texture", A(1), (own) => gl.textureObjects.set(own, gl.textureObjects.get(generated.at(-1)!)!));
      return;
    }
    case "glPixelStorei":
      if (A(0).includes("UNPACK_ALIGNMENT")) gl.unpackAlignment = Math.max(1, r.int(A(1)) ?? 4);
      return;
    case "glActiveTexture": {
      const m = /GL_TEXTURE(\d+)(?:\s*\+\s*(\d+))?/.exec(A(0));
      gl.activeUnit = m !== null ? parseInt32(m[1]!) + (m[2] !== undefined ? parseInt32(m[2]) : 0) : 0;
      return;
    }
    case "glBindTexture":
      if (r.obj(A(1)) === "0") gl.units.delete(gl.activeUnit);
      else {
        gl.units.set(gl.activeUnit, objOf(r, A(1), (n) => gl.textureObjects.has(n)));
        (A(0).includes("GL_TEXTURE_CUBE_MAP") ? gl.unitsCube : gl.units2D).set(gl.activeUnit, gl.units.get(gl.activeUnit)!);
        const cube = A(0).includes("GL_TEXTURE_CUBE_MAP") ? boundTexture(r) : null;
        if (cube !== null) cube.isCube = true;
      }
      return;
    case "glTexParameteri":
    case "glTexParameterf":
    case "glTexParameterfv":
    case "glTexParameteriv": {
      const tex = boundTexture(r);
      if (tex === null) return;
      const param = A(1);
      const value = choose(A(2), tex);
      if (param.includes("WRAP_S")) tex.wrapS = StbImage.wrapOf(value);
      else if (param.includes("WRAP_T")) tex.wrapT = StbImage.wrapOf(value);
      else if (param.includes("MIN_FILTER")) tex.minFilter = trimNet(A(2));
      else if (param.includes("MAG_FILTER")) tex.magFilter = trimNet(A(2));
      else if (param.includes("BORDER_COLOR")) tex.border = r.numbers(r.dataName(A(2)))?.slice(0, 4) ?? null;
      return;
    }
    case "glTexImage2D":
      texImage(r, a, line);
      return;
    case "glTexImage3D": {
      const array = boundTexture(r);
      const data = array !== null && a.length >= 10 ? r.dataName(a[9]!) : null;
      if (array === null || !(data === "NULL" || data === "nullptr" || data === "0")) break;
      // A texture array with no data (glTexImage3D(GL_TEXTURE_2D_ARRAY, 0, GL_DEPTH_COMPONENT32F, w, h, layers, …)):
      // drawn into layer by layer (cascaded shadow maps).
      array.width = r.int(a[3]!) ?? 0;
      array.height = r.int(a[4]!) ?? 0;
      array.layers = Math.max(1, r.int(a[5]!) ?? 1);
      array.float = isFloatFormat(a[2]!);
      array.isDepth = a[2]!.includes("DEPTH");
      array.components = 4;
      return;
    }
    case "glGenerateMipmap": {
      const noBase = boundTexture(r);
      if (noBase === null || (noBase.image === null && !noBase.isCube && noBase.framebuffer === null && noBase.width === 0)) {
        glError(r, GlInvalidOperation, "GL_INVALID_OPERATION in glGenerateMipmap(zero size base image)");
        return;
      }
      const mt = boundTexture(r);
      if (mt !== null) {
        mt.mipmaps = mt.image !== null || mt.isCube || mt.framebuffer !== null;
        generateTargetMips(r, mt);
      }
      return;
    }
    case "glBindImageTexture": {
      // glBindImageTexture(unit, texture, level, layered, layer, access, format): an image unit for compute shaders.
      const imageUnit = r.int(A(0));
      if (imageUnit !== null) gl.imageUnits.set(imageUnit, r.obj(A(1)));
      return;
    }
    case "glDispatchCompute":
      dispatchCompute(r, r.int(A(0)) ?? 0, r.int(A(1)) ?? 0, r.int(A(2)) ?? 1, line);
      return;
    case "glMemoryBarrier":
      // The dispatch has finished when the reader goes on.
      return;
    case "glPatchParameteri":
      if (A(0).includes("PATCH_VERTICES")) gl.patchVertices = Math.max(1, r.int(A(1)) ?? 3);
      return;
    case "glDrawArrays":
      draw(r, A(0), null, r.int(A(1)) ?? 0, r.int(A(2)) ?? 0, name, line);
      return;
    case "glDrawElements":
      draw(r, A(0), A(2), r.int(A(3)) ?? 0, r.int(A(1)) ?? 0, name, line);
      return;
  }
  if (name.startsWith("glUniform")) uniform(r, name, a, line);
}

/**
 * @internal Clears the bound framebuffer: a colour (all attachments, or only `attachment`), the depth, the stencil.
 */
export function clearBound(r: GlReader, color: number[] | null, depth: number | null, stencil: number | null, attachment: number | null = null): void {
  const gl = r.gl;
  const scene = r.scene;
  // Before the render loop only a framebuffer object's clears count (a capture pass drawn once).
  if (!r.inLoop && (gl.drawFramebuffer === null || !gl.framebuffers.has(gl.drawFramebuffer))) return;
  const fbo = gl.drawFramebuffer;
  if (fbo !== null) {
    // A framebuffer object: cleared between the draws of the frame.
    const cleared = gl.framebuffers.has(fbo) ? drawTarget(r) ?? fbo : fbo;
    scene.ops.push(new ClearOp(scene.draws.length, cleared, color, depth, stencil, attachment));
    return;
  }
  if (scene.draws.length > 0 && scene.draws.some((d) => d.target !== null)) {
    // The window, after drawing into framebuffer objects (post-processing).
    scene.ops.push(new ClearOp(scene.draws.length, null, color, depth, stencil));
    return;
  }
  if (color !== null) {
    scene.clearColor = color;
    scene.draws.length = 0;
    scene.ops.length = 0;
  }
}

/**
 * A parameter written as a choice by the texture's format: learnopengl's
 * <c>format == GL_RGBA ? GL_CLAMP_TO_EDGE : GL_REPEAT</c> (the format follows the loaded image's channels).
 */
function choose(value: string, tex: TextureObject): string {
  const m = /^\s*\(?\s*\w+\s*(==|!=)\s*(GL_RGBA|GL_RGB|GL_RED)\s*\)?\s*\?\s*(\w+)\s*:\s*(\w+)\s*$/.exec(value);
  if (m === null) return value;
  const channels = tex.image?.channels ?? tex.components;
  const wanted = m[2] === "GL_RGBA" ? 4 : m[2] === "GL_RGB" ? 3 : 1;
  const yes = (channels === wanted) === (m[1] === "==");
  return yes ? m[3]! : m[4]!;
}

/**
 * @internal The OpenGL object an argument names: the variable itself, or the object a variable or expression holds
 * (unsigned int VAO = rock.meshes[i].VAO; glBindVertexArray(VAO)).
 */
export function objOf(r: GlReader, arg: string, known: (name: string) => boolean): string {
  // cond ? a : b (learnopengl's first_iteration ? colorBuffers[1] : pingpongColorbuffers[!horizontal]): the branch the
  // condition picks now.
  const choice = /^([^?]+)\?([^:]+):(.+)$/.exec(trimNet(arg));
  if (choice !== null) {
    const cond = r.eval(trimNet(choice[1]!));
    if (cond !== null && cond.v !== null && cond.v.length > 0) return objOf(r, cond.v[0] !== 0 ? choice[2]! : choice[3]!, known);
  }
  // The object the variable holds (its own name, "program#3"), before the expression's text: the text
  // (shader.ID) names whichever object was made last through it, a copy of the struct holds its own.
  const held = r.eval(trimNet(arg))?.text ?? null;
  if (held !== null && held.includes("#") && known(held)) return held;
  const name = r.obj(arg);
  if (known(name)) return name;
  return held !== null && known(held) ? held : name;
}

/** @internal Does the project's Model read the bones (model.h calls ExtractBoneWeightForVertices)? */
export function extractsBones(r: GlReader): boolean {
  return [...r.project.files].some(([k, v]) => (k.endsWith(".h") || k.endsWith(".hpp"))
    && /\bExtractBoneWeightForVertices\s*\([^)]*\)\s*;/.test(CppSource.blankComments(v)));
}

/**
 * @internal The locations of the bone attributes of the project's mesh.h (glVertexAttribIPointer(3, 4, GL_INT, …,
 * offsetof(Vertex, m_BoneIDs)), glVertexAttribPointer(4, …, offsetof(Vertex, m_Weights))), or null.
 */
export function boneAttributes(r: GlReader): { ids: number | null; weights: number | null } {
  let ids: number | null = null, weights: number | null = null;
  for (const [k, text] of r.project.files) {
    if (!(k.endsWith(".h") || k.endsWith(".hpp"))) continue;
    for (const m of matchesAll(/glVertexAttribI?Pointer\s*\(\s*(\d+)[^;]*offsetof\s*\(\s*\w+\s*,\s*(\w+)\s*\)/g, CppSource.blankComments(text))) {
      // OrdinalIgnoreCase on ASCII names.
      if (m[2]!.toUpperCase().includes("BONEID")) ids = parseInt32(m[1]!);
      else if (m[2]!.toUpperCase().includes("WEIGHT")) weights = parseInt32(m[1]!);
    }
  }
  return { ids, weights };
}

/**
 * @internal learnopengl's Model as the program sees it: model.meshes[i].VAO, .indices.size() and
 * model.textures_loaded[i].id name objects with the mesh's vertex data (location 0 position, 1 normal, 2 texture
 * coordinates) and textures – what the asteroid field binds to add its per-instance matrices.
 */
export function modelObjects(r: GlReader, name: string, model: ObjModel, path: string): void {
  const gl = r.gl;
  const flipUv = ModelFiles.flipUVs(r.src, r.project);
  const flipImages = /stbi_set_flip_vertically_on_load\s*\(\s*(?:true|1)\s*\)/.test(r.src.code);
  const meshes: ShaderValue[] = [];
  const textures: ShaderValue[] = [];
  const loaded = new Map<string, string>();
  for (let i = 0; i < model.meshes.length; i++) {
    const mesh = model.meshes[i]!;
    const vao = `${name}.meshes[${i}].VAO`;
    const vbo = `${name}.meshes[${i}].VBO`;
    const ebo = `${name}.meshes[${i}].EBO`;
    const data: number[] = [];
    for (let v = 0; v < mesh.positions.length; v++) {
      data.push(...mesh.positions[v]!);
      data.push(...mesh.normals[v]!);
      data.push(mesh.texCoords[v]![0]!);
      data.push(flipUv ? 1 - mesh.texCoords[v]![1]! : mesh.texCoords[v]![1]!);
    }
    gl.buffers.set(vbo, data);
    gl.buffers.set(ebo, mesh.indices.slice());
    const array = new VertexArray({ elementBuffer: ebo });
    array.attributes.set(0, new Attribute({ buffer: vbo, size: 3, strideBytes: 32, offsetBytes: 0, enabled: true }));
    array.attributes.set(1, new Attribute({ buffer: vbo, size: 3, strideBytes: 32, offsetBytes: 12, enabled: true }));
    array.attributes.set(2, new Attribute({ buffer: vbo, size: 2, strideBytes: 32, offsetBytes: 24, enabled: true }));
    gl.vertexArrays.set(vao, array);
    meshes.push(ShaderValue.struct(new Map([
      ["VAO", ShaderValue.str(vao)],
      ["indices", ShaderValue.array(mesh.indices.map((x) => ShaderValue.integer(x)))],
      // mesh.h's Vertex: what a program reads of the model's vertices (a bounding volume around them).
      ["vertices", ShaderValue.array(mesh.positions.map((_, v) => ShaderValue.struct(new Map([
        ["Position", ShaderValue.vecOf(mesh.positions[v]!.slice())],
        ["Normal", ShaderValue.vecOf(mesh.normals[v]!.slice())],
        ["TexCoords", ShaderValue.vec(mesh.texCoords[v]![0]!, flipUv ? 1 - mesh.texCoords[v]![1]! : mesh.texCoords[v]![1]!)],
      ]))))],
    ])));
    for (const file of [mesh.material?.diffuseMap ?? null, mesh.material?.specularMap ?? null, mesh.material?.normalMap ?? null]) {
      if (file === null || loaded.has(file)) continue;
      const texName = `${name}.textures_loaded[${textures.length}].id`;
      const tex = ModelFiles.texture(r.project, path, file, flipImages);
      gl.textureObjects.set(texName, new TextureObject({ image: tex?.image ?? null, components: tex?.components ?? 4, minFilter: "GL_LINEAR_MIPMAP_LINEAR", mipmaps: true }));
      loaded.set(file, texName);
      textures.push(ShaderValue.struct(new Map([["id", ShaderValue.str(texName)]])));
    }
  }
  const gltf = model.gltf;
  r.env.runner.globals.set(name, new ShaderValue({
    fields: new Map<string, ShaderValue>([
      ["meshes", ShaderValue.array(meshes)],
      ["textures_loaded", ShaderValue.array(textures)],
      [ModelMark, ShaderValue.str(name)],
      // learnopengl's model_animation.h: the bones by name and how many (ExtractBoneWeightForVertices).
      ["m_BoneInfoMap", gltf !== null && extractsBones(r) ? gltf.boneInfoMap(false) : new ShaderValue({ map: new SortedMap<ShaderValue>() })],
      ["m_BoneCounter", ShaderValue.integer(gltf !== null && extractsBones(r) ? gltf.bones.length : 0)],
    ]),
    shared: true,
  }));
}

/**
 * @internal A member of a Model's value that names the model: a pointer to it kept in a struct (Model* pModel =
 * &amp;ourModel) is a copy once the struct is copied (into a std::vector), and still says which model it draws.
 */
export const ModelMark = "__model";

/**
 * @internal A buffer an argument names: the variable it was generated into, also through a copy of its value
 * (renderer.quadVBO after the renderer struct was copied).
 */
export function retireBuffer(r: GlReader, name: string): void {
  const gl = r.gl;
  const retired = `${name}@${++r.retiredBuffers}`;
  gl.buffers.set(retired, gl.buffers.get(name) ?? null);
  const moved = (b: string | null): string | null => (b === name ? retired : b);
  for (const vao of new Set(gl.vertexArrays.values())) {
    vao.elementBuffer = moved(vao.elementBuffer);
    for (const attribute of vao.attributes.values()) attribute.buffer = moved(attribute.buffer);
  }
  gl.uniformBuffer = moved(gl.uniformBuffer);
  gl.copyReadBuffer = moved(gl.copyReadBuffer);
  gl.copyWriteBuffer = moved(gl.copyWriteBuffer);
  gl.arrayBuffer = moved(gl.arrayBuffer);
  for (const own of [...r.bufferAliases].filter(([, v]) => v === name).map(([k]) => k)) r.bufferAliases.set(own, retired);
}

/** @internal */
export function bufferName(r: GlReader, arg: string): string {
  const name = r.obj(arg);
  if (r.gl.buffers.has(name)) return name;
  const held = r.eval(trimNet(arg))?.text ?? null;
  const original = held !== null ? r.bufferAliases.get(held) : undefined;
  return original !== undefined ? original : name;
}

/**
 * @internal An object created into a variable (glGenTextures(1, &amp;texture), shader.ID = glCreateProgram()) also
 * gets a name of its own, which the variable now holds: an object made in a loop (a glyph's texture per character)
 * stays itself when the variable gets the next one, and a copy of the value (a struct field, a map entry, a function's
 * return value) still names it.
 */
export function ownName(r: GlReader, kind: string, variable: string, register: (own: string) => void): void {
  const target = trimNet(trimChars(trimNet(variable), "&", true, false));
  if (!/^[A-Za-z_][\w.\[\]>-]*$/.test(target)) return;
  const own = `${kind}#${++r.objectCount}`;
  register(own);
  try {
    r.env.runner.assign(ShaderParser.parseExpression(CppSource.prepare(target)), ShaderValue.str(own));
  } catch (e) {
    if (!(e instanceof ShaderSyntaxException) && !(e instanceof ShaderRuntimeException)) throw e;
  }
}

/** @internal The bound vertex array object (C#'s Vao property). */
export function vaoOf(r: GlReader): Vao | null {
  const v = r.gl.currentVertexArray;
  return v !== null ? r.gl.vertexArrays.get(v) ?? null : null;
}

/** @internal glGenBuffers(1, &amp;VBO) → VBO; glGenBuffers(2, VBOs) → VBOs[0], VBOs[1]. */
export function names(r: GlReader, count: string, target: string): string[] {
  const n = r.int(count) ?? 1;
  const t = r.obj(target);
  if (n === 1 && !trimNet(target).startsWith("&") && !t.includes("[")) return [t + "[0]", t];
  if (n < 0) throw new RangeError("count"); // Enumerable.Range throws on a negative count
  return n === 1 ? [t] : Array.from({ length: n }, (_, i) => `${t}[${i}]`);
}

function uniform(r: GlReader, name: string, a: readonly string[], line: number): void {
  const gl = r.gl;
  const program = gl.currentProgram !== null ? gl.programs.get(gl.currentProgram) : undefined;
  if (program === undefined) {
    r.scene.notes.push(SimNote.warning("uniformWithoutProgram", ["call", name], ["line", String(line)]));
    glError(r, GlInvalidOperation, name.startsWith("glUniformMatrix") ? "GL_INVALID_OPERATION in glUniformMatrix(program not linked)" : "GL_INVALID_OPERATION in glUniform(program not linked)");
    return;
  }
  const locArg = a.length > 0 ? a[0]! : "";
  let uniformName: string | null = gl.locations.get(r.obj(locArg)) ?? null;
  if (uniformName === null && locArg.includes("glGetUniformLocation")) {
    const m = /"([^"]+)"/.exec(locArg);
    if (m !== null) uniformName = m[1]!;
    else {
      // The name in a variable (SetMatrix4(shader, const char* name, …): glGetUniformLocation(shader.ID, name)).
      const callMatch = /glGetUniformLocation\s*\((.*)\)\s*$/.exec(locArg);
      const locationArgs = callMatch !== null ? CppSource.splitArgs(callMatch[1]!) : null;
      const named = locationArgs !== null && locationArgs.length === 2 ? r.eval(trimNet(locationArgs[1]!))?.text ?? null : null;
      if (named !== null && named.length > 0) uniformName = named;
    }
  }
  if (uniformName === null) return;
  const values = a.slice(1);
  if (name.includes("Matrix")) {
    let expr = values.length >= 3 ? values[2]! : "";
    expr = expr.replace(/^(?:glm::)?value_ptr\s*\((.*)\)$/, "$1");
    const matrix = r.eval(expr);
    program.uniforms.set(uniformName, () => matrix);
    return;
  }
  if (name.endsWith("v") && values.length >= 2) {
    // glUniform3fv(loc, 4, &lightPositions[0][0]): with a count above 1, the whole array.
    let data = r.dataName(values[1]!);
    if ((r.eval(values[0]!)?.x ?? 1) > 1) data = data.replace(/(?:\s*\[\s*0\s*\])+$/, "");
    const vector = r.eval(data);
    program.uniforms.set(uniformName, () => vector);
    return;
  }
  // Evaluated now: a uniform set inside a loop has the loop's value for the draw that follows.
  const nums = ShaderValue.vecOf(values.map((v) => r.eval(v)?.x ?? 0));
  program.uniforms.set(uniformName, () => nums);
}

function link(r: GlReader, program: ProgramObject, line: number): void {
  for (const s of program.shaders) {
    const so = r.gl.shaderObjects.get(s);
    if (so === undefined || so.source === null) continue;
    if (!so.compiled) {
      r.scene.notes.push(SimNote.error("notCompiled", ["stage", so.stage]));
      continue;
    }
    const parsed = parseShader(r, so.source, so.stage, null);
    if (so.stage === "vertex") program.vertex = parsed;
    else if (so.stage === "fragment") program.fragment = parsed;
    else if (so.stage === "geometry") program.geometry = parsed;
    else if (so.stage === "tess_control") program.tessControl = parsed;
    else if (so.stage === "tess_evaluation") program.tessEval = parsed;
    else if (so.stage === "compute") program.compute = parsed;
  }
  program.linked = (program.vertex !== null && program.fragment !== null) || program.compute !== null;
  if (!program.linked && program.shaders.length > 0 && !r.scene.notes.some((n) => n.key === "shaderSyntax"))
    r.scene.notes.push(SimNote.error("notLinked", ["line", String(line)]));
}

/** Parses a shader; a syntax error becomes the log line the learnopengl.com check would print, and a note. */
function parseShader(r: GlReader, source: string, stage: string, file: string | null): ShaderProgram | null {
  try {
    return ShaderParser.parseProgram(source);
  } catch (e) {
    if (!(e instanceof ShaderSyntaxException)) throw e;
    r.scene.log.push(`ERROR::SHADER::${stage.toUpperCase()}::COMPILATION_FAILED`);
    r.scene.log.push(`0:${e.line}: error: ${e.message}`);
    r.scene.notes.push(SimNote.error("shaderSyntax", ["stage", stage], ["file", file ?? stage], ["line", String(e.line)], ["message", e.message]));
    return null;
  }
}

// ---------- learnopengl.com's Shader class (shader_s.h / shader.h) ----------

/** @internal */
export function shaderClass(r: GlReader, name: string, vsFile: string, fsFile: string, gsFile: string | null, line: number, tcsFile: string | null = null, tesFile: string | null = null): void {
  const program = new ProgramObject();
  r.gl.programs.set(name, program);
  if (!r.gladLoaded) {
    r.scene.notes.push(SimNote.error("gladMissing", ["call", "Shader"], ["line", String(line)]));
    return;
  }
  const files: [string, string][] = [[vsFile, "vertex"], [fsFile, "fragment"]];
  if (gsFile !== null) files.push([gsFile, "geometry"]);
  if (tcsFile !== null) files.push([tcsFile, "tess_control"]);
  if (tesFile !== null) files.push([tesFile, "tess_evaluation"]);
  for (const [file, stage] of files) {
    const text = r.project.find(file);
    if (text === null) {
      r.scene.log.push("ERROR::SHADER::FILE_NOT_SUCCESSFULLY_READ: " + file);
      r.scene.notes.push(SimNote.error("shaderFileMissing", ["file", file]));
      continue;
    }
    const parsed = parseShader(r, text, stage, r.project.pathOf(file));
    if (stage === "vertex") {
      program.vertex = parsed;
      program.vertexFile = r.project.pathOf(file);
    } else if (stage === "geometry") {
      program.geometry = parsed;
      program.geometryFile = r.project.pathOf(file);
    } else if (stage === "tess_control") program.tessControl = parsed;
    else if (stage === "tess_evaluation") program.tessEval = parsed;
    else {
      program.fragment = parsed;
      program.fragmentFile = r.project.pathOf(file);
    }
  }
  program.linked = program.vertex !== null && program.fragment !== null;
}

/** @internal learnopengl's ComputeShader(path): a program with the compute shader read from the file. */
export function computeShaderClass(r: GlReader, name: string, file: string, line: number): void {
  const program = new ProgramObject();
  r.gl.programs.set(name, program);
  if (!r.gladLoaded) {
    r.scene.notes.push(SimNote.error("gladMissing", ["call", "ComputeShader"], ["line", String(line)]));
    return;
  }
  const text = r.project.find(file);
  if (text === null) {
    r.scene.log.push("ERROR::SHADER::FILE_NOT_SUCCESSFULLY_READ: " + file);
    r.scene.notes.push(SimNote.error("shaderFileMissing", ["file", file]));
    return;
  }
  program.compute = parseShader(r, text, "compute", r.project.pathOf(file));
  program.linked = program.compute !== null;
}

/**
 * glDispatchCompute(x, y, z): the current program's compute shader runs over x × y × z work groups now; the textures
 * on the image units its image2D uniforms name are written (and read) – what is drawn after sees them.
 */
function dispatchCompute(r: GlReader, x: number, y: number, z: number, line: number): void {
  if (r.discardDraws) return;
  const gl = r.gl;
  const program = gl.currentProgram !== null ? gl.programs.get(gl.currentProgram) : undefined;
  const cs = program?.compute ?? null;
  if (program === undefined || cs === null) {
    r.scene.notes.push(SimNote.error("noProgram", ["call", "glDispatchCompute"], ["line", String(line)]));
    return;
  }
  const time = r.env.runner.time;
  const images = new Map<string, StorageImage>();
  const targets: { texture: TextureObject; image: StorageImage }[] = [];
  for (const g of cs.globals.filter((g) => g.storage === "uniform" && g.type.startsWith("image"))) {
    const set = program.uniforms.get(g.id);
    const v = set !== undefined ? set(time) : null;
    const unit = v !== null ? toInt(v.x) : g.binding ?? 0;
    // No texture on the image unit: the shader's writes go nowhere.
    const texName = gl.imageUnits.get(unit);
    const tex = texName !== undefined ? gl.textureObjects.get(texName) : undefined;
    if (tex === undefined) continue;
    const w = tex.image?.width ?? tex.width, h = tex.image?.height ?? tex.height;
    const storage = StorageImage.from(tex.image, w, h);
    images.set(g.id, storage);
    targets.push({ texture: tex, image: storage });
  }
  const uniforms = new Map<string, ShaderValue>();
  for (const [name, f] of program.uniforms) {
    const value = f(time);
    if (value !== null) uniforms.set(name, value);
  }
  for (const [k, v] of blockUniforms(r, program)) uniforms.set(k, v);
  const errors = Rasterizer.dispatch(cs, "main", false, uniforms, images, [x, y, z], time);
  for (const e of errors) r.scene.log.push("compute shader: " + e);
  for (const { texture: tex, image: storage } of targets) {
    tex.image = storage.toImage();
    tex.float = true;
    tex.components = 4;
    tex.width = storage.width;
    tex.height = storage.height;
  }
  if (r.env.runner.usedTime || r.src.usedTime) r.scene.animated = true;
}

/** @internal */
export function shaderMethod(r: GlReader, obj: string, method: string, a: readonly string[], line: number): void {
  const gl = r.gl;
  obj = r.resolveAlias(obj.replace(/\s+/g, ""));
  if (!gl.programs.has(obj) && !r.models.has(obj) && /\.|->|\[/.test(obj)) {
    // Through a member or a pointer (entity.pModel->Draw(shader), renderer.shader.use()): the model the value
    // is (a copy of a Model carries its name), else the object its last name is.
    const modelName = r.eval(obj)?.fields?.get(ModelMark)?.text ?? null;
    obj = modelName !== null ? modelName : r.resolveAlias(/(\w+)$/.exec(obj)?.[1] ?? "");
  }
  const model = method === "Draw" ? r.models.get(obj) : undefined;
  if (model !== undefined) {
    drawModel(r, model.model, model.path, a.length > 0 ? r.obj(a[0]!) : "", line);
    return;
  }
  const program = gl.programs.get(obj);
  if (program === undefined) return;
  if (method === "use") {
    gl.currentProgram = obj;
    return;
  }
  const uniformName = a.length < 2 ? null : CppSource.stringArg(a[0]!) ?? r.eval(a[0]!)?.text ?? null;
  if (uniformName === null) return;
  if (gl.currentProgram !== obj) {
    // glUniform* works on the program in use; the Shader class's setters call glUniform* directly.
    r.scene.notes.push(SimNote.warning("uniformWithoutProgram", ["call", `${obj}.${method}`], ["line", String(line)]));
    glError(r, GlInvalidOperation, method.startsWith("setMat") ? "GL_INVALID_OPERATION in glUniformMatrix(program not linked)" : "GL_INVALID_OPERATION in glUniform(program not linked)");
    return;
  }
  const values = a.slice(1);
  const value = values.length === 1 ? r.eval(values[0]!) : ShaderValue.vecOf(values.map((v) => r.eval(v)?.x ?? 0));
  program.uniforms.set(uniformName, () => value);
}
