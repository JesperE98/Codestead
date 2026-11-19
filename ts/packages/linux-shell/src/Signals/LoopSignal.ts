// Port of Signals/LoopSignal.cs – control signal: `break` and `continue`.

import { ControlSignal } from "./ControlSignal.js";

/** `break` and `continue` (with number of levels). */
export class LoopSignal extends ControlSignal {
  constructor(
    /** "break" or "continue". */
    readonly kind: "break" | "continue",
    public levels: number,
  ) {
    super();
  }
}
