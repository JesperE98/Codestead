// Port of tests/Linux/Codestead.Shell.Tests/TestShell.cs – the usual test helper from the TypeScript tests:
//   const sh = Shell.create(distro); const run = (line) => ({ ...sh.execute(line), out: stripAnsi(...) })
// plus helpers for the tests that need commands which are ported in wave 2.

import { expect, it } from "vitest";
import * as IndexCmd from "../src/Commands/IndexCmd.js";
import * as UtilCmd from "../src/Commands/Util/UtilCmd.js";
import type { ExecResult } from "../src/Shell/ExecResult.js";
import { Shell } from "../src/Shell/Shell.js";
import * as ShellI18n from "../src/ShellI18n.js";
import type { FsNode } from "../src/Vfs/FsNode.js";

/** The result of one command line: the ExecResult plus out without ANSI colours ({ ...r, out: stripAnsi(r.output) }). */
export interface RunResult extends ExecResult {
  out: string;
}

export class TestShell {
  readonly sh: Shell;

  /** A Swedish computer (the tests were written for it) unless world says otherwise. */
  constructor(distro = "ubuntu", lang: string | null = null, world = "sv") {
    this.sh = Shell.create(distro, world);
    if (lang !== null) this.sh.lang = lang;
  }

  run(line: string): RunResult {
    const r = this.sh.execute(line);
    return { ...r, out: UtilCmd.stripAnsi(r.output) };
  }

  /** Runs several lines and returns the last result. */
  runAll(...lines: string[]): RunResult {
    let last: RunResult | null = null;
    for (const l of lines) last = this.run(l);
    return last!;
  }

  /** sh.vfs.tryLookup(path.replace(/^~/, '/home/elev'), sh.rootUser()) */
  node(path: string): FsNode | null {
    return this.sh.vfs.tryLookup(path.startsWith("~") ? "/home/elev" + path.slice(1) : path, this.sh.rootUser());
  }

  /** Contents of a file (as root), or null if it does not exist. */
  content(path: string): string | null {
    return this.node(path)?.content ?? null;
  }
}

/** Assert.StartsWith(expected, actual) */
export function expectStartsWith(actual: string | null | undefined, expected: string): void {
  expect(actual?.slice(0, expected.length)).toBe(expected);
}

/** Assert.EndsWith(expected, actual) */
export function expectEndsWith(actual: string | null | undefined, expected: string): void {
  expect(actual?.slice(-expected.length)).toBe(expected);
}

/** The commands a test needs that are not in IndexCmd yet (they are ported in wave 2). */
export function missingCommands(commands: readonly string[]): string[] {
  return commands.filter((c) => !IndexCmd.commands().has(c));
}

/**
 * A test that runs commands from Commands/: it runs once they are all ported, and until then it is listed as
 * a todo that says which commands it waits for. The test body is the full port of the C# test.
 */
export function itNeeds(commands: readonly string[], name: string, fn: () => void): void {
  const missing = missingCommands(commands);
  if (missing.length > 0) it.todo(`${name} – waits for the commands ${missing.join(", ")} (wave 2)`);
  else it(name, fn);
}

/** Every command help shows (the summaries in i18n/en.json): the whole command set of the C# app. */
export function allCommandNames(): string[] {
  return [...ShellI18n.summaries("en").keys()];
}

/**
 * Part of a test that runs commands from Commands/: runs only when they are all ported (wave 2). Used where the
 * rest of the test is about the core and can run already; the whole test body is still the full C# test.
 */
export function whenCommands(commands: readonly string[], fn: () => void): void {
  if (missingCommands(commands).length === 0) fn();
}
