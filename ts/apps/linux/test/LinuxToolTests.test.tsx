// In the node environment with a DOM of its own (see withDom.ts): it reads the course texts.
// The Linux tool in the shared learning window (LinuxTool.cs and LinuxTool.Terminal.cs; the C# app project has no
// tests of its own): the course, the distributions as variants, the terminal per distribution and its saved state.

import "./withDom.js";
import { Languages } from "@codestead/common";
import { LearningState } from "@codestead/learning";
import { ChaptersLib, I18nLib } from "@codestead/linux-content";
import { Shell } from "@codestead/linux-shell";
import { LearningWindow, LearningWindowView, MemoryStorage, Motion } from "@codestead/ui";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { LinuxTool } from "../src/LinuxTool.js";
import { ProductInfo } from "../src/ProductInfo.js";

afterEach(cleanup);
beforeAll(() => {
  Motion.enabled = false;
});

const noon = new Date(2026, 10, 17, 12, 0, 0);

/** A window with the Linux tool (in English unless the storage says otherwise). */
function open(storage = new MemoryStorage(), lang: string | null = "en") {
  if (lang !== null && storage.loadText("state") === null) storage.saveText("state", JSON.stringify({ lang }));
  const tool = new LinuxTool();
  const w = new LearningWindow(tool, { storage, now: () => noon, smokeTest: true });
  const shell = () => tool.terminal.shell!;
  /** Types a line in the terminal and presses Enter. */
  const type = (line: string) =>
    act(() => {
      tool.terminal.setInput(line);
      tool.terminal.run();
    });
  return { tool, w, storage, shell, type };
}

/** Marks a chapter's text as worked through (its tasks unlock). */
function unlock(w: LearningWindow, chapterId: string): void {
  const chapter = w.chapters.find((c) => c.id === chapterId)!;
  for (let i = 0; i < w.checkpointCount(chapter); i++) w.state.checkpoints.set(LearningWindow.checkpointKey(chapter, i), true);
  w.state.read.push(chapterId);
}

