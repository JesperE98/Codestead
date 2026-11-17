import type { Function, Global, Struct } from "./ShaderAst.js";

/** A parsed shader file: its structs, globals (inputs, outputs, uniforms, constants) and functions. */
export class ShaderProgram {
  /** The text the program was parsed from. */
  source = "";

  readonly structs: Struct[] = [];
  readonly globals: Global[] = [];
  readonly functions: Function[] = [];

  /** Every name the program's code reads or writes (gl_FragDepth, gl_Layer …). */
  readonly names = new Set<string>();
  /** A geometry shader's input primitive (points, lines, triangles), from layout (…) in;. */
  inputPrimitive: string | null = null;
  /** A geometry shader's output (points, line_strip, triangle_strip) and its max_vertices. */
  outputPrimitive: string | null = null;
  maxVertices = 0;
  /**
   * A geometry shader's instances: it runs this many times per primitive (layout (triangles, invocations = 5) in;
   * HLSL [instance(5)]), with gl_InvocationID / SV_GSInstanceID 0, 1 ….
   */
  invocations = 1;

  /** A tessellation control shader's output patch size (layout (vertices = 4) out;), 0 when not given. */
  tessVertices = 0;
  /**
   * A tessellation evaluation shader's domain ("quads", "triangles", "isolines": layout (quads, …) in;), its spacing
   * ("equal_spacing", "fractional_odd_spacing", "fractional_even_spacing") and winding (cw; ccw by default), and
   * point_mode.
   */
  tessDomain: string | null = null;
  tessSpacing: string | null = null;
  tessCw = false;
  tessPointMode = false;
  /** A compute shader's work group size (layout (local_size_x = 16, local_size_y = 16) in;), 1 where not given. */
  readonly localSize: number[] = [1, 1, 1];

  /**
   * HLSL attributes of the functions by name ([domain("quad")], [partitioning("fractional_odd")],
   * [outputcontrolpoints(4)], [patchconstantfunc("…")], [numthreads(16, 16, 1)]): attribute → its arguments as text.
   */
  readonly attributes = new Map<string, Map<string, string[]>>();

  /** An HLSL function's attribute (its arguments), or null. */
  attribute(func: string, name: string): string[] | null {
    return this.attributes.get(func)?.get(name) ?? null;
  }

  // Looked up at every call of a running shader: by name, made again when the program has grown (while it is parsed).
  private functionsByName: Map<string, Function> | null = null;
  private structsByName: Map<string, Struct> | null = null;
  private indexedFunctions = -1;
  private indexedStructs = -1;

  /** The function of a name: its definition (the last one with a body), or its declaration. */
  findFunction(id: string): Function | null {
    let index = this.functionsByName;
    if (index === null || this.indexedFunctions !== this.functions.length) {
      index = new Map();
      for (const f of this.functions) {
        const known = index.get(f.id);
        if (f.body.length > 0 || known === undefined || known.body.length === 0) index.set(f.id, f);
      }
      this.indexedFunctions = this.functions.length;
      this.functionsByName = index;
    }
    return index.get(id) ?? null;
  }

  findStruct(id: string): Struct | null {
    let index = this.structsByName;
    if (index === null || this.indexedStructs !== this.structs.length) {
      index = new Map();
      for (const s of this.structs) if (!index.has(s.id)) index.set(s.id, s);
      this.indexedStructs = this.structs.length;
      this.structsByName = index;
    }
    return index.get(id) ?? null;
  }
}
