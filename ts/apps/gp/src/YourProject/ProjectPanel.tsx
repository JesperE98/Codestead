// Port of YourProject/ProjectPanel.cs.

import { UiParts } from "@codestead/ui";
import type { ReactNode } from "react";
import { type DrawFn, ExpectedPicture } from "./ExpectedPicture.js";
import type { PanelModel } from "./PanelModel.js";
import { TaskStatusList } from "./ProjectPanel.Tasks.js";
import type { Tr } from "./Tr.js";

/** What the learner can do in the panel (C#'s events of ProjectPanel). */
export interface ProjectPanelEvents {
  check(): void;
  changeFile(): void;
  save(): void;
  saveOld(): void;
  /** The learner clicked a task in the list: show its expected result. */
  taskSelected(index: number): void;
  /** The expected result was clicked: show it larger. */
  enlarge(panel: ReactNode): void;
}

export interface ProjectPanelProps {
  model: PanelModel;
  t: Tr;
  events: ProjectPanelEvents;
  /** The window's task list, shown in the panel once the tasks are unlocked (else the short status list). */
  hostedTasks: ReactNode | null;
  draw: DrawFn;
}

function Note({ children, background }: { children: ReactNode; background: string }) {
  return <div style={{ padding: "8px 12px", borderRadius: 6, background, display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>;
}

/**
 * "Your project": the learner writes, builds and runs the chapter's code in their own IDE, organised as they like. The
 * panel ticks tasks by hand ("Mark as done" under each task), checks the code when asked ("Check my code" reads the
 * chapter's main file, which the learner picks, and the files around it), saves the course's own textures, models
 * and fonts into a folder (never code: the learner writes all of it), and shows the picture of what the current
 * task's result should look like.
 */
export function ProjectPanel({ model: m, t, events, hostedTasks, draw }: ProjectPanelProps) {
  return (
    <div className="card cs-gp-project">
      <div className="cs-gp-project-content">
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center" }}>
          {UiParts.text(t("yourProject.title"), 16, 700)}
          {UiParts.text(m.apiName, 12.5, 600, "muted")}
        </div>
        {UiParts.text(t("yourProject.intro"), 13, undefined, "muted")}

        {m.mainFile !== null && (
          <>
            <div className="cs-gp-main-file" title={t("yourProject.fileTitle")} dir="ltr">
              {m.mainFile}
            </div>
            {m.fileMissing && <Note background="var(--cs-warning-soft)">{UiParts.text(t("yourProject.fileMissing"), 13)}</Note>}
          </>
        )}
        <Buttons model={m} t={t} events={events} />
        {(m.checkSummary !== null || m.checkMessages.length > 0) && (
          <div className="cs-gp-check-result" data-all-passed={m.allPassed || undefined}>
            <Note background={m.allPassed ? "var(--cs-success-soft)" : "var(--cs-surface-2)"}>
              {m.checkSummary !== null && UiParts.text(m.checkSummary, 13.5)}
              {m.checkMessages.map((message, i) => (
                <span key={i}>{UiParts.text(message, 12.5, undefined, "muted")}</span>
              ))}
            </Note>
          </div>
        )}
        {m.hasOldCode && (
          <Note background="var(--cs-info-soft)">
            {UiParts.text(t("yourProject.oldCode"), 13)}
            <div>
              <button type="button" className="secondary" style={{ marginTop: 2 }} onClick={() => events.saveOld()}>
                {t("yourProject.copyOld")}
              </button>
            </div>
          </Note>
        )}
        {hostedTasks !== null ? (
          <div className="cs-gp-hosted-tasks">{hostedTasks}</div>
        ) : (
          <>
            {m.lockNote !== null && (
              <Note background="var(--cs-surface-2)">
                {UiParts.text("🔒  " + m.lockNote, 13.5)}
                {m.questions.total > 0 && (
                  <div className="cs-gp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={m.questions.total} aria-valuenow={m.questions.done}>
                    <div style={{ width: `${(100 * m.questions.done) / m.questions.total}%` }} />
                  </div>
                )}
              </Note>
            )}
            <TaskStatusList model={m} t={t} onSelect={(i) => events.taskSelected(i)} />
          </>
        )}
        {m.tasks.length > 0 && (
          <ExpectedPicture
            chapter={m.chapterId}
            api={m.api}
            task={m.selectedTask}
            // Steps and exercises are numbered on their own.
            caption={m.selectedTask < m.stepCount ? t("expected.task", { n: m.selectedTask + 1 }) : t("expected.exercise", { n: m.selectedTask - m.stepCount + 1 })}
            t={t}
            draw={draw}
            onEnlarge={(panel) => events.enlarge(panel)}
          />
        )}
      </div>
    </div>
  );
}

function Buttons({ model: m, t, events }: { model: PanelModel; t: Tr; events: ProjectPanelEvents }) {
  const hasTasks = m.tasks.length > 0;
  return (
    <div className="cs-gp-buttons">
      {hasTasks && (
        <>
          <button type="button" className="primary" disabled={m.checking} title={t("yourProject.checkTitle")} onClick={() => events.check()}>
            {m.checking ? t("yourProject.checking") : t("yourProject.check")}
          </button>
          {m.mainFile !== null && (
            <button type="button" className="secondary" onClick={() => events.changeFile()}>
              {t("yourProject.changeFile")}
            </button>
          )}
        </>
      )}
      {/* The course's own textures, models and fonts; the code is the learner's own. */}
      {m.hasResources && (
        <button type="button" className="secondary" title={t("yourProject.saveTitle")} onClick={() => events.save()}>
          {t("yourProject.save")}
        </button>
      )}
    </div>
  );
}
