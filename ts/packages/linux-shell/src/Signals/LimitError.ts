// Port of Signals/LimitError.cs – control signal: too many commands in one run (e.g. an infinite loop).

import { ControlSignal } from "./ControlSignal.js";

/** The shell ran too many commands in a single run (e.g. an infinite loop). */
export class LimitError extends ControlSignal {
  constructor(message: string) {
    super(message);
  }
}
