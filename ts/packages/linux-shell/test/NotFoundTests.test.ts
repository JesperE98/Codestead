// Port of tests/Linux/Codestead.Shell.Tests/NotFoundTests.cs – after "command not found" the simulator says whose
// mistake it is: a likely typo ("Did you mean"), a real command the simulator does not have, or a command in a
// package that is not installed.

import { describe, expect, it } from "vitest";
import * as IndexCmd from "../src/Commands/IndexCmd.js";
import * as KnownCommands from "../src/KnownCommands.js";
import * as PackagesLib from "../src/Packages/PackagesLib.js";
import { expectStartsWith, itNeeds, TestShell, whenCommands } from "./TestShell.js";

describe("NotFoundTests", () => {
  itNeeds(["ls", "pwd", "alias", "echo"], "stavfel ger förslag på kommandon som finns", () => {
    const t = new TestShell("ubuntu", "en");
    const r = t.run("lss");
    expect(r.exitCode).toBe(127);
    expectStartsWith(r.out, "bash: lss: command not found\n");
    expect(r.out).toContain("did you mean");
    expect(r.out).toContain("ls");
    // Two swapped letters count as one typo.
    expect(t.run("pdw").out).toContain("did you mean");
    expect(t.run("pdw").out).toContain("pwd");
    // An alias or a function of the learner is suggested too.
    t.run("alias hej='echo hej'");
    expect(t.run("hjej").out).toContain("hej");
  });

  it("ett riktigt kommando som simulatorn saknar sägs vara just det", () => {
    const t = new TestShell("ubuntu", "en");
    const r = t.run("jq .name file.json");
    expect(r.exitCode).toBe(127);
    expect(r.out).toContain("'jq' is a real Linux command, but this simulator does not have it");
    expect(r.out).not.toContain("did you mean");
    expect(new TestShell("ubuntu", "sv").run("nmap localhost").out).toContain("simulatorn har det inte");
  });

  it("ett kommando i ett paket som inte är installerat visar paketet som förut", () => {
    const arch = new TestShell("arch", "en");
    const r = arch.run("cowsay hej");
    expect(r.out).toContain("command not found");
    expect(r.out).toContain("the command is in the package 'cowsay'");
    expect(r.out).not.toContain("real Linux command");
    // Ubuntu's own message stays exactly as on a real Ubuntu.
    const ubuntu = new TestShell("ubuntu", "en").run("cowsay hej").out;
    expectStartsWith(ubuntu, "Command 'cowsay' not found, but can be installed with:\nsudo apt install cowsay\n");
  });

  it("nonsens ger bara felet, och sudo/xargs får samma hjälp", () => {
    const t = new TestShell("ubuntu", "en");
    expect(t.run("qqqqqqqq").out).toBe("bash: qqqqqqqq: command not found\n");
    whenCommands(["sudo"], () => {
      const sudo = t.run("sudo jq .");
      expect(sudo.out).toContain("sudo: jq: command not found");
      expect(sudo.out).toContain("real Linux command");
    });
    whenCommands(["echo", "xargs", "ls"], () => {
      const xargs = t.run("echo a | xargs lss");
      expect(xargs.out).toContain("xargs: lss: No such file or directory");
      expect(xargs.out).toContain("did you mean");
    });
  });

  it("listan över riktiga kommandon innehåller inget som simulatorn har", () => {
    const implemented = [...KnownCommands.real].filter((c) => IndexCmd.commands().has(c)).sort();
    expect(implemented.length === 0, "In KnownCommands but implemented: " + implemented.join(", ")).toBe(true);
    const packaged = [...KnownCommands.real].filter((c) => ["debian", "arch", "redhat"].some((f) => PackagesLib.packageProviding(f, c) !== null)).sort();
    expect(packaged.length === 0, "In KnownCommands but in a package: " + packaged.join(", ")).toBe(true);
  });
});
