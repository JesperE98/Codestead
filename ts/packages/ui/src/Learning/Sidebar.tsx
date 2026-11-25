import { ChapterKinds } from "@codestead/learning";
import type { ReactNode } from "react";
import { Icons } from "../Controls/Icons.js";
import { useStore } from "../Store.js";
import { LearningWindow } from "./LearningWindow.js";

// The chapter list in the sidebar (C#'s LearningWindow.Sidebar.cs) and its menu (achievements, settings).

export function Sidebar({ window: w }: { window: LearningWindow }) {
  useStore(w);
  const tool = w.tool;
  const current = w.chapter.id;
  let number = 0;
  const rows: ReactNode[] = [];
  for (const part of tool.parts) {
    const chapters = w.chapters.filter((c) => c.part === part);
    if (chapters.length === 0) continue;
    rows.push(
      <div key={"part:" + part} className="cs-sidebar-part">
        {w.t(`part.${part}`).toUpperCase()}
      </div>,
    );
    for (const ch of chapters) {
      const { done, total } = w.chapterProgress(ch);
      const no = ch.kind === ChapterKinds.Summary ? "∑" : ch.kind === ChapterKinds.Exam ? "★" : ch.isProject ? "◆" : String(++number);
      let complete: boolean;
      let mark: string;
      if (ch.kind === ChapterKinds.Exam) {
        const best = w.state.exams.get(ch.part);
        complete = best !== undefined && best >= LearningWindow.ExamPassPercent;
        mark = best !== undefined ? `${best} %` : "";
      } else if (ch.kind === ChapterKinds.Summary) {
        complete = false;
        mark = "";
      } else if (ch.isProject) {
        // Optional: its milestones do not count towards the course, and it opens with the exam passed.
        complete = w.isProjectComplete(ch);
        mark = complete ? "✓" : w.isProjectOpen(ch) ? `${done}/${total}` : "";
      } else {
        complete = w.isLessonComplete(ch);
        mark = complete ? "✓" : `${done}/${total}`;
      }
      rows.push(
        <button key={ch.id} type="button" className={"nav-item" + (ch.id === current ? " current" : "")} aria-current={ch.id === current ? "page" : undefined} onClick={() => w.navigate(ch.id)}>
          <span className="cs-sidebar-row">
            <span className="muted" style={{ fontSize: 13 }}>
              {no}
            </span>
            <span className="cs-text" style={{ fontSize: 14 }}>
              {tool.chapterTitle(ch.id, w.lang)}
            </span>
            <span className={"cs-sidebar-count" + (complete ? " complete" : " muted")}>{mark}</span>
          </span>
        </button>,
      );
    }
  }
  return (
    <nav className="cs-sidebar">
      <div className="cs-sidebar-list">{rows}</div>
      <div className="cs-sidebar-menu">
        <button type="button" className="nav-item" onClick={() => w.game.openAchievements()}>
          {Icons.label(Icons.trophy(), w.game.achievementsShort())}
        </button>
        <button type="button" className="nav-item" onClick={() => w.openSettings()}>
          {Icons.label(Icons.gear(), w.t("settings.open"))}
        </button>
      </div>
    </nav>
  );
}
