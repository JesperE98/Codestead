// Port of Codestead.Terminal/TerminalView.cs – the simulated terminal. The C# Avalonia control is here an object with
// the same members (Shell, Inject, FocusInput, InputLabel, CommandExecuted) that holds what the terminal shows, and
// a React component, <Terminal view={…} />, that draws it and passes the keys on.

import type { ExecResult, Shell } from "@codestead/linux-shell";
import { Store, useStore } from "@codestead/ui";
import { type KeyboardEvent, useLayoutEffect, useRef } from "react";
import { ansiRuns, TermText } from "./AnsiText.js";

/** A line of the screen: a command line as typed after its prompt, or what a command printed. */
export type TerminalEntry = { id: number; kind: "line"; prompt: string; typed: string } | { id: number; kind: "output"; text: string };

/** The keys the terminal handles (a DOM key event, reduced). */
export interface TerminalKey {
  /** KeyboardEvent.key. */
  key: string;
  /** KeyboardEvent.code: Ctrl+C and Ctrl+L also work where the key gives another letter (e.g. a Cyrillic layout). */
  code?: string;
  ctrl: boolean;
  /** Text is selected in the input (Ctrl+C then copies). */
  inputHasSelection?: boolean;
}

/**
 * The simulated terminal: shows output with ANSI colours and an input line with the prompt.
 * Supports history (↑/↓), Tab completion, Ctrl+C (cancel), Ctrl+L (clear) and hidden password input.
 */
export class TerminalView extends Store {
  static readonly MaxEntries = 400;

  private shellValue: Shell | null = null;
  private historyIndex: number | null = null;
  private draft = "";
  private nextId = 0;
  private readonly executed = new Set<(result: ExecResult) => void>();

  /** The screen above the input line, oldest first (at most {@link MaxEntries}). */
  entries: TerminalEntry[] = [];
  /** The text on the command line. */
  input = "";
  /** Label for screen readers. */
  private label = "";
  /** Bumped when the caret should go to the end of the input (after Inject, history, completion). */
  caretToEnd = 0;
  /** Bumped when the screen should scroll to the end (after output). */
  scrollToEnd = 0;
  /** The input element on screen, set by the component (focus). */
  inputElement: HTMLInputElement | null = null;

  /** Fired after every executed command line (C#'s event CommandExecuted); returns what stops listening. */
  onCommandExecuted(listener: (result: ExecResult) => void): () => void {
    this.executed.add(listener);
    return () => this.executed.delete(listener);
  }

  /** Label for screen readers. */
  get inputLabel(): string {
    return this.label;
  }

  set inputLabel(value: string) {
    this.label = value;
    this.changed();
  }

  /** The shell this terminal runs. Setting it clears the screen and shows the welcome text. */
  get shell(): Shell | null {
    return this.shellValue;
  }

  set shell(value: Shell | null) {
    this.shellValue = value;
    this.entries = [];
    this.historyIndex = null;
    this.input = "";
    if (value !== null) this.addOutput(null, null, value.welcome());
    this.changed();
  }

  /** The prompt in front of the input (with ANSI colours); "" without a shell. */
  get prompt(): string {
    return this.shellValue?.prompt() ?? "";
  }

  /** Passwords (e.g. for passwd and su) are not shown while typing – just like a real terminal. */
  get secret(): boolean {
    return this.shellValue?.pendingQuestion?.secret === true;
  }

  /** Puts text on the command line (e.g. after clicking a command in the lesson). */
  inject(text: string): void {
    this.setText(text);
    this.focusInput();
  }

  focusInput(): void {
    this.inputElement?.focus();
  }

  /** The learner typed (the input's change event). */
  setInput(text: string): void {
    this.input = text;
    this.changed();
  }

  /** Sets the input and puts the caret at its end. */
  private setText(text: string): void {
    this.input = text;
    this.caretToEnd++;
    this.changed();
  }

  /** Clears the screen (Ctrl+L, `clear`). */
  clear(): void {
    this.entries = [];
    this.changed();
  }

  private addOutput(prompt: string | null, typed: string | null, output: string): void {
    if (prompt !== null) this.entries.push({ id: this.nextId++, kind: "line", prompt, typed: typed ?? "" });
    if (output !== "") this.entries.push({ id: this.nextId++, kind: "output", text: output.endsWith("\n") ? output.slice(0, -1) : output });
    if (this.entries.length > TerminalView.MaxEntries) this.entries = this.entries.slice(this.entries.length - TerminalView.MaxEntries);
    this.scrollToEnd++;
    this.changed();
  }

  /** Runs the command line (Enter). */
  run(): void {
    const shell = this.shellValue;
    if (shell === null) return;
    const line = this.input;
    const shownPrompt = shell.prompt();
    const secret = shell.pendingQuestion?.secret === true;
    const result = shell.execute(line);
    this.historyIndex = null;
    this.input = "";
    if (result.clear) this.clear();
    else this.addOutput(shownPrompt, secret ? "" : line, result.output);
    this.changed();
    for (const l of [...this.executed]) l(result);
  }

