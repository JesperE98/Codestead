// Port of Codestead.Terminal/ShellSandbox.cs – the sandbox of the lessons' "try it" questions: a fresh simulated
// computer of a distribution, in the learner's language – separate from the learner's own terminal. It tells what
// a command prints there. (Implements ISandbox from Codestead.UI in C#.)

import * as UtilCmd from "../Commands/Util/UtilCmd.js";
import { Shell } from "../Shell/Shell.js";

export class ShellSandbox {
  constructor(
    private readonly distroId: string,
    private readonly lang: string,
  ) {}

  private fresh(): Shell {
    const sh = Shell.create(this.distroId, this.lang);
    sh.lang = this.lang;
    return sh;
  }

  outputOf(command: string): string {
    return UtilCmd.stripAnsi(this.fresh().execute(command).output);
  }
}
