import { CullMode } from "../Scene/CullMode.js";
import { Topology } from "../Scene/Topology.js";
import { ShaderProgram } from "../Shading/ShaderProgram.js";
import type { Fixed } from "./PipelineState.js";

/** The optional parts of a PipelineInfo (the record's optional parameters and init-only properties). */
export interface PipelineInfoOptions {
  state?: Fixed | null;
  gs?: ShaderProgram | null;
  gsEntry?: string;
  /** The tessellation stages (Vulkan .tesc / .tese, D3D12 HS / DS) and the control points per patch. */
  tcs?: ShaderProgram | null;
  tes?: ShaderProgram | null;
  tcsEntry?: string;
  tesEntry?: string;
  patchPoints?: number;
}

/** One graphics pipeline (Vulkan) or pipeline state object (DirectX 12): its shaders and fixed-function state. */
export class PipelineInfo {
  readonly state: Fixed | null;
  readonly gs: ShaderProgram | null;
  readonly gsEntry: string;
  readonly tcs: ShaderProgram | null;
  readonly tes: ShaderProgram | null;
  readonly tcsEntry: string;
  readonly tesEntry: string;
  readonly patchPoints: number;

  constructor(
    readonly name: string,
    readonly vs: ShaderProgram,
    readonly fs: ShaderProgram,
    readonly vsEntry: string,
    readonly fsEntry: string,
    readonly cull: CullMode,
    readonly frontCcw: boolean,
    readonly wireframe: boolean,
    readonly depthTest: boolean,
    readonly topology: Topology,
    o: PipelineInfoOptions = {},
  ) {
    this.state = o.state ?? null;
    this.gs = o.gs ?? null;
    this.gsEntry = o.gsEntry ?? "main";
    this.tcs = o.tcs ?? null;
    this.tes = o.tes ?? null;
    this.tcsEntry = o.tcsEntry ?? "main";
    this.tesEntry = o.tesEntry ?? "main";
    this.patchPoints = o.patchPoints ?? 3;
  }

  /** A program with the globals of several stages (for the samplers and blocks any of them reads). */
  static merged(first: ShaderProgram, ...more: (ShaderProgram | null)[]): ShaderProgram {
    if (more.every((m) => m === null)) return first;
    const merged = new ShaderProgram();
    merged.source = first.source;
    merged.globals.push(...first.globals);
    merged.structs.push(...first.structs);
    for (const m of more)
      if (m !== null) {
        merged.globals.push(...m.globals);
        merged.structs.push(...m.structs);
      }
    return merged;
  }
}
