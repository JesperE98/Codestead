// Port of Signals/ExitSignal.cs – control signal: `exit` in a script.

import { ControlSignal } from "./ControlSignal.js";

/** `exit` in a script. */
export class ExitSignal extends ControlSignal {
  constructor(readonly code: number) {
    super();
  }
}
