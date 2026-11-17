// @vitest-environment jsdom
// Port of the UI cases of tests/Linux/Codestead.Terminal.Tests/TerminalTests.cs (the TerminalView, now the app's
// React terminal; the logic cases are in ts/packages/linux-shell/test/TerminalTests.test.ts), plus the terminal's
// behaviour from TerminalView.cs: history, Tab completion, Ctrl+C, Ctrl+L, hidden passwords, colours, the screen's
// length.

import { Checkpoint } from "@codestead/learning";
import { type ExecResult, Shell, ShellSandbox, UtilCmd } from "@codestead/linux-shell";
import { type CheckpointHandle, type CheckpointTexts, CheckpointView, SandboxRun } from "@codestead/ui";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Terminal, TerminalView } from "../src/Terminal/TerminalView.js";

afterEach(cleanup);

/** A terminal on screen with a shell. */
function open(sh: Shell = Shell.create("ubuntu", "en")) {
  const term = new TerminalView();
  term.shell = sh;
  term.inputLabel = "Command line";
  render(<Terminal view={term} />);
  const input = screen.getByRole("textbox", { name: "Command line" }) as HTMLInputElement;
  const key = (key: string, init: Partial<KeyboardEventInit> = {}) => act(() => void fireEvent.keyDown(input, { key, ...init }));
  const type = (text: string) => act(() => void fireEvent.change(input, { target: { value: text } }));
  const enter = (text: string) => {
    type(text);
    key("Enter");
  };
  const lines = () => [...document.querySelectorAll(".cs-terminal-line, .cs-terminal-output")].map((e) => e.textContent);
  return { sh, term, input, key, type, enter, lines };
}

