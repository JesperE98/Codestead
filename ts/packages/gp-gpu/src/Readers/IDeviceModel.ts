import type { FrameOp } from "../Scene/FrameOp.js";
import type * as A from "../Shading/ShaderAst.js";
import type { ShaderValue } from "../Shading/ShaderValue.js";
import type { CppExec } from "./CppExec.js";

/** A model of an explicit API's device (D3D12Device, VulkanDevice) that the frame recorder feeds. */
export interface IDeviceModel {
  attach(exec: CppExec): void;
  hook(name: string, args: readonly A.Expr[]): ShaderValue | null;
  /** The state set on the command list now (copied into each recorded draw). */
  snapshot(): unknown;
  readonly ops: FrameOp[];
  /** A recorded draw's state says it goes to an off-screen target (not to the window). */
  offscreen(state: unknown): boolean;
  drawCount: () => number;
}
