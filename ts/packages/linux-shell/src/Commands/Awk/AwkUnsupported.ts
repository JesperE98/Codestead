// Port of Commands/Awk/AwkUnsupported.cs.

import type { Shell } from "../../Shell/Shell.js";
import type { MsgArgs } from "../../ShellI18n.js";

/**
 * An awk construct the simulator lacks: a message key (e.g. awk.featureFunction) with its arguments,
 * or – for a bare keyword such as getline – just that keyword.
 */
export class AwkUnsupported {
  private readonly key: string | null;
  private readonly kw: string | null;
  private readonly args: MsgArgs;

  constructor(key: string | null, keyword: string | null, args: MsgArgs) {
    this.key = key;
    this.kw = keyword;
    this.args = args;
  }

  static feature(key: string, args: MsgArgs = {}): AwkUnsupported {
    return new AwkUnsupported(key, null, args);
  }

  static keyword(keyword: string): AwkUnsupported {
    return new AwkUnsupported(null, keyword, {});
  }

  /** The construct described in the shell's language. */
  describe(sh: Shell): string {
    return this.key !== null ? sh.msg(this.key, this.args) : this.kw!;
  }
}
