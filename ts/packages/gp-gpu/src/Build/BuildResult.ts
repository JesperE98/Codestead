import type { Scene } from "../Scene/Scene.js";
import type { Diagnostic } from "./Diagnostic.js";

/**
 * What "Build &amp; run" gave: the commands it showed, the compiler messages, and – when it compiled – what the program
 * does when it runs (scene).
 */
export class BuildResult {
  constructor(readonly api: string, readonly commands: readonly string[], readonly diagnostics: readonly Diagnostic[], readonly scene: Scene | null) {}

  get succeeded(): boolean {
    return this.diagnostics.every((d) => !d.isError);
  }
}