describe("LinuxToolTests", () => {
  it("produkten kommer från packaging/products.json", () => {
    expect(ProductInfo.meta).toEqual({ name: "Codestead Linux", id: "codestead-linux", releasesRepo: "JesperE98/codestead-releases", version: "0.6.0" });
    const { tool } = open();
    expect(tool.product).toBe(ProductInfo.meta);
    expect(tool.changelog[0]!.version).toMatch(/^0\.\d+\.\d+$/);
  });

  it("kursen: delarna, kapitlen, texterna och uppgifterna", () => {
    const { tool } = open();
    expect(tool.parts).toEqual(ChaptersLib.parts.map((p) => p.id));
    expect(tool.chapters.map((c) => c.id)).toEqual(ChaptersLib.chapters.map((c) => c.id));
    expect(tool.chapters[0]!.id).toBe("valkommen");
    expect(tool.chapterTitle("valkommen", "en")).toBe(I18nLib.chapterTitle(ChaptersLib.chapters[0]!, "en"));
    expect(tool.lessonText("valkommen", "en")).toContain("# Welcome to the Linux shell");
    // The placeholders are filled in for the chapter's distribution.
    expect(tool.lessonText("valkommen", "en")).not.toContain("{{user}}");
    const tasks = tool.tasks("valkommen", "en");
    expect(tasks.map((t) => t.key)).toEqual(["valkommen/echo", "valkommen/whoami", "valkommen/os-release", "valkommen/help"]);
    expect(tool.taskKeys("valkommen")).toEqual(tasks.map((t) => t.key));
    expect(tasks[1]!.solution).toEqual(["whoami"]);
    expect(tool.progressTitle(3, 10)).toBe("3 of 10 tasks done in the Debian family");
  });

  it("distributionerna är varianter: bara i distro-kapitlen, grupperade per familj", () => {
    const { tool } = open();
    expect(tool.variants("valkommen")).toEqual([{ label: "Debian family", options: [{ id: "ubuntu", name: expect.any(String) as string }] }]);
    expect(tool.variants("distributioner").map((g) => g.label)).toEqual(["Debian family", "Arch family", "Red Hat family"]);
    expect(tool.variants("distributioner").flatMap((g) => g.options.map((o) => o.id))).toEqual(["ubuntu", "debian", "arch", "fedora"]);
    expect(tool.allVariants.map((v) => v.id)).toEqual(["ubuntu", "debian", "arch", "fedora"]);
    expect(tool.normalizeVariant(null)).toBe("ubuntu");
    expect(tool.normalizeVariant("arch")).toBe("arch");
    expect(tool.normalizeVariant("okänd")).toBe("ubuntu");
  });

  it("terminalen byter till kapitlets distribution och tillbaka", () => {
    const { tool, w, shell } = open();
    expect(shell().distro.id).toBe("ubuntu");
    act(() => w.changeVariant("fedora"));
    // Outside the distro chapters the terminal stays Ubuntu.
    expect(shell().distro.id).toBe("ubuntu");
    act(() => w.navigate("distributioner"));
    expect(shell().distro.id).toBe("fedora");
    expect(tool.currentVariant("distributioner")).toBe("fedora");
    act(() => w.navigate("familj-arch"));
    expect(shell().distro.id).toBe("arch");
    act(() => w.navigate("valkommen"));
    expect(shell().distro.id).toBe("ubuntu");
  });

  it("terminalen sparas per distribution i samma filer som C#-appen och kommer tillbaka vid nästa start", () => {
    const storage = new MemoryStorage();
    const first = open(storage);
    first.type("touch spår.txt");
    expect(storage.loadText("shell.ubuntu")).toBe(first.shell().snapshotJson());
    first.w.close();
    const second = open(storage);
    expect(second.shell().vfs).not.toBe(first.shell().vfs);
    second.type("ls");
    expect(second.tool.terminal.entries.at(-1)).toMatchObject({ kind: "output", text: expect.stringContaining("spår.txt") as string });
    // A saved C# terminal (the same JSON) is read the same way.
    expect(Shell.restoreJson(storage.loadText("shell.ubuntu"))).not.toBeNull();
  });

  it("en uppgift bockas av först när kapitlet är upplåst, och XP räknas", () => {
    const { w, type } = open();
    type("whoami");
    expect(w.isTaskDone("valkommen/whoami")).toBe(false);
    unlock(w, "valkommen");
    type("whoami");
    expect(w.isTaskDone("valkommen/whoami")).toBe(true);
    expect(w.state.game.xp).toBeGreaterThan(0);
    expect(w.state.game.achievements.has("first-task")).toBe(true);
    // The window's own run (the smoke test) goes through the same check.
    act(() => w.tool.run("help"));
    expect(w.isTaskDone("valkommen/help")).toBe(true);
  });

  it("ett klickat kommando hamnar på kommandoraden", () => {
    const { tool } = open();
    tool.inject("ls -l");
    expect(tool.terminal.input).toBe("ls -l");
  });

  it("språkbytet översätter övningsfilerna och användaren", () => {
    const { w, shell } = open();
    expect(shell().world.lang).toBe("en");
    act(() => w.changeLanguage("sv"));
    expect(shell().world.lang).toBe("sv");
    expect(shell().lang).toBe("sv");
  });

  it("flyttade uppgifter följer med i sparad progress", () => {
    const storage = new MemoryStorage();
    storage.saveText("state", JSON.stringify({ lang: "en", progress: { "textbearbetning/tr-upper": true } }));
    const { w } = open(storage);
    expect(w.isTaskDone("pipes/tr-upper")).toBe(true);
    expect(LearningState.fromJson(JSON.parse(storage.loadText("state")!))!.progress.has("textbearbetning/tr-upper")).toBe(false);
  });

  it("fönstret visar terminalen med titelrad, och Återställ ger en ny dator", () => {
    const { w, shell, type, storage } = open();
    render(<LearningWindowView window={w} />);
    const user = shell().currentUser().name;
    expect(screen.getByText(`${user}@ubuntu — ${shell().distro.name}`)).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Command line" })).toBeTruthy();
    type("touch borta.txt");
    expect(storage.loadText("shell.ubuntu")).toContain("borta.txt");
    const before = shell();
    act(() => void fireEvent.click(screen.getByTitle("Reset the terminal: remove files and packages you have added")));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Reset the terminal in Ubuntu/)).toBeTruthy();
    act(() => void fireEvent.click(within(dialog).getByRole("button", { name: "Reset terminal" })));
    expect(shell()).not.toBe(before);
    expect(storage.loadText("shell.ubuntu")).toBeNull();
    type("ls");
    expect(w.tool instanceof LinuxTool && w.tool.terminal.entries.map((e) => (e.kind === "output" ? e.text : "")).join("\n")).not.toContain("borta.txt");
    expect(screen.getByText("The terminal has been reset.")).toBeTruthy();
  });

  it("varje kapitel visas i varje språk utan fel", () => {
    const { tool, w } = open();
    render(<LearningWindowView window={w} />);
    for (const l of Languages.offered) {
      act(() => w.changeLanguage(l.code));
      for (const ch of w.chapters.slice(0, 6)) act(() => w.navigate(ch.id));
      expect(tool.terminal.inputLabel).toBe(tool.translate(l.code, "terminal.input"));
    }
  });
});
