// Port of Signals/SignalsLib.cs – helpers for the control signals.

import { ControlSignal } from "./ControlSignal.js";

export function isControlSignal(e: unknown): boolean {
  return e instanceof ControlSignal;
}
