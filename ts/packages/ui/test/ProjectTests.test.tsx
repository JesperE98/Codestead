// @vitest-environment jsdom
import { ChapterKinds, CommonAchievements, CourseChapter, CourseOutline, GameRules, LearningState, OutlinePart, XpRules } from "@codestead/learning";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { LearningWindow, LearningWindowView, MemoryStorage, Motion, type SandboxRun, type TaskInfo } from "../src/index.js";
import { FakeTool } from "./FakeTool.js";

afterEach(cleanup);
beforeAll(() => {
  Motion.enabled = false;
});

const noon = new Date(2026, 10, 25, 12, 0, 0);

const milestones = [
  { key: "basics-project/m1", solution: "mkdir case" },
  { key: "basics-project/m2", solution: "cp log case/" },
];

/** The made-up tool with an optional project after the exam ("<part>-project", as in the apps). */
class ProjectTool extends FakeTool {
  override readonly chapters = [...new FakeTool().chapters, new CourseChapter("basics-project", "basics", ChapterKinds.Project)];
  override readonly rules = new GameRules(new CourseOutline([new OutlinePart("basics", ["hello", "read"], true, true)]), [
    CommonAchievements.firstTask,
    CommonAchievements.examFirst,
    CommonAchievements.projectFirst,
    CommonAchievements.projectAll,
    CommonAchievements.projectUnaided,
  ]);

  override rawText(chapterId: string): string {
    return chapterId === "basics-project" ? "# Project\n\nSolve the case." : super.rawText(chapterId);
  }

  override lessonText(chapterId: string): string {
    return this.rawText(chapterId);
  }

  override taskKeys(chapterId: string): readonly string[] {
    return chapterId === "basics-project" ? milestones.map((m) => m.key) : super.taskKeys(chapterId);
  }

  override tasks(chapterId: string): readonly TaskInfo[] {
    if (chapterId !== "basics-project") return super.tasks(chapterId);
    return milestones.map((m) => ({ key: m.key, text: `Milestone ${m.key}`, hint: "A hint.", solution: [m.solution], chips: [] }));
  }

  override evaluate(chapterId: string, run: SandboxRun, completed: ReadonlyMap<string, boolean>): readonly string[] {
    if (chapterId !== "basics-project") return super.evaluate(chapterId, run, completed);
    return milestones.filter((m) => m.solution === run.line.trim() && !completed.has(m.key)).map((m) => m.key);
  }
}

function open(state?: (s: LearningState) => void) {
  const storage = new MemoryStorage();
  if (state) {
    const s = new LearningState();
    state(s);
    storage.saveText("state", JSON.stringify(s));
  }
  const tool = new ProjectTool();
  const w = new LearningWindow(tool, { storage, now: () => noon });
  render(<LearningWindowView window={w} />);
  return { w, tool };
}

const sidebar = () => screen.getByRole("navigation");

describe("ProjectTests", () => {
  it("projektet kommer efter provet, är låst tills provet är klart och räknas inte i kursens framsteg", () => {
    const { w, tool } = open();
    const rows = within(sidebar())
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(rows.slice(0, 5)).toEqual(["1Title hello0/2", "2Title read0/1", "∑Title sum", "★Title exam", "◆Title basics-project"]);
    // The milestones are not in the total: 3 tasks, as without the project.
    expect(screen.getByText("progress.short:0,3")).toBeTruthy();

    act(() => w.navigate("basics-project"));
    expect(screen.getByText("PART.BASICS · PROJECT.LABEL")).toBeTruthy();
    expect(screen.getByText(/^🔒\s+project\.locked$/u)).toBeTruthy();
    expect(screen.getByText("project.optional")).toBeTruthy();
    expect(screen.getByRole("button", { name: "→ Title exam" })).toBeTruthy();
    expect(screen.queryByText("tasks.title")).toBeNull();
    // A milestone's command does not count while the project is locked.
    act(() => tool.ran("mkdir case"));
    expect(w.isTaskDone("basics-project/m1")).toBe(false);
  });

  it("ett godkänt prov öppnar projektet; klara delmål ger XP, ett klart projekt ger bonus och utmärkelser", () => {
    // A new learner (no "What's new" dialog) who passed the exam.
    const { w, tool } = open();
    act(() => {
      w.state.exams.set("basics", 85);
      w.refreshGame();
      w.navigate("basics-project");
    });
    const project = w.chapters.find((c) => c.id === "basics-project")!;
    expect(w.isProjectOpen(project)).toBe(true);
    expect(screen.getByText(/^🛠️\s+project\.optional$/u)).toBeTruthy();
    expect(screen.getByText("tasks.title")).toBeTruthy();
    expect(screen.getByTestId("workbench")).toBeTruthy();
    expect(within(sidebar()).getByRole("button", { current: "page" }).textContent).toBe("◆Title basics-project0/2");

    const xpBefore = w.state.game.xp;
    act(() => tool.ran("mkdir case"));
    expect(w.isTaskDone("basics-project/m1")).toBe(true);
    expect(w.state.game.xp - xpBefore).toBe(XpRules.Task + XpRules.Unaided);
    expect(w.isProjectComplete(project)).toBe(false);
    expect(screen.getByText("progress.short:0,3")).toBeTruthy();

    act(() => tool.ran("cp log case/"));
    expect(w.isProjectComplete(project)).toBe(true);
    expect(w.state.game.completedProjects).toEqual(["basics"]);
    expect(w.state.game.xp - xpBefore).toBe(2 * (XpRules.Task + XpRules.Unaided) + XpRules.Project);
    for (const id of ["project-first", "project-all", "project-unaided"]) expect(w.state.game.achievements.has(id), id).toBe(true);
    expect(screen.getByText(/^✓\s+project\.complete$/u)).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText("celebrate.project.title")).toBeTruthy();
    expect(within(sidebar()).getByRole("button", { current: "page" }).textContent).toBe("◆Title basics-project✓");
    // Still 3 tasks in the course: the project stays optional.
    expect(w.totalProgress()).toEqual({ done: 0, total: 3 });
  });

  it("ett projekt med ett klart delmål förblir öppet, och den sparade filen har med projektet", () => {
    const { w } = open((s) => {
      s.progress.set("basics-project/m1", true);
    });
    const project = w.chapters.find((c) => c.id === "basics-project")!;
    expect(w.isProjectOpen(project)).toBe(true);
    w.state.game.completedProjects.push("basics");
    const json = JSON.parse(JSON.stringify(w.state)) as { game: { completedProjects?: string[] } };
    expect(json.game.completedProjects).toEqual(["basics"]);
    expect(LearningState.fromJson(json)!.game.completedProjects).toEqual(["basics"]);
  });
});
