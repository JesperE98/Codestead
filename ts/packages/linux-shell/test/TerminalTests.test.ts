// Port of tests/Linux/Codestead.Terminal.Tests/TerminalTests.cs – the pure logic of the terminal (ANSI segments,
// the lesson sandbox). The tests of the Avalonia TerminalView belong to the app's React terminal (ts/apps/linux).

import { describe, expect, it } from "vitest";
import * as Ansi from "../src/Terminal/Ansi.js";
import { ShellSandbox } from "../src/Terminal/ShellSandbox.js";
import { itNeeds } from "./TestShell.js";

describe("TerminalTests", () => {
  it("ANSI-färger delas upp i segment", () => {
    const segs = Ansi.parse("a\x1b[1;32mgrön\x1b[0m b");
    expect(segs.length).toBe(3);
    expect(segs[1]!.text).toBe("grön");
    expect(segs[1]!.fg).toBe(32);
    expect(segs[1]!.bold).toBe(true);
    expect(segs[2]!.fg).toBe(0);
  });

  it.todo("terminalen kör kommandon och visar prompten – the TerminalView (Avalonia UI) is ported with the app's React terminal");

  itNeeds(["echo", "touch", "ls"], "sandlådan för kontrollfrågor är en ny dator varje gång", () => {
    const sandbox = new ShellSandbox("ubuntu", "en");
    expect(sandbox.outputOf("echo $((2 + 3))").trim()).toBe("5");
    expect(sandbox.outputOf("touch spår.txt").trim()).toBe("");
    // The next command runs on a new computer that does not have the file.
    expect(sandbox.outputOf("ls spår.txt")).toContain("No such file");
  });

  it.todo("en try-fråga löses av ett kommando i den riktiga simulerade terminalen – needs the CheckpointView (ui package) and the React terminal");
});
