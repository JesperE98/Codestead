// A tool for the course writers, not a test: it runs only when CODESTEAD_TERMINAL_PICTURES names a folder, and is
// skipped otherwise. src/Linux/content/images/diagrams/make.mjs starts it; see "Bilder i Codestead Linux" in
// docs/DEVELOPMENT.md. Runs the commands that the chapters' terminal pictures show in the simulator, so that a picture
// shows what the learner really sees: the folder's requests.json lists them, each a fresh computer (a distribution, the
// world of a language) with some commands run first without being shown (`setup`) and then the shown ones. Every
// request becomes <folder>/<key>.json: for every shown command its prompt, the typed line and the output, split into
// coloured runs as the app's terminal shows them (the ANSI palette of @codestead/linux-shell). The clock stands still
// at the request's `time` (default 2026-10-28 09:30 UTC, the day of the practice log), so the pictures do not change
// from one day to the next.
//   CODESTEAD_TERMINAL_PICTURES=<folder> npx vitest run packages/linux-shell/test/TerminalPictures.test.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, it, vi } from "vitest";
import { Ansi, Shell } from "../src/index.js";

const output = process.env["CODESTEAD_TERMINAL_PICTURES"] ?? "";

interface TerminalRequest {
  /** The file the result goes to (make.mjs names it after the request and a hash of it). */
  key: string;
  /** The language of the learner's world: user, file names and the practice files' contents. */
  lang: string;
  /** "ubuntu" when left out. */
  distro?: string;
  /** Commands run first and not shown ({{placeholders}} of the world are filled in). */
  setup?: string[];
  /** The commands shown, in order. */
  commands: string[];
  /** The time the clock shows (ISO 8601). */
  time?: string;
}

/** A run of text in one colour. `color` null is the terminal's text colour. */
interface Run {
  text: string;
  color: string | null;
  background?: string;
  bold?: boolean;
  opacity?: number;
}

function runs(text: string): Run[] {
  return Ansi.parse(text).map((s) => {
    let color: string | null = null;
    if (s.fg !== 0) color = s.bg === 42 && s.fg === 30 ? Ansi.blackOnGreen : Ansi.foreground.get(s.fg >= 90 ? s.fg - 60 : s.fg)!;
    const run: Run = { text: s.text, color };
    const bg = s.bg !== 0 ? Ansi.background.get(s.bg) : undefined;
    if (bg !== undefined) run.background = bg;
    if (s.bold) run.bold = true;
    if (s.dim) run.opacity = Ansi.dimOpacity;
    return run;
  });
}

/** Text with colour codes as lines of runs (a colour goes on over a line break, as in the terminal). */
function lines(text: string): Run[][] {
  const result: Run[][] = [[]];
  for (const run of runs(text.replace(/\n$/, "")))
    run.text.split("\n").forEach((part, i) => {
      if (i > 0) result.push([]);
      if (part !== "") result[result.length - 1]!.push({ ...run, text: part });
    });
  return text === "" ? [] : result;
}

describe.skipIf(output === "")("TerminalPictures", () => {
  afterAll(() => {
    vi.useRealTimers();
  });

  it("kör kommandona till kapitlens terminalbilder", () => {
    const requests = JSON.parse(readFileSync(join(output, "requests.json"), "utf8")) as TerminalRequest[];
    for (const r of requests) {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(r.time ?? "2026-10-28T09:30:00Z"));
      const sh = Shell.create(r.distro ?? "ubuntu", r.lang);
      // The simulator's own hint lines in the picture's language (Shell.lang is the UI language, Swedish by default).
      sh.lang = r.lang;
      for (const line of r.setup ?? []) sh.execute(sh.world.expand(line));
      const shown = r.commands.map((command) => {
        const typed = sh.world.expand(command);
        const prompt = runs(sh.prompt());
        const result = sh.execute(typed);
        return { prompt, typed, output: lines(result.output), exitCode: result.exitCode };
      });
      writeFileSync(join(output, `${r.key}.json`), JSON.stringify({ lines: shown }, null, 1));
      vi.useRealTimers();
    }
  });
});
