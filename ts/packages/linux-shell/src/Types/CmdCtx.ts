// Port of Types/CmdCtx.cs – what a command gets when it runs: its streams, the shell, its name and arguments.

import type { Shell } from "../Shell/Shell.js";
import { IO } from "./IO.js";

export class CmdCtx extends IO {
  sh: Shell;
  name: string;
  args: string[];

  /** { ...io, sh, name, args } */
  constructor(io: IO, sh: Shell, name: string, args: string[]) {
    super(io);
    this.sh = sh;
    this.name = name;
    this.args = args;
  }
}
