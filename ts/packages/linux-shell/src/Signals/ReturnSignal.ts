// Port of Signals/ReturnSignal.cs – control signal: `return` in a function or sourced script.

import { ControlSignal } from "./ControlSignal.js";

/** `return` in a function or a sourced script. */
export class ReturnSignal extends ControlSignal {
  constructor(readonly code: number) {
    super();
  }
}
