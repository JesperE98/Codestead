import type { ISandbox } from "../src/index.js";

/**
 * A sandbox without any simulator: it "runs" a few known commands. Shows that the lesson controls
 * work for any tool, and keeps these tests independent of Codestead Linux.
 */
export class FakeSandbox implements ISandbox {
  private static readonly outputs: Readonly<Record<string, string>> = {
    "echo $((2 + 3))": "5\n",
    pwd: "/home/elev\n",
    "echo $PWD": "/home/elev\n",
    "echo hej": "hej\n",
    ls: "a b\n",
  };

  static run(line: string): string {
    return FakeSandbox.outputs[line.trim()] ?? "";
  }

  outputOf(command: string): string {
    return FakeSandbox.run(command);
  }
}
