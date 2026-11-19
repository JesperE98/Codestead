import { trimNet, tryParseInt } from "../internal/dotnet.js";
import { escapeRegex, matchesAll } from "../internal/regex.js";
import { CppSource } from "./CppSource.js";

/** A field of a struct: its type, name and number of floats. */
export interface StructField {
  readonly type: string;
  readonly name: string;
  readonly floats: number;
}

/** struct Name { or struct Name : Base { (and : public Base): the base's name in group 1. */
function header(structName: string): RegExp {
  return new RegExp(String.raw`\bstruct\s+` + escapeRegex(structName) + String.raw`\s*(?::\s*(?:public\s+)?(\w+)\s*)?\{`);
}

/** The fields of a C++ struct in order, with their number of floats (glm::vec3 → 3, XMFLOAT4 → 4, float → 1). */
export const StructLayout = {
  fields(src: CppSource, structName: string, depth = 0): StructField[] | null {
    const m = header(structName).exec(src.code);
    if (m === null) return null;
    const open = m.index + m[0].length - 1;
    const close = CppSource.matchBracket(src.code, open);
    if (close < 0) return null;
    const body = src.code.slice(open + 1, close);
    const fields: StructField[] = [];
    // A derived struct (struct BallObject : GameObject): the base's members first, as C++ lays them out.
    if (m[1] !== undefined && depth < 8) {
      const inherited = StructLayout.fields(src, m[1], depth + 1);
      if (inherited !== null) fields.push(...inherited);
    }
    for (const { type, name, count } of members(src, body)) fields.push({ type, name, floats: StructLayout.floatsOf(type) * count });
    return fields;
  },

  /**
   * The default member initialisers of a struct (unsigned int Width = SCREEN_WIDTH; GameState State = GAME_ACTIVE;):
   * member name → the initialiser's text.
   */
  defaults(src: CppSource, structName: string, depth = 0): Map<string, string> {
    const result = new Map<string, string>();
    const m = header(structName).exec(src.code);
    if (m === null) return result;
    if (m[1] !== undefined && depth < 8) for (const [k, v] of StructLayout.defaults(src, m[1], depth + 1)) result.set(k, v);
    const open = m.index + m[0].length - 1;
    const close = CppSource.matchBracket(src.code, open);
    if (close < 0) return result;
    for (const { name, init } of members(src, src.code.slice(open + 1, close))) if (init !== null) result.set(name, init);
    return result;
  },

  floatsOf(type: string): number {
    switch (type) {
      case "vec2": case "XMFLOAT2": case "float2": case "ivec2": case "uvec2": return 2;
      case "vec3": case "XMFLOAT3": case "float3": case "ivec3": case "uvec3": return 3;
      case "vec4": case "XMFLOAT4": case "float4": case "ivec4": case "uvec4": return 4;
      case "mat4": case "mat4x4": case "XMFLOAT4X4": case "XMMATRIX": case "float4x4": return 16;
      case "mat3": case "mat3x3": case "XMFLOAT3X3": case "float3x3": return 9;
      default: return 1;
    }
  },
};

/** The data members of a struct body: type, name, array size, default initialiser (or null). */
function members(src: CppSource, body: string): { type: string; name: string; count: number; init: string | null }[] {
  // Member functions go ({ … } blocks); a brace initialiser (= {}, glm::vec3 scale = { 1.0f, 1.0f, 1.0f };) is kept
  // aside first, so it is not taken for a block.
  const initialisers: string[] = [];
  let kept = "";
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "=") {
      const brace = /^\s*\{/.exec(body.slice(i + 1));
      if (brace !== null) {
        const open = i + 1 + brace[0].length - 1;
        const close = CppSource.matchBracket(body, open);
        if (close > open) {
          initialisers.push(body.slice(open, close + 1));
          kept += "= \u0001" + (initialisers.length - 1) + "\u0002";
          i = close;
          continue;
        }
      }
    }
    kept += body[i];
  }
  const flat = removeBlocks(kept);
  const result: { type: string; name: string; count: number; init: string | null }[] = [];
  // Types of one word (vec3, float), with a namespace (glm::vec2), unsigned int, std::string and templates
  // (std::vector<GameObject>: the game's members).
  const re = /(?:^|;)\s*(?:const\s+)?(?<type>(?:unsigned\s+|signed\s+)?(?:glm::|DirectX::|std::)?[A-Za-z_]\w*(?:\s*<[^;{}()]*>)?)(?<pointer>\s*\*+\s*|\s+)(?<names>[A-Za-z_][^;{}]*?)\s*(?=;)/g;
  for (const f of matchesAll(re, flat)) {
    let type = f.groups!["type"]!.replaceAll("glm::", "").replaceAll("DirectX::", "");
    if (["static", "return", "using", "friend", "typedef"].includes(type)) continue;
    // unsigned int → uint (an integer); std::vector<T> → vector, std::string → string, std::map<…> → map.
    type = type.replace(/^unsigned\s+(?:int|long|short)?$/, "uint");
    type = type.replace(/^signed\s+(int|long|short)$/, "int");
    if (/^(?:std::)?vector\s*</.test(type)) type = "vector";
    else if (/^(?:std::)?(?:map|unordered_map)\s*</.test(type)) type = "map";
    else if (type === "std::string" || type === "string") type = "string";
    else if (type.startsWith("std::")) type = type.slice(5);
    // A pointer (Model* pModel = nullptr;): the type with its star – it holds another object, not a value of its own.
    if (f.groups!["pointer"]!.includes("*")) type += "*";
    for (const raw of CppSource.splitArgs(f.groups!["names"]!)) {
      const nm = /^(\w+)(?:\s*\[\s*(\w+)\s*\])?\s*(?:=\s*(.+))?$/s.exec(trimNet(raw));
      if (nm === null) continue;
      // The size: a number or a constant (Light lights[NR_LIGHTS]; with const unsigned int NR_LIGHTS = 32;).
      const count = nm[2] === undefined ? 1 : (tryParseInt(nm[2]) ?? src.int(nm[2]) ?? 1);
      let init = nm[3] !== undefined ? trimNet(nm[3]) : null;
      if (init !== null) init = init.replace(/\u0001(\d+)\u0002/g, (_, k: string) => (/^\{\s*\}$/.test(initialisers[Number(k)]!) ? "{}" : initialisers[Number(k)]!));
      result.push({ type, name: nm[1]!, count, init });
    }
  }
  return result;
}

function removeBlocks(body: string): string {
  let sb = "";
  let depth = 0;
  for (const c of body) {
    if (c === "{") depth++;
    if (depth === 0) sb += c;
    if (c === "}") {
      depth--;
      if (depth === 0) sb += ";";
    }
  }
  // "static X f(...)" leftovers before a body: drop function declarations (a parenthesis before any "="; a member's
  // initialiser glm::vec2 Position = glm::vec2(0.0f) stays).
  const members = sb.replace(/(?<=^|;)[^;]*\boperator\b[^;]*;/g, ";");
  return members.replace(/(?<=^|;)[^;=]*\([^;]*\)\s*(?:const\s*)?;/g, ";");
}
