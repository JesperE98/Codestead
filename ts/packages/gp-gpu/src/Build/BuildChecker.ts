import { Apis } from "../Apis.js";
import type { GpuProject } from "../GpuProject.js";
import { escapeRegex, matchesAll } from "../internal/regex.js";
import { CppSource } from "../Readers/CppSource.js";
import { ShaderSyntaxException } from "../Shading/ShaderErrors.js";
import { ShaderParser } from "../Shading/ShaderParser.js";
import { ApiSymbols } from "./ApiSymbols.js";
import { Diagnostic } from "./Diagnostic.js";

const ApiNames = new Map<string, RegExp>([
  [Apis.OpenGL, /(?<![\w.>])(gl[A-Z]\w*|GL_[A-Z0-9_]+|glfw[A-Z]\w*|GLFW_[A-Z0-9_]+)\b/g],
  [Apis.Vulkan, /(?<![\w.>])(vk[A-Z]\w*|Vk[A-Z]\w*|VK_[A-Z0-9_]+|glfw[A-Z]\w*|GLFW_[A-Z0-9_]+)\b/g],
  [Apis.D3D12, /(?<![\w.>])(D3D12[A-Z]\w*|ID3D12\w+|IDXGI\w+|DXGI_[A-Z0-9_]+|D3D_[A-Z0-9_]+|D3D12_[A-Z0-9_]+|CD3DX12_\w+|D3DCompile\w*|D3DCOMPILE_\w+|XM[A-Z]\w*|CreateDXGIFactory\w*)\b/g],
]);