  private browseHistory(dir: -1 | 1): void {
    const shell = this.shellValue;
    if (shell === null) return;
    const h = shell.history;
    if (h.length === 0) return;
    if (this.historyIndex === null) {
      if (dir === 1) return;
      this.draft = this.input;
      this.historyIndex = h.length;
    }
    const next = this.historyIndex + dir;
    if (next < 0) return;
    if (next >= h.length) {
      this.historyIndex = null;
      this.setText(this.draft);
    } else {
      this.historyIndex = next;
      this.setText(h[next]!);
    }
  }

  /** Tab: completes the command or file name; several candidates are listed under the line. */
  private complete(): void {
    const shell = this.shellValue!;
    const prompt = shell.prompt();
    const before = this.input;
    const { line, options } = shell.complete(before);
    this.setText(line);
    if (options.length > 0) this.addOutput(prompt, before, options.join("  ") + "\n");
  }

  /** Ctrl+C: cancels the line (and a question or an unfinished command). */
  private cancel(): void {
    const shell = this.shellValue!;
    const prompt = shell.prompt();
    const secret = shell.pendingQuestion?.secret === true;
    shell.cancel();
    this.addOutput(prompt, (secret ? "" : this.input) + "^C", "");
    this.input = "";
    this.historyIndex = null;
    this.changed();
  }

  /** A key in the input. Returns true when the terminal handled it (the default action is then prevented). */
  keyDown(e: TerminalKey): boolean {
    const shell = this.shellValue;
    if (shell === null) return false;
    let key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.ctrl && (e.code === "KeyC" || e.code === "KeyL")) key = e.code === "KeyC" ? "c" : "l";
    if (key === "Enter") {
      this.run();
      return true;
    }
    if (key === "ArrowUp" && shell.pendingQuestion === null) {
      this.browseHistory(-1);
      return true;
    }
    if (key === "ArrowDown" && shell.pendingQuestion === null) {
      this.browseHistory(1);
      return true;
    }
    if (key === "Tab") {
      if (shell.pendingQuestion === null) this.complete();
      return true;
    }
    if (key === "c" && e.ctrl) {
      // Let Ctrl+C copy when text is selected.
      if (e.inputHasSelection === true) return false;
      this.cancel();
      return true;
    }
    if (key === "l" && e.ctrl) {
      this.clear();
      return true;
    }
    return false;
  }
}

/** Text selected on the page (outside the input), e.g. in the terminal's output. */
function pageSelection(): string {
  return globalThis.getSelection?.()?.toString() ?? "";
}

const mono = "var(--cs-mono-font)";

/** Draws a {@link TerminalView}. */
export function Terminal({ view }: { view: TerminalView }) {
  useStore(view);
  const scroll = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const el = input.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  }, [view.caretToEnd]);

  useLayoutEffect(() => {
    const el = scroll.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [view.scrollToEnd]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const inputHasSelection = (el.selectionStart ?? 0) !== (el.selectionEnd ?? 0) || pageSelection() !== "";
    if (view.keyDown({ key: e.key, code: e.code, ctrl: e.ctrlKey, inputHasSelection })) e.preventDefault();
  };

  // Clicking the terminal focuses the input – unless the user is selecting text.
  const onPointerUp = () => {
    if (pageSelection() !== "") return;
    view.focusInput();
  };

  const secret = view.secret;
  return (
    <div className="cs-terminal" dir="ltr" onPointerUp={onPointerUp} style={{ background: "#0f1318", display: "flex", minHeight: 0, height: "100%" }}>
      <div ref={scroll} style={{ overflowX: "hidden", overflowY: "auto", flex: "1 1 auto", minHeight: 0 }}>
        <div style={{ margin: "10px 14px 14px 14px", fontFamily: mono, fontSize: 14, color: TermText, lineHeight: 1.35 }}>
          <div role="log" aria-live="polite">
            {view.entries.map((entry) =>
              entry.kind === "line" ? (
                <div key={entry.id} className="cs-terminal-line" style={blockStyle}>
                  {ansiRuns(entry.prompt)}
                  <span style={{ color: TermText }}>{entry.typed}</span>
                </div>
              ) : (
                <div key={entry.id} className="cs-terminal-output" style={blockStyle}>
                  {ansiRuns(entry.text)}
                </div>
              ),
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span className="cs-terminal-prompt" style={{ whiteSpace: "pre", flex: "0 0 auto" }}>
              {ansiRuns(view.prompt)}
            </span>
            <input
              ref={(el) => {
                input.current = el;
                view.inputElement = el;
              }}
              className="terminal-input"
              value={view.input}
              onChange={(e) => view.setInput(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label={view.inputLabel}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              style={{
                flex: "1 1 auto",
                minWidth: 0,
                font: "inherit",
                // The input looks like plain text; a password is not shown (the caret still is).
                color: secret ? "transparent" : TermText,
                caretColor: TermText,
                background: "transparent",
                border: 0,
                padding: 0,
                margin: 0,
                outline: "none",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const blockStyle = { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } as const;
