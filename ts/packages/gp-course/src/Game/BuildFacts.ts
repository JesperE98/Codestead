import { CommandFacts } from "@codestead/learning";
import type { CheckContext } from "../CheckContext.js";

/** The init-only properties of {@link BuildFacts}. */
export interface BuildFactsInit {
  line?: string;
  output?: string;
  exitCode?: number;
  api?: string;
  succeeded?: boolean;
  showsFrames?: boolean;
  drew?: boolean;
  clearColor?: readonly number[] | null;
}

/** What one "Build &amp; run" did, for the statistics and achievements. {@link CommandFacts.names} are the API functions the project calls. */
export class BuildFacts extends CommandFacts {
  readonly api: string;
  readonly succeeded: boolean;
  /** The window stayed open and showed frames. */
  readonly showsFrames: boolean;
  /** Something was drawn in the frame. */
  readonly drew: boolean;
  readonly clearColor: readonly number[] | null;

  constructor(init: BuildFactsInit = {}) {
    super(init);
    this.api = init.api ?? "";
    this.succeeded = init.succeeded ?? false;
    this.showsFrames = init.showsFrames ?? false;
    this.drew = init.drew ?? false;
    this.clearColor = init.clearColor ?? null;
  }

  static from(c: CheckContext): BuildFacts {
    const facts = new BuildFacts({
      line: "build",
      output: c.build.diagnostics.map((d) => d.toString()).join("\n"),
      exitCode: c.built ? 0 : 1,
      api: c.api,
      succeeded: c.built,
      showsFrames: c.shows,
      drew: c.shows && c.drew,
      clearColor: c.shows ? c.scene!.clearColor : null,
    });
    for (const m of c.cpp.matchAll(/\b(gl[A-Z]\w*|glfw[A-Z]\w*|vk[A-Z]\w*|D3D12[A-Z]\w*|CreateDXGIFactory\d?)\s*\(/g))
      if (!facts.names.includes(m[1]!)) facts.names.push(m[1]!);
    facts.firstWords.push("build");
    return facts;
  }
}
