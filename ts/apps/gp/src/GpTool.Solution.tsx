// Port of GpTool.Solution.cs: a task's solution opens in a window of its own – the course's code for the task, file
// by file, to compare with the learner's own; nothing is written into their files.

import type { CourseTask } from "@codestead/gp-course";
import { UiParts } from "@codestead/ui";
import type { Tr } from "./YourProject/Tr.js";

/** The code without the indentation all its lines share (it comes from inside a function). */
export function dedent(code: string): string {
  const lines = code.replaceAll("\r\n", "\n").replace(/\n+$/, "").split("\n");
  const indents = lines.filter((l) => l.trim().length > 0).map((l) => l.length - l.replace(/^[ \t]+/, "").length);
  const indent = indents.length === 0 ? 0 : Math.min(...indents);
  return lines.map((l) => (l.length >= indent ? l.slice(indent) : l.trimStart())).join("\n");
}

export interface SolutionViewProps {
  task: CourseTask;
  /** The task's place among the chapter's tasks (steps first, then exercises). */
  index: number;
  /** How many of the chapter's tasks are steps. */
  steps: number;
  t: Tr;
  copy: (code: string) => void;
  close: () => void;
}

/** The solution window's content (the overlay gives it its ✕; Escape closes it too). */
export function SolutionView({ task, index, steps, t, copy, close }: SolutionViewProps) {
  return (
    <div className="cs-stack cs-gp-solution" style={{ gap: 10 }}>
      {UiParts.text(index < steps ? t("yourProject.solutionTitle", { n: index + 1 }) : t("yourProject.solutionExercise", { n: index - steps + 1 }), 18, 700)}
      {UiParts.text(t(task.edits.length > 0 ? "yourProject.solutionHelp" : "yourProject.buildRunSolution"), 13, undefined, "muted")}
      {task.edits.map((edit, i) => {
        const code = dedent(edit.replace);
        return (
          <div key={i} className="cs-stack" style={{ gap: 6, marginTop: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--cs-mono-font)", fontSize: 13, fontWeight: 600 }}>{edit.file}</span>
              <button type="button" className="secondary" style={{ padding: "3px 10px", fontSize: 12.5 }} onClick={() => copy(code)}>
                {t("yourProject.copyCode")}
              </button>
            </div>
            <div className="cs-gp-solution-code" dir="ltr">
              <pre>{code.replace(/\n+$/, "")}</pre>
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button type="button" className="primary" onClick={close}>
          {t("yourProject.close")}
        </button>
      </div>
    </div>
  );
}
