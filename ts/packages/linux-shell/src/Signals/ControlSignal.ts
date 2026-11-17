// Port of Signals/ControlSignal.cs (src/shell/signals.ts) – exceptions used to jump out of scripts, functions
// and loops. They are caught by the shell and must never be shown as "internal error".

export abstract class ControlSignal extends Error {
  protected constructor(message?: string) {
    super(message);
  }
}
