// GlReader.Debug.cs: learnopengl's "Debugging": glGetError's error flag, the debug output of a debug context
// (glDebugMessageCallback) with Mesa's wording of each message, the queries a program asks in its own code
// (glGetShaderiv, glGetIntegerv …), and function-like macros (#define glCheckError() glCheckError_(__FILE__, __LINE__)).
import { toInt, trimNet } from "../internal/dotnet.js";
import * as A from "../Shading/ShaderAst.js";
import { ShaderRuntimeException } from "../Shading/ShaderErrors.js";
import { ShaderValue } from "../Shading/ShaderValue.js";
import type { GlReader } from "./GlReader.js";

/** @internal */
export const GlInvalidEnum = 0x0500;
/** @internal */
export const GlInvalidOperation = 0x0502;

/**
 * @internal A call failed: the error flag is set (when none is), and the debug output (a debug context with
 * GL_DEBUG_OUTPUT on and a callback) calls the program's callback right away with the driver's message – as Mesa words
 * it.
 */
export function glError(r: GlReader, code: number, message: string): void {
  if (r.errorFlag === 0) r.errorFlag = code;
  if (!r.debugOutput || !r.debugContext || r.debugCallback === null) return;
  const text = message.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  // GL_DEBUG_SOURCE_API, GL_DEBUG_TYPE_ERROR, id 1, GL_DEBUG_SEVERITY_HIGH.
  r.env.run(`${r.debugCallback}(0x8246, 0x824C, 1, 0x9146, ${message.length}, "${text}", nullptr);`);
}

/** @internal State a debugging program sets (the debug context, the debug output, the callback); false: go on. */
export function debugCall(r: GlReader, name: string, a: readonly string[]): boolean {
  const Arg = (i: number): string => (i < a.length ? trimNet(a[i]!) : "");
  switch (name) {
    case "glfwWindowHint":
      if (Arg(0) !== "GLFW_OPENGL_DEBUG_CONTEXT") break;
      r.debugContext = ["true", "GL_TRUE", "GLFW_TRUE", "1"].includes(Arg(1));
      return true;
    case "glEnable":
    case "glDisable":
      if (Arg(0) !== "GL_DEBUG_OUTPUT") break;
      r.debugOutput = name === "glEnable";
      return true;
    case "glDebugMessageCallback": {
      const fn = /^\(?\s*(?:GLDEBUGPROC\s*\)\s*)?&?\s*(\w+)\s*\)?$/.exec(Arg(0));
      r.debugCallback = fn !== null && r.src.functions.has(fn[1]!) ? fn[1]! : null;
      return true;
    }
    case "glDebugMessageControl":
    case "glObjectLabel":
      return true;
  }
  return false;
}

/** @internal The answers of the API queries the program's own code evaluates (null: not one of them). */
export function apiValue(r: GlReader, name: string, args: readonly A.Expr[]): ShaderValue | null {
  const out = (index: number, value: ShaderValue): void => {
    if (index >= args.length) return;
    // An out parameter: &success is the variable success.
    const arg = args[index]!;
    const target = arg instanceof A.Unary && arg.op === "&" ? arg.operand : arg;
    try {
      r.env.runner.assign(target, value);
    } catch (e) {
      if (!(e instanceof ShaderRuntimeException)) throw e;
    }
  };
  const first = args[0];
  switch (name) {
    case "glGetError": {
      const code = r.errorFlag;
      r.errorFlag = 0;
      return ShaderValue.integer(code);
    }
    case "glCheckFramebufferStatus":
      // The simulated framebuffers are complete.
      return ShaderValue.str("GL_FRAMEBUFFER_COMPLETE");
    case "glGetShaderiv":
    case "glGetProgramiv":
      // Compile and link status: the simulator reports a failed shader itself (in the output, as the driver's
      // log would) – the program's own check sees success.
      out(2, ShaderValue.integer(1));
      return ShaderValue.integer(0);
    case "glGetIntegerv": {
      const value = args.length >= 2 && first instanceof A.Name ? glLimit(first.id, 0) : null;
      if (value !== null) {
        out(1, ShaderValue.integer(value));
        return ShaderValue.integer(0);
      }
      if (args.length >= 2 && first instanceof A.Name && first.id === "GL_CONTEXT_FLAGS") {
        // GL_CONTEXT_FLAG_DEBUG_BIT in a debug context (4.3: debug output is core).
        out(1, ShaderValue.integer(r.debugContext ? 0x2 : 0));
        return ShaderValue.integer(0);
      }
      break;
    }
    case "glGetIntegeri_v": {
      if (!(args.length >= 3 && first instanceof A.Name)) break;
      const at = r.env.tryEval(args[1]!);
      const index = at !== null && at.v !== null && at.v.length > 0 ? toInt(at.v[0]!) : 0;
      const limitValue = glLimit(first.id, index);
      if (limitValue !== null) out(2, ShaderValue.integer(limitValue));
      return ShaderValue.integer(0);
    }
  }
  return null;
}

/** The limits Mesa's llvmpipe reports (glGetIntegerv, glGetIntegeri_v), or null for another query. */
function glLimit(name: string, index: number): number | null {
  switch (name) {
    case "GL_MAX_TESS_GEN_LEVEL": return 64;
    case "GL_MAX_PATCH_VERTICES": return 32;
    case "GL_MAX_COMPUTE_WORK_GROUP_COUNT": return 65535;
    case "GL_MAX_COMPUTE_WORK_GROUP_SIZE": return index === 2 ? 1024 : 1024;
    case "GL_MAX_COMPUTE_WORK_GROUP_INVOCATIONS": return 1024;
    case "GL_MAX_COMPUTE_SHARED_MEMORY_SIZE": return 32768;
    case "GL_MAX_IMAGE_UNITS": return 32;
    case "GL_MAX_TEXTURE_IMAGE_UNITS": return 32;
    case "GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS": return 192;
    case "GL_MAX_VERTEX_ATTRIBS": return 16;
    case "GL_MAX_TEXTURE_SIZE": return 16384;
    case "GL_MAX_UNIFORM_BLOCK_SIZE": return 65536;
    default: return null;
  }
}

/**
 * @internal A statement with the program's function-like macros expanded (glCheckError() → glCheckError_(__FILE__,
 * __LINE__)), __FILE__ as the main file's name and __LINE__ as the statement's line.
 */
export function expandMacros(r: GlReader, text: string, line: number): string {
  const main = r.project.mainFile;
  // Path.GetFileName (on Linux: after the last '/').
  return r.src.expandMacros(text, line, main.slice(main.lastIndexOf("/") + 1));
}
