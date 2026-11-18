// Port of YourProject/ProjectPanel.Tasks.cs: the tasks' states – under each task in the task list (with "Mark as
// done"), or as a short list while the tasks are locked.

import { UiParts } from "@codestead/ui";
import type { PanelModel } from "./PanelModel.js";
import type { TaskRow } from "./TaskRow.js";
import { TaskState } from "./TaskState.js";
import type { Tr } from "./Tr.js";

/** The theme colour of a state's text. */
function stateColor(state: TaskState): string {
  return state === TaskState.Done ? "var(--cs-success)" : state === TaskState.NotYet ? "var(--cs-warning)" : "var(--cs-text-muted)";
}

/** A state's mark, its colour and its label. */
function look(row: TaskRow, t: Tr): { icon: string; color: string; label: string } {
  switch (row.state) {
    case TaskState.Done:
      return { icon: "✓", color: "var(--cs-success)", label: t("yourProject.done") };
    case TaskState.Locked:
      return { icon: "🔒", color: "var(--cs-text-muted)", label: t("yourProject.locked") };
    case TaskState.Checking:
      return { icon: "…", color: "var(--cs-info)", label: t("yourProject.checking") };
    case TaskState.NotYet:
      return { icon: "✗", color: "var(--cs-warning)", label: t("yourProject.notYet") };
    default:
      return { icon: "○", color: "var(--cs-text-muted)", label: t("yourProject.open") };
  }
}

export interface StatusLineProps {
  row: TaskRow;
  selected: boolean;
  t: Tr;
  /** The learner clicked the state: show the task's expected result. */
  onSelect: (index: number) => void;
  /** The learner ticked the task by hand. */
  onMarkDone: (index: number) => void;
}

/**
 * The state of one task under its text in the task list: done, not yet (why, after a check), and "Mark as done".
 * Clicking the state shows the task's expected result.
 */
export function StatusLine({ row, selected, t, onSelect, onMarkDone }: StatusLineProps) {
  const { icon, color, label } = look(row, t);
  const show = (
    <button
      type="button"
      className="flat cs-gp-status"
      data-state={row.state}
      title={t("expected.show")}
      onClick={() => onSelect(row.index)}
      style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", width: "100%", textAlign: "start", padding: "4px 6px", background: selected ? "var(--cs-surface-2)" : undefined }}
    >
      <span style={{ color, fontWeight: 700, fontSize: 12.5, marginInlineEnd: 6 }}>{icon}</span>
      <span className="cs-stack" style={{ gap: 2 }}>
        {UiParts.text(label, 12.5, selected ? 600 : 400, undefined, { color: stateColor(row.state) })}
        {row.messages.map((m, i) => (
          <span key={i}>{UiParts.text(m, 12.5, undefined, "muted")}</span>
        ))}
      </span>
    </button>
  );
  if (row.state !== TaskState.Open && row.state !== TaskState.NotYet) return show;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start" }}>
      {show}
      <button type="button" className="secondary cs-gp-mark-done" title={t("yourProject.markDoneTitle")} style={{ padding: "4px 10px", marginInlineStart: 8, fontSize: 12.5 }} onClick={() => onMarkDone(row.index)}>
        {"✓  " + t("yourProject.markDone")}
      </button>
    </div>
  );
}

/** The short list of the tasks' states while they are locked (or "no tasks"). */
export function TaskStatusList({ model: m, t, onSelect }: { model: PanelModel; t: Tr; onSelect: (index: number) => void }) {
  if (m.tasks.length === 0) return <div className="cs-stack">{UiParts.text(t("yourProject.noTasks"), 13, undefined, "muted")}</div>;
  return (
    <div className="cs-stack" style={{ gap: 2 }}>
      {UiParts.text(t("yourProject.tasks"), 14, 600)}
      {m.tasks.map((row) => {
        const selected = row.index === m.selectedTask;
        const { icon, color, label } = look(row, t);
        return (
          <button
            key={row.index}
            type="button"
            className="flat cs-gp-task-row"
            title={t("expected.show")}
            onClick={() => onSelect(row.index)}
            style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", width: "100%", textAlign: "start", padding: 6, background: selected ? "var(--cs-surface-2)" : undefined }}
          >
            <span style={{ color, fontWeight: 700, fontSize: 13, width: 22, textAlign: "center", marginInlineEnd: 8 }}>{icon}</span>
            <span className="cs-stack" style={{ gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: selected ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t("yourProject.task", { n: row.index + 1 }) + "  ·  " + row.title}
              </span>
              {UiParts.text(label, 12.5, undefined, undefined, { color: stateColor(row.state) })}
              {row.messages.map((msg, i) => (
                <span key={i}>{UiParts.text(msg, 12.5, undefined, "muted")}</span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
