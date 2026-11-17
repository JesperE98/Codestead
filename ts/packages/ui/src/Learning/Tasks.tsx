import { type ReactNode, useState } from "react";
import { UiParts } from "../App/UiParts.js";
import { Motion } from "../Controls/Game/Motion.js";
import { Bar } from "../Controls/Game/Views/Parts.js";
import { MarkdownView } from "../Controls/MarkdownView.js";
import { useStore } from "../Store.js";
import { LearningWindow } from "./LearningWindow.js";
import type { TaskInfo } from "./LearningTool.js";

// The tasks of a chapter: check marks, hints, the solution and the per-family chips (C#'s LearningWindow.Tasks.cs).

/**
 * The chapter's task list: header, progress, the tasks (grouped by section) and "chapter done". It is built anew
 * (open hints and solutions close) when {@link LearningWindow.tasksKey} changes.
 */
export function TaskList({ window: w }: { window: LearningWindow }) {
  useStore(w);
  const chapter = w.chapter;
  const tasks = w.tool.tasks(chapter.id, w.lang);
  const done = tasks.filter((t) => w.state.progress.has(t.key)).length;
  const items: ReactNode[] = [];
  // A tool can group the tasks (Codestead GP: the chapter's steps, then its exercises): a heading where a group starts.
  let section: string | null = null;
  tasks.forEach((task, i) => {
    const s = task.section ?? null;
    if (s !== null && s !== section) items.push(<div key={"section:" + i}>{UiParts.text(s, 14.5, 600, undefined, { margin: `${i === 0 ? 4 : 18}px 0 2px` })}</div>);
    section = s;
    items.push(<TaskItem key={`${w.tasksKey}:${task.key}`} window={w} task={task} index={i} />);
  });
  const next = w.chapterIndex < w.chapters.length - 1 ? w.chapters[w.chapterIndex + 1] : undefined;
  return (
    <div className="cs-tasks">
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "baseline" }}>
        {UiParts.text(w.t("tasks.title"), 16, 700)}
        {UiParts.text(w.t("tasks.count", { done, total: tasks.length }), 13, undefined, "muted")}
      </div>
      <Bar fraction={tasks.length === 0 ? 0 : done / tasks.length} height={4} color="CsSuccess" style={{ margin: "10px 0 6px" }} />
      {items}
      {done === tasks.length && (
        <div className="cs-tasks-done">
          {UiParts.text(w.t("tasks.chapterDone"), 15, 700)}
          {next ? (
            <button type="button" className="primary" onClick={() => w.navigate(next.id)}>
              {w.t("tasks.next", { title: w.tool.chapterTitle(next.id, w.lang) }) + " →"}
            </button>
          ) : (
            UiParts.text(w.t("tasks.allDone"))
          )}
        </div>
      )}
    </div>
  );
}

function TaskItem({ window: w, task, index }: { window: LearningWindow; task: TaskInfo; index: number }) {
  const [open, setOpen] = useState<"hint" | "solution" | null>(null);
  const tool = w.tool;
  const key = task.key;
  const done = w.state.progress.has(key);
  const fresh = w.justCompleted.includes(key);
  const attempts = w.attempts(key);
  const solutionUnlocked = w.solutionUnlocked(key);
  const status = tool.taskStatus?.(task, index);
  const pop = done && fresh ? Motion.pop() : {};

  const show = (which: "hint" | "solution" | null) => {
    if (which === "hint") w.hintShown(key);
    if (which === "solution") w.solutionShown(key);
    setOpen(which);
  };

  return (
    <div className={"cs-task" + (fresh ? " fresh" : "")} data-done={done || undefined}>
      <div className={"cs-task-check" + (done ? " done " : " ") + (pop.className ?? "")} style={pop.style} role="img" aria-label={done ? w.t("tasks.done") : w.t("tasks.notDone")}>
        {done ? "✓" : null}
      </div>
      <div className="cs-stack" style={{ gap: 6 }}>
        <MarkdownView markdown={task.text} baseFontSize={14.5} onCommandClicked={(cmd) => tool.inject(cmd)} />
        {task.chips.length > 0 && (
          <div className="cs-row" style={{ gap: 6 }} title={w.t("tasks.perFamily")}>
            {task.chips.map((f) => {
              const fDone = w.state.progress.has(f.key);
              return (
                <span key={f.key} className={"cs-task-chip" + (fDone ? " done" : "") + (f.current ? " current" : "")}>
                  {(fDone ? "✓ " : "") + f.label}
                </span>
              );
            })}
          </div>
        )}
        {status}
        <div className="cs-row" style={{ gap: 8 }}>
          {task.hint !== null && (
            <button type="button" className={"chip" + (open === "hint" ? " active" : "")} onClick={() => show(open === "hint" ? null : "hint")}>
              {"💡 " + (open === "hint" ? w.t("tasks.hideHint") : w.t("tasks.hint"))}
            </button>
          )}
          <button
            type="button"
            className={"chip" + (open === "solution" ? " active" : "")}
            disabled={!solutionUnlocked}
            onClick={() => {
              // A tool can show the solution in a window of its own; it counts as seen all the same.
              if (w.openSolutionWindow(task, index)) return;
              show(open === "solution" ? null : "solution");
            }}
          >
            {solutionUnlocked
              ? "👁 " + (open === "solution" ? w.t("tasks.hideSolution") : w.t("tasks.solution"))
              : "🔒 " + w.t("tasks.solutionLocked", { n: LearningWindow.AttemptsBeforeSolution - attempts })}
          </button>
        </div>
        <div className="cs-stack" style={{ gap: 6 }}>
          {open === "hint" && task.hint !== null && <MarkdownView markdown={task.hint} baseFontSize={13.5} onCommandClicked={(cmd) => tool.inject(cmd)} />}
          {open === "solution" && (
            <>
              {UiParts.text(w.t("tasks.solutionHelp"), 12.5, undefined, "muted")}
              <div className="cs-wrap" dir="ltr">
                {task.solution.map((cmd, i) => (
                  <button key={i} type="button" className="solution" style={{ margin: "0 6px 6px 0" }} title={w.t("lesson.cmdTitle")} onClick={() => tool.inject(cmd)}>
                    {cmd}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