const ArrowCall = /->\s*([A-Za-z_]\w*)\s*\(/g;

/** Path.GetExtension(file).ToLowerInvariant(). */
function extensionOf(file: string): string {
  const name = file.slice(file.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

/**
 * The compile step of "Build &amp; run": the mistakes a compiler would stop at. Brackets that do not match, API names
 * that do not exist (with "did you mean"), and shaders that do not parse or lack their #version line.
 */
export const BuildChecker = {
  check(project: GpuProject, api: string): Diagnostic[] {
    const list: Diagnostic[] = [];
    for (const [file, text] of project.files) {
      const ext = extensionOf(file);
      if ([".cpp", ".h", ".hpp", ".c"].includes(ext)) cpp(file, text, api, list);
      // (the tessellation stages: .tcs / .tes, Vulkan's .tesc / .tese; compute: .comp)
      else if ([".vs", ".fs", ".vert", ".frag", ".glsl", ".geom", ".gs", ".tcs", ".tes", ".tesc", ".tese", ".comp"].includes(ext)) glsl(file, text, api, list);
      else if (ext === ".hlsl") hlsl(file, text, list);
    }
    return list;
  },
};

function cpp(file: string, text: string, api: string, list: Diagnostic[]): void {
  const src = new CppSource(file, text);
  if (brackets(file, src.code, list)) return;
  // Names the file defines itself (#define, functions, variables) are not API names.
  const own = new Set(matchesAll(/#\s*define\s+(\w+)|\b(\w+)\s*\(/g, src.code).map((m) => m[1] ?? m[2]!)
    .filter((n) => new RegExp(String.raw`(?:#\s*define\s+|\b(?:void|bool|int|float|auto|static|HRESULT|VkResult|uint32_t|std::\w+(?:<[^>]*>)?|[A-Z]\w*)[\s*&]+)` + escapeRegex(n) + String.raw`\b`).test(src.code)));
  const re = ApiNames.get(api);
  if (re !== undefined) {
    const known = ApiSymbols.for(api);
    const reported = new Set<string>();
    for (const m of matchesAll(re, stripStrings(src.code))) {
      const name = m[1]!;
      if (known.has(name) || own.has(name) || isDeclared(src.code, name) || reported.has(name)) continue;
      reported.add(name);
      const suggestion = ApiSymbols.suggest(name, known);
      list.push(new Diagnostic(file, src.lineAt(m.index), true, `'${name}' was not declared in this scope` + (suggestion === null ? "" : `; did you mean '${suggestion}'?`)));
    }
  }
  if (api === Apis.D3D12) {
    let methods = ApiSymbols.for("d3d12-methods");
    // A program that loads models with Assimp (aiMesh, aiMaterial …) calls its methods after -> too.
    if (src.code.includes("assimp/")) methods = new Set([...methods, ...ApiSymbols.for("assimp-methods")]);
    const reported = new Set<string>();
    for (const m of matchesAll(ArrowCall, src.code)) {
      const name = m[1]!;
      if (methods.has(name) || own.has(name) || src.functions.has(name) || reported.has(name)) continue;
      reported.add(name);
      const suggestion = ApiSymbols.suggest(name, methods);
      list.push(new Diagnostic(file, src.lineAt(m.index), true, `no member named '${name}'` + (suggestion === null ? "" : `; did you mean '${suggestion}'?`)));
    }
  }
}

/** Is a name declared in the file as a variable or parameter (uint32_t glfwExtensionCount = 0;)? */
function isDeclared(code: string, name: string): boolean {
  return matchesAll(new RegExp(String.raw`(?:\b(?<type>[A-Za-z_][\w:]*(?:<[^;(){}]*>)?)\s*[*&]*\s+|[*&]\s*)` + escapeRegex(name) + String.raw`\s*(?:=|;|\[|\{|,|\)|:)`, "g"), code)
    .some((m) => !["return", "else", "case", "new", "delete", "throw", "sizeof"].includes(m.groups?.["type"] ?? ""));
}

/** String literals blanked (a window title is not an API name). */
function stripStrings(code: string): string {
  return code.replace(/"(?:[^"\\\n]|\\.)*"/g, (m) => " ".repeat(m.length));
}

/** Reports the first bracket that does not match; true when one was found. */
function brackets(file: string, code: string, list: Diagnostic[]): boolean {
  const stack: { ch: string; at: number }[] = [];
  for (let i = 0; i < code.length; i++) {
    const c = code[i]!;
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== c && code[j] !== "\n") {
        if (code[j] === "\\") j++;
        j++;
      }
      i = j;
      continue;
    }
    if (c === "(" || c === "{" || c === "[") stack.push({ ch: c, at: i });
    else if (c === ")" || c === "}" || c === "]") {
      const open = c === ")" ? "(" : c === "}" ? "{" : "[";
      const top = stack[stack.length - 1];
      if (top === undefined || top.ch !== open) {
        list.push(new Diagnostic(file, lineAt(code, i), true, top === undefined
          ? `expected declaration before '${c}' token`
          : `expected '${close(top.ch)}' before '${c}' token`));
        return true;
      }
      stack.pop();
    }
  }
  const top = stack[stack.length - 1];
  if (top !== undefined) {
    list.push(new Diagnostic(file, lineAt(code, top.at), true, `'${top.ch}' is never closed: expected '${close(top.ch)}' at end of input`));
    return true;
  }
  return false;
}

function close(open: string): string {
  return open === "(" ? ")" : open === "{" ? "}" : "]";
}

function lineAt(s: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < s.length; i++) if (s[i] === "\n") line++;
  return line;
}

function glsl(file: string, text: string, api: string, list: Diagnostic[]): void {
  const code = CppSource.blankComments(text.replaceAll("\r\n", "\n"));
  const lines = code.split("\n");
  let firstText = "", firstLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (t.length > 0) {
      firstText = t;
      firstLine = i + 1;
      break;
    }
  }
  // (C#: FirstOrDefault gives a null text when every line is blank, and StartsWith then throws NullReferenceException.)
  if (firstLine === 0) throw new TypeError("Object reference not set to an instance of an object.");
  if (!firstText.startsWith("#version")) {
    list.push(new Diagnostic(file, firstLine === 0 ? 1 : firstLine, true, "the shader must start with a #version line (" + (api === Apis.Vulkan ? "#version 450" : "#version 330 core") + ")"));
    return;
  }
  if (brackets(file, code, list)) return;
  parse(file, text, list);
}

function hlsl(file: string, text: string, list: Diagnostic[]): void {
  if (brackets(file, CppSource.blankComments(text.replaceAll("\r\n", "\n")), list)) return;
  parse(file, text, list);
}

function parse(file: string, text: string, list: Diagnostic[]): void {
  try {
    ShaderParser.parseProgram(text);
  } catch (e) {
    if (!(e instanceof ShaderSyntaxException)) throw e;
    list.push(new Diagnostic(file, e.line, true, e.message));
  }
}
