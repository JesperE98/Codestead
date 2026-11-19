// @vitest-environment jsdom
import { LearningState } from "@codestead/learning";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LearningWindow, LearningWindowView, LinkOpener, MemoryStorage, Motion, ToolProfile } from "../src/index.js";
import { FakeTool } from "./FakeTool.js";

afterEach(cleanup);
beforeAll(() => {
  Motion.enabled = false;
});

const noon = new Date(2026, 10, 17, 12, 0, 0);

function open(storage = new MemoryStorage(), tool = new FakeTool()) {
  const w = new LearningWindow(tool, { storage, now: () => noon });
  const view = render(<LearningWindowView window={w} />);
  const saved = () => LearningState.fromJson(JSON.parse(storage.loadText("state")!))!;
  return { w, tool, storage, view, saved };
}

const sidebar = () => screen.getByRole("navigation");
const button = (name: string | RegExp) => screen.getByRole("button", { name });

/** The learning window with a made-up tool: what it shows and what it saves. */
describe("LearningWindowTests", () => {
  it("sidopanelen visar delarna och kapitlen, numrerade som lektioner", () => {
    const { w } = open();
    const nav = sidebar();
    expect(within(nav).getByText("PART.BASICS")).toBeTruthy();
    const rows = within(nav)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(rows.slice(0, 4)).toEqual(["1Title hello0/2", "2Title read0/1", "∑Title sum", "★Title exam"]);
    expect(within(nav).getByRole("button", { current: "page" }).textContent).toContain("Title hello");
    expect(screen.getByText("progress.short:0,3")).toBeTruthy();
    expect(screen.getByText("LESSON.CHAPTER:1,2")).toBeTruthy();
    expect(w.title).toBe("Title hello – Codestead Test");
    expect(screen.getByTestId("workbench")).toBeTruthy();
  });

  it("uppgifterna är låsta tills frågorna i texten är besvarade; svaren och XP sparas", () => {
    const { w, tool, saved } = open();
    expect(screen.getByText("🔒 gate.title")).toBeTruthy();
    expect(screen.getByText("gate.checkpoints:0,2")).toBeTruthy();
    expect(screen.queryByText("tasks.title")).toBeNull();
    // A task's command does not count while the tasks are locked.
    act(() => tool.ran("echo hi"));
    expect(w.isTaskDone("hello/t1")).toBe(false);

    fireEvent.click(screen.getAllByRole("radio")[1]!);
    fireEvent.click(button("checkpoint.check"));
    expect(screen.getByText("gate.checkpoints:1,2")).toBeTruthy();
    expect(saved().checkpoints.get("hello#0")).toBe(true);
    // The "try it" question is answered in the terminal.
    act(() => tool.ran("pwd"));
    expect(w.isChapterUnlocked("hello")).toBe(true);
    expect(screen.queryByText("🔒 gate.title")).toBeNull();
    expect(screen.getByText("tasks.title")).toBeTruthy();
    expect(screen.getByText("gate.unlocked")).toBeTruthy();
    expect(saved().checkpoints.get("hello#1")).toBe(true);
    expect(saved().game.xp).toBe(4);
    expect(saved().game.streak).toBe(1);
  });

  it("en uppgift klaras i verktygets terminal; försök låser upp lösningen; kapitlet firas", () => {
    const storage = new MemoryStorage();
    const state = new LearningState();
    state.checkpoints.set("hello#0", true);
    state.checkpoints.set("hello#1", true);
    storage.saveText("state", JSON.stringify(state));
    // The news of this version were seen already.
    storage.saveText("whatsnew", '{"seen":"0.2.0"}');
    const { w, tool, saved } = open(storage);
    expect(screen.queryByRole("dialog")).toBeNull();

    for (const b of screen.getAllByRole("button", { name: "🔒 tasks.solutionLocked:3" })) expect(b.hasAttribute("disabled")).toBe(true);
    act(() => tool.ran("echo hi"));
    expect(w.isTaskDone("hello/t1")).toBe(true);
    expect(screen.getByText("tasks.count:1,2")).toBeTruthy();
    // Every finished command line is an attempt at the tasks not done yet.
    expect(saved().attempts.get("hello/t2")).toBe(1);
    act(() => tool.ran("whoami"));
    act(() => tool.ran("date"));
    expect(saved().attempts.get("hello/t2")).toBe(3);
    fireEvent.click(screen.getAllByRole("button", { name: "👁 tasks.solution" })[1]!);
    expect(screen.getByText("tasks.solutionHelp")).toBeTruthy();
    expect(saved().game.solutionSeen).toEqual(["hello/t2"]);
    fireEvent.click(screen.getByRole("button", { name: "ls" }));
    expect(tool.injected).toEqual(["ls"]);

    act(() => tool.ran("ls"));
    expect(saved().progress.get("hello/t2")).toBe(true);
    // Solved after the solution was shown: not "without help".
    expect(saved().game.unaided).toEqual(["hello/t1"]);
    expect(screen.getByText("tasks.chapterDone")).toBeTruthy();
    expect(within(sidebar()).getAllByRole("button")[0]!.textContent).toBe("1Title hello✓");
    // The chapter is done: the celebration, with the next chapter.
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("celebrate.chapter.title")).toBeTruthy();
    expect(within(dialog).getByText("ls")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "celebrate.next:Title read" }));
    expect(w.chapter.id).toBe("read");
    expect(saved().chapter).toBe("read");
    expect(tool.shown.at(-1)).toBe("read");
    // profile.json for the hub, in every language.
    const profile = ToolProfile.load(storage)!;
    expect(profile.xp).toBe(saved().game.xp);
    expect(profile.achievements.find((a) => a.id === "first-task")?.unlockedAt).toBe("2026-11-17T12:00");
    expect(profile.levelTitle.get("sv")).toBe("level.1");
  });

  it("ett tips låser upp lösningen och sparas", () => {
    const storage = new MemoryStorage();
    const state = new LearningState();
    state.read.push("hello");
    state.checkpoints.set("hello#0", true);
    state.checkpoints.set("hello#1", true);
    storage.saveText("state", JSON.stringify(state));
    const { saved } = open(storage);
    fireEvent.click(button("💡 tasks.hint"));
    expect([...document.querySelectorAll(".cs-task .cs-markdown")].map((m) => m.textContent)).toContain("Try ls.");
    expect(button("💡 tasks.hideHint")).toBeTruthy();
    expect(saved().hintSeen).toEqual(["hello/t2"]);
    expect(screen.getAllByRole("button", { name: "👁 tasks.solution" }).length).toBe(1);
  });

  it("ett kapitel utan frågor markeras som läst", () => {
    const { w, saved } = open();
    fireEvent.click(within(sidebar()).getByRole("button", { name: /Title read/ }));
    expect(screen.getByText("gate.read")).toBeTruthy();
    fireEvent.click(button("✓ gate.readButton"));
    expect(w.isChapterUnlocked("read")).toBe(true);
    expect(saved().read).toEqual(["read"]);
    expect(screen.getByText("tasks.title")).toBeTruthy();
  });

  it("provet är låst tills lektionerna är klara, rättas vid inlämning och kan göras om", () => {
    const storage = new MemoryStorage();
    const state = new LearningState();
    state.chapter = "exam";
    storage.saveText("state", JSON.stringify(state));
    const first = open(storage);
    expect(screen.getByText("🔒 exam.locked")).toBeTruthy();
    expect(screen.getByRole("button", { name: "→ Title hello" })).toBeTruthy();
    first.view.unmount();

    for (const key of ["hello/t1", "hello/t2", "read/t1"]) state.progress.set(key, true);
    storage.saveText("state", JSON.stringify(state));
    const { saved } = open(storage);
    expect(screen.getByText("CHECKPOINT.QUESTION 1")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("radio")[0]!);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "fel" } });
    fireEvent.click(button("exam.submit"));
    expect(screen.getByText("exam.result:1,2,50")).toBeTruthy();
    expect(screen.getByText("exam.failed:80")).toBeTruthy();
    expect(saved().exams.get("basics")).toBe(50);
    expect(within(sidebar()).getByText("50 %")).toBeTruthy();

    fireEvent.click(button("↺ exam.retake"));
    fireEvent.click(screen.getAllByRole("radio")[0]!);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hej" } });
    fireEvent.click(button("exam.submit"));
    expect(screen.getByText("✓ exam.passed")).toBeTruthy();
    expect(saved().exams.get("basics")).toBe(100);
    expect(saved().game.examsPassed).toEqual(["basics"]);
    expect(saved().game.examsFailed).toEqual(["basics"]);
    expect(within(screen.getByRole("dialog")).getByText("celebrate.exam.title:100")).toBeTruthy();
  });

  it("inställningarna: språk, tema, variant och nollställning; Escape stänger", () => {
    const { w, tool, saved } = open();
    fireEvent.click(within(sidebar()).getByRole("button", { name: /settings.open/ }));
    const dialog = () => screen.getByRole("dialog");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Svenska" }));
    expect(w.lang).toBe("sv");
    expect(saved().lang).toBe("sv");
    fireEvent.click(within(dialog()).getByRole("button", { name: "theme.dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(saved().theme).toBe("dark");
    expect(within(dialog()).getByRole("button", { name: "theme.dark" }).classList.contains("active")).toBe(true);
    fireEvent.click(within(dialog()).getByRole("button", { name: "theme.system" }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(within(dialog()).getByText("Codestead Test 0.2.0")).toBeTruthy();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    // The variant picker in the top bar.
    fireEvent.change(screen.getByRole("combobox", { name: "distro.label" }), { target: { value: "two" } });
    expect(tool.variant).toBe("two");
    expect(saved().variant).toBe("two");

    w.state.progress.set("hello/t1", true);
    fireEvent.click(within(sidebar()).getByRole("button", { name: /settings.open/ }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "reset.progress.button" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "reset.progress.button" }));
    expect(saved().progress.size).toBe(0);
    expect(screen.getByText("toast.progressReset")).toBeTruthy();
  });

  it("en sparad fil från C#-appen öppnas där eleven slutade, och nyheterna visas efter en uppdatering", () => {
    const storage = new MemoryStorage();
    storage.saveText(
      "state",
      '{"lang":"de","distro":"two","chapter":"read","progress":{"hello/t1":true,"hello/t2":true},"checkpoints":{"hello#0":true,"hello#1":true},"read":[],"attempts":{},"hintSeen":[],"exams":{},"game":{"version":1,"xp":0}}',
    );
    storage.saveText("whatsnew", '{"seen":"0.1.0"}');
    const { w, tool, saved } = open(storage);
    expect(w.chapter.id).toBe("read");
    expect(w.lang).toBe("de");
    expect(tool.shown[0]).toBe("read");
    expect(within(sidebar()).getAllByRole("button")[0]!.textContent).toBe("1Title hello✓");
    // The XP its progress already earned.
    expect(saved().game.xp).toBe(10 + 10 + 2 * 2 + 25 + 5 * 0);
    // Updated from 0.1.0: the news of 0.2.0.
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("whatsnew.title:Codestead Test")).toBeTruthy();
    expect(within(dialog).getByText("new")).toBeTruthy();
    expect(within(dialog).queryByText("The first version.")).toBeNull();
    expect(storage.loadText("whatsnew")).toBe('{"seen":"0.2.0"}');
  });

  it("länkar i texten öppnas, kommandon klickas in och källorna visas", () => {
    const opened = vi.spyOn(LinkOpener, "open").mockImplementation(() => {});
    try {
      const { w, tool } = open();
      fireEvent.click(screen.getByTitle("lesson.cmdTitle"));
      expect(tool.injected).toEqual(["echo hi"]);
      fireEvent.click(screen.getByText("the docs"));
      expect(screen.getByText("↗ The manual")).toBeTruthy();
      expect(screen.getByText("Example · https://example.com/manual")).toBeTruthy();
      fireEvent.click(button(/↗ The manual/));
      expect(opened.mock.calls).toEqual([["https://example.com/docs"], ["https://example.com/manual"]]);
      fireEvent.click(button(/lesson\.next →/));
      expect(w.chapter.id).toBe("read");
    } finally {
      opened.mockRestore();
    }
  });
});
