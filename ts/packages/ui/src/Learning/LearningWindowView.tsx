import { Languages } from "@codestead/common";
import { ChapterKinds } from "@codestead/learning";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { UiParts } from "../App/UiParts.js";
import { OverlayHost } from "../Controls/Dialogs.js";
import { GameBar } from "../Controls/Game/Views/GameBar.js";
import { NoticeLayer } from "../Controls/Game/Views/NoticeLayer.js";
import { Bar } from "../Controls/Game/Views/Parts.js";
import { useStore } from "../Store.js";
import { Lesson } from "./Lesson.js";
import type { LearningWindow } from "./LearningWindow.js";
import { Sidebar } from "./Sidebar.js";
import { TaskList } from "./Tasks.js";

// The layout (top bar, sidebar, lesson, workbench) and the language and variant pickers (C#'s
// LearningWindow.Layout.cs).

/** Below this window width the game widget hides the level title. */
const CompactWidth = 1240;

/**
 * Shows a {@link LearningWindow}: top bar, sidebar | lesson | workbench, with the dialogs, toasts and notices over
 * it. Mount it once per window; it calls `window.opened()` when it is first on screen.
 */
export function LearningWindowView({ window: w }: { window: LearningWindow }) {
  useStore(w);
  const tool = w.tool;
  const [compact, setCompact] = useState(() => (globalThis.innerWidth ?? CompactWidth) < CompactWidth);
  const [workbenchWidth, setWorkbenchWidth] = useState(560);
  const lessonScroll = useRef<HTMLDivElement>(null);

  // The window was opened.
  useEffect(() => {
    w.opened();
    const onResize = () => setCompact(globalThis.innerWidth < CompactWidth);
    globalThis.addEventListener("resize", onResize);
    const onUnload = () => w.saveAll();
    globalThis.addEventListener("beforeunload", onUnload);
    return () => {
      globalThis.removeEventListener("resize", onResize);
      globalThis.removeEventListener("beforeunload", onUnload);
    };
  }, [w]);

  // Everything was re-rendered: the tool is told (e.g. to update the workbench title).
  useEffect(() => {
    if (globalThis.document) document.title = w.title;
    tool.rendered?.();
  }, [w, tool, w.renderCount]);

  // A new lesson starts at the top.
  useEffect(() => {
    lessonScroll.current?.scrollTo?.({ top: 0 });
  }, [w.lessonKey]);

  const chapter = w.chapter;
  const lesson = chapter.kind === ChapterKinds.Lesson;
  const exam = chapter.kind === ChapterKinds.Exam && w.isExamOpen(chapter);
  // A lesson always shows the workbench (Codestead Linux: the terminal), so its "try it" questions can be answered
  // there. Above it are the tasks once the lesson is unlocked, or a "read first" card until then. An open exam shows
  // only the workbench (it has "try it" questions too); summaries and locked exams use the whole width.
  const shown = lesson || exam;
  const unlocked = lesson && w.isUnlocked(chapter);
  const hosts = tool.hostsTasks ?? false;
  // A tool that hosts the tasks gets the whole column: no tasks card and no "read first" card above it.
  const below = lesson && !hosts;
  const tasksVisible = unlocked && !hosts;
  const gateVisible = lesson && !unlocked && !hosts;

  const { done, total } = w.totalProgress();
  const { level, streak } = w.game.barModels();
  const variantGroups = tool.variants(chapter.id);
  const variantCount = variantGroups.reduce((n, g) => n + g.options.length, 0);
  const currentVariant = tool.currentVariant(chapter.id);

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const startX = e.clientX;
    const startWidth = workbenchWidth;
    const rtl = w.dir === "rtl";
    const move = (ev: PointerEvent) => setWorkbenchWidth(Math.max(320, startWidth + (rtl ? ev.clientX - startX : startX - ev.clientX)));
    const up = () => {
      globalThis.removeEventListener("pointermove", move);
      globalThis.removeEventListener("pointerup", up);
    };
    globalThis.addEventListener("pointermove", move);
    globalThis.addEventListener("pointerup", up);
  };

  const columns = shown ? `270px minmax(0, 1fr) 4px ${workbenchWidth}px` : "270px minmax(0, 1fr) 0 0";
  const workbenchStyle: CSSProperties = below ? { gridRow: 3 } : { gridRow: "1 / span 3" };

  return (
    <div className="cs-root" dir={w.dir} lang={w.lang} style={{ height: "100%" }}>
      <OverlayHost overlay={w.overlay} layers={<NoticeLayer notices={w.notices} />} closeLabel={w.t("dialog.close")}>
        <div className="cs-window">
          {/* Top bar */}
          <header className="cs-topbar">
            <div className="cs-brand">
              <img src={tool.iconUrl} alt="" />
              <span>{tool.product.name}</span>
            </div>
            <div className="cs-topbar-right">
              <GameBar ref={(h) => void (w.gameBar = h)} level={level} streak={streak} compact={compact} onClick={() => w.game.openAchievements()} />
              <div className="cs-row" title={tool.progressTitle(done, total)}>
                <Bar fraction={done / Math.max(1, total)} height={6} color="CsSuccess" style={{ width: 120 }} />
                {UiParts.text(w.t("progress.short", { done, total }), 13, undefined, undefined, { marginInlineStart: 8 })}
              </div>
              {/* The variant choice only matters where a chapter can run on more than one. */}
              {variantCount > 1 && (
                <select style={{ minWidth: 190 }} title={w.t("distro.label")} aria-label={w.t("distro.label")} value={currentVariant} onChange={(e) => w.changeVariant(e.target.value)}>
                  {variantGroups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.options.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
              {tool.topBarExtra?.()}
              <select style={{ minWidth: 150 }} title={w.t("lang.label")} aria-label={w.t("lang.label")} value={w.lang} onChange={(e) => w.changeLanguage(e.target.value)}>
                {Languages.offered.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </header>

          <div className="cs-body" style={{ gridTemplateColumns: columns }}>
            <Sidebar window={w} />
            <main ref={lessonScroll} className="cs-lesson-scroll">
              <Lesson window={w} />
            </main>
            <div className="cs-splitter" hidden={!shown} onPointerDown={startDrag} role="separator" aria-orientation="vertical" />
            {/* Workbench: tasks (or the "read first" card) above, the tool's workbench (Codestead Linux: the terminal) below. */}
            <div className="cs-workbench" style={shown ? undefined : { visibility: "hidden", margin: 0 }}>
              {tasksVisible && (
                <div className="card cs-tasks-card" style={{ gridRow: 1 }}>
                  <TaskList window={w} />
                </div>
              )}
              {/* The workbench stays mounted (the terminal keeps its state); it is only hidden. */}
              <div className="cs-workbench-frame" style={{ ...workbenchStyle, display: shown ? undefined : "none" }}>
                {tool.workbench()}
              </div>
              {gateVisible && <Gate window={w} />}
            </div>
          </div>
        </div>
      </OverlayHost>
    </div>
  );
}

/** The "read first" card above the workbench of a locked lesson. */
function Gate({ window: w }: { window: LearningWindow }) {
  const chapter = w.chapter;
  const total = w.checkpointCount(chapter);
  const done = w.solvedCheckpoints(chapter);
  return (
    <div className="card cs-gate" style={{ gridRow: 1 }}>
      {UiParts.text("🔒  " + w.t("gate.title"), 18, 700)}
      {total > 0 ? (
        <>
          {UiParts.text(w.t("gate.checkpoints", { done, total }), 14.5)}
          <Bar fraction={done / total} height={6} color="CsAccent" />
        </>
      ) : (
        UiParts.text(w.t("gate.read"), 14.5)
      )}
    </div>
  );
}