describe("TerminalTests", () => {
  it("terminalen kör kommandon och visar prompten", () => {
    const sh = Shell.create("ubuntu");
    const { term, input, key } = open(sh);
    let last: ExecResult | null = null;
    term.onCommandExecuted((r) => (last = r));
    // Assignments are handled by the shell core itself (no command module needed).
    act(() => term.inject("X=hej"));
    expect(input.value).toBe("X=hej");
    key("Enter");
    expect(last).not.toBeNull();
    expect(sh.env.get("X")).toBe("hej");
    expect(input.value).toBe("");
  });

  it("en try-fråga löses av ett kommando i den riktiga simulerade terminalen", () => {
    const texts: CheckpointTexts = {
      check: "Check",
      correct: "Correct",
      wrong: "Wrong",
      predictPrompt: "Predict",
      tryPrompt: "Try",
      done: "Done",
      answerPlaceholder: "Answer",
      question: "Question",
    };
    const view = createRef<CheckpointHandle>();
    render(<CheckpointView ref={view} cp={Checkpoint.parse("try", "pwd", 0)} texts={texts} alreadySolved={false} sandbox={new ShellSandbox("ubuntu", "en")} />);
    const { term, enter } = open(Shell.create("ubuntu", "en"));
    term.onCommandExecuted((r) => view.current!.commandRan(new SandboxRun(r.line, UtilCmd.stripAnsi(r.output), r.exitCode, !r.pending && !r.incomplete)));
    // Another command with the same output counts too.
    enter("echo $PWD");
    expect(view.current!.isSolved).toBe(true);
  });

  it("välkomsttexten och prompten med färger", () => {
    const { sh, lines } = open();
    expect(lines()).toEqual([UtilCmd.stripAnsi(sh.welcome()).replace(/\n$/, "")]);
    const prompt = document.querySelector(".cs-terminal-prompt")!;
    expect(prompt.textContent).toBe(UtilCmd.stripAnsi(sh.prompt()));
    // user@host in bold green, the folder in bold blue (Ubuntu's prompt).
    const spans = [...prompt.querySelectorAll("span")];
    expect(spans[0]!.style.color).toBe("rgb(126, 231, 135)");
    expect(spans[0]!.style.fontWeight).toBe("bold");
    expect(spans[2]!.style.color).toBe("rgb(121, 192, 255)");
  });

  it("kommandoraden och utskriften visas efter prompten", () => {
    const { enter, lines } = open();
    enter("echo hej");
    const shown = lines();
    expect(shown.at(-2)).toMatch(/^\S+@ubuntu:~\$ echo hej$/);
    expect(shown.at(-1)).toBe("hej");
  });

  it("historiken bläddras med pil upp och ner, och det påbörjade kommandot kommer tillbaka", () => {
    const { input, key, type, enter } = open();
    enter("echo ett");
    enter("echo två");
    type("ech");
    key("ArrowUp");
    expect(input.value).toBe("echo två");
    key("ArrowUp");
    expect(input.value).toBe("echo ett");
    key("ArrowUp");
    expect(input.value).toBe("echo ett");
    key("ArrowDown");
    expect(input.value).toBe("echo två");
    key("ArrowDown");
    expect(input.value).toBe("ech");
    // Down without browsing does nothing.
    key("ArrowDown");
    expect(input.value).toBe("ech");
  });

  it("Tab fyller i kommandon och listar alternativen", () => {
    const { sh, input, key, type, lines } = open();
    type("whoam");
    key("Tab");
    expect(input.value).toBe("whoami ");
    type("ec");
    const expected = sh.complete("ec");
    key("Tab");
    expect(input.value).toBe(expected.line);
    if (expected.options.length > 0) expect(lines().at(-1)).toBe(expected.options.join("  "));
  });

  it("Ctrl+C avbryter raden och en fråga; Ctrl+L tömmer skärmen", () => {
    const { sh, input, key, type, enter, lines } = open();
    type("echo halv");
    key("c", { ctrlKey: true });
    expect(input.value).toBe("");
    expect(lines().at(-1)).toMatch(/echo halv\^C$/);
    // An unfinished for loop waits for more lines; Ctrl+C cancels it.
    enter("for i in 1 2; do");
    expect(sh.prompt()).toBe("> ");
    key("c", { ctrlKey: true });
    expect(sh.prompt()).not.toBe("> ");
    // Selected text in the input: Ctrl+C copies instead.
    type("kopiera");
    input.setSelectionRange(0, 3);
    key("c", { ctrlKey: true });
    expect(input.value).toBe("kopiera");
    key("l", { ctrlKey: true });
    expect(lines()).toEqual([]);
  });

  it("lösenord syns inte när man skriver dem", () => {
    const { sh, input, enter, lines } = open();
    enter("su");
    expect(sh.pendingQuestion?.secret).toBe(true);
    expect(input.style.color).toBe("transparent");
    enter("hemligt");
    // The answer is not on the screen.
    expect(lines().join("\n")).not.toContain("hemligt");
    expect(input.style.color).not.toBe("transparent");
  });

  it("clear tömmer skärmen och skärmen håller högst 400 rader", () => {
    const { enter, lines } = open();
    enter("clear");
    expect(lines()).toEqual([]);
    // Without React (the terminal object alone): 230 commands give 460 lines, the oldest are dropped.
    const term = new TerminalView();
    term.shell = Shell.create("ubuntu", "en");
    for (let i = 0; i < 230; i++) {
      term.setInput(`echo ${i}`);
      term.run();
    }
    expect(term.entries.length).toBe(TerminalView.MaxEntries);
    expect(term.entries.at(-1)).toMatchObject({ kind: "output", text: "229" });
  });

  it("en ny skal-instans tömmer skärmen och historikläget", () => {
    const { term, input, key, enter, lines } = open();
    enter("echo gammal");
    key("ArrowUp");
    act(() => void (term.shell = Shell.create("fedora", "en")));
    expect(input.value).toBe("");
    expect(lines()).toHaveLength(1);
    expect(document.querySelector(".cs-terminal-prompt")!.textContent).toMatch(/^\[\S+@fedora ~\]\$ $/);
  });
});
