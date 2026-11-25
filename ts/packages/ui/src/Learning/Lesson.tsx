import { Languages } from "@codestead/common";
import { Checkpoint, ChapterKinds, type CourseChapter } from "@codestead/learning";
import { type ReactNode, useState } from "react";
import { UiParts } from "../App/UiParts.js";
import { CheckpointView } from "../Controls/CheckpointView.js";
import { type FencedBlock, MarkdownView } from "../Controls/MarkdownView.js";
import { useStore } from "../Store.js";
import { LearningWindow } from "./LearningWindow.js";

// The lesson text with its interactive checkpoints, and the previous/next buttons (C#'s LearningWindow.Lesson.cs),
// and the exam of a main chapter (LearningWindow.Exam.cs).

/** The checkpoint renderer of one render of a text: ```quiz / ```predict / ```try blocks become checkpoints, in order. */
function checkpointRenderer(w: LearningWindow, chapter: CourseChapter, exam: boolean): (block: FencedBlock) => ReactNode | null {
  let next = 0;
  const texts = w.checkpointTexts();
  return (block) => {
    if (!Checkpoint.Kinds.includes(block.info)) return null;
    const index = next++;
    const cp = Checkpoint.parse(block.info, block.text, index);
    const key = LearningWindow.checkpointKey(chapter, index);
    return (
      <CheckpointView
        key={key}
        cp={cp}
        texts={texts}
        alreadySolved={w.state.checkpoints.has(key)}
        sandbox={w.tool.sandbox(chapter.id)}
        examMode={exam}
        onCommandClicked={(cmd) => w.tool.inject(cmd)}
        onSolved={exam ? undefined : () => w.checkpointSolved(chapter, index)}
        ref={(handle) => {
          if (!handle) return;
          w.checkpointViews.set(index, handle);
          return () => {
            if (w.checkpointViews.get(index) === handle) w.checkpointViews.delete(index);
          };
        }}
      />
    );
  };
}

/** The lesson column. It is built anew (checkpoints and exam answers start over) when {@link LearningWindow.lessonKey} changes. */
export function Lesson({ window: w }: { window: LearningWindow }) {
  useStore(w);
  return <LessonContent key={w.lessonKey} window={w} />;
}

function LessonContent({ window: w }: { window: LearningWindow }) {
  const tool = w.tool;
  const chapter = w.chapter;
  const available = new Set(tool.languagesWithText(chapter.id));
  const shownLang = Languages.fallbackChain(w.lang).find((l) => available.has(l)) ?? "sv";
  const shownDir = Languages.find(shownLang)?.dir ?? "ltr";
  const lessons = w.lessons;

  const eyebrow =
    chapter.kind === ChapterKinds.Summary
      ? w.t(`part.${chapter.part}`) + " · " + w.t("summary.label")
      : chapter.kind === ChapterKinds.Exam
        ? w.t(`part.${chapter.part}`) + " · " + w.t("exam.label")
        : chapter.isProject
          ? w.t(`part.${chapter.part}`) + " · " + w.t("project.label")
          : // Numbered like the sidebar: lessons only (summaries and exams are not counted).
          w.t("lesson.chapter", { n: lessons.indexOf(chapter) + 1, total: lessons.length });

  const text = tool.lessonText(chapter.id, w.lang);
  const markdown = (exam: boolean) => (
    <MarkdownView
      markdown={text}
      dir={shownDir === "rtl" ? "rtl" : "ltr"}
      commandHint={w.t("lesson.cmdTitle")}
      onCommandClicked={(cmd) => tool.inject(cmd)}
      onLinkClicked={(url) => w.openLink(url)}
      customBlockRenderer={checkpointRenderer(w, chapter, exam)}
      imageSource={(path) => tool.picture?.(path, w.lang) ?? null}
      animationHint={w.t("picture.pause")}
      enlargeHint={w.t("picture.enlarge")}
      onPictureEnlarge={(view, width) =>
        // Clearly larger than in the text column: 800–1200 px wide (most pictures are saved at twice the size the column
        // shows them at, so they stay sharp), and never taller than the window (the dialog shrinks to fit it).
        w.overlay.showDialog(view, () => w.overlay.closeDialog(), Math.max(800, Math.min(1200, (width || 1200) + 48)), true, "picture")
      }
      pictureRenderer={(picture) => tool.pictureView?.(picture, w.lang) ?? null}
    />
  );

  // A lesson without checkpoints: the student confirms having read it.
  const readButton = chapter.kind === ChapterKinds.Lesson && !w.isUnlocked(chapter) && w.checkpointCount(chapter) === 0;
  const references = tool.references(chapter.id);
  const i = w.chapterIndex;
  const prev = i > 0 ? w.chapters[i - 1] : undefined;
  const next = i < w.chapters.length - 1 ? w.chapters[i + 1] : undefined;

  return (
    <div className="cs-lesson">
      {UiParts.text(eyebrow.toUpperCase(), 12.5, undefined, "eyebrow")}
      {!available.has(w.lang) && <div className="cs-fallback-note cs-text">{w.t("lesson.fallback")}</div>}
      {chapter.kind === ChapterKinds.Exam ? (
        <Exam window={w} chapter={chapter} markdown={markdown(true)} />
      ) : chapter.isProject ? (
        <Project window={w} chapter={chapter} markdown={markdown(false)} />
      ) : (
        markdown(false)
      )}

      {readButton && (
        <button type="button" className="primary" style={{ marginTop: 18, alignSelf: "flex-start" }} onClick={() => w.markRead(chapter)}>
          {"✓  " + w.t("gate.readButton")}
        </button>
      )}

      {/* Official sources for the chapter. */}
      {references.length > 0 && (
        <div className="cs-references">
          {UiParts.text(w.t("references.title"), 17, 700)}
          {references.map((r, j) => (
            <button key={j} type="button" className="flat cs-reference" title={r.url} onClick={() => w.openLink(r.url)}>
              {UiParts.text("↗  " + r.title, 14.5, 600, undefined, { color: "var(--cs-link)" })}
              {UiParts.text(`${r.publisher} · ${r.url}`, 12, undefined, "muted")}
            </button>
          ))}
        </div>
      )}

      {/* Previous / next */}
      <div className="cs-lesson-nav">
        {prev && <NavButton window={w} target={prev} direction={"← " + w.t("lesson.prev")} />}
        {next && <NavButton window={w} target={next} direction={w.t("lesson.next") + " →"} next />}
      </div>
    </div>
  );
}

function NavButton({ window: w, target, direction, next = false }: { window: LearningWindow; target: CourseChapter; direction: string; next?: boolean }) {
  return (
    <button type="button" className={"secondary cs-lesson-nav-button" + (next ? " next" : "")} onClick={() => w.navigate(target.id)}>
      {UiParts.text(direction, 12.5, undefined, "muted")}
      {UiParts.text(w.tool.chapterTitle(target.id, w.lang), 15, 600)}
    </button>
  );
}

/**
 * The exam of a main chapter: locked until every sub-chapter is complete, then all questions at once.
 * Answers are graded on "Submit"; 80 % passes and the exam can be retaken.
 */
function Exam({ window: w, chapter, markdown }: { window: LearningWindow; chapter: CourseChapter; markdown: ReactNode }) {
  const [result, setResult] = useState<{ score: number; total: number; percent: number; passed: boolean } | null>(null);
  if (!w.isExamOpen(chapter)) {
    const remaining = w.lessonsIn(chapter.part).filter((l) => !w.isLessonComplete(l));
    return (
      <div className="cs-stack" style={{ gap: 8, marginTop: 10 }}>
        {UiParts.text(w.tool.chapterTitle(chapter.id, w.lang), 30, 700)}
        {UiParts.text("🔒  " + w.t("exam.locked"), 15)}
        {UiParts.text(w.t("exam.remaining"), 14, 600)}
        {remaining.map((l) => (
          <button key={l.id} type="button" className="flat" style={{ alignSelf: "flex-start" }} onClick={() => w.navigate(l.id)}>
            {"→  " + w.tool.chapterTitle(l.id, w.lang)}
          </button>
        ))}
      </div>
    );
  }
  const best = w.state.exams.get(chapter.part);
  return (
    <>
      {markdown}
      {result === null && (
        <button type="button" className="primary" style={{ marginTop: 12, alignSelf: "flex-start" }} onClick={() => setResult(w.submitExam(chapter))}>
          {w.t("exam.submit")}
        </button>
      )}
      <div className="cs-stack" style={{ gap: 8, marginTop: 18, alignItems: "flex-start" }}>
        {result === null ? (
          best !== undefined && UiParts.text(w.t("exam.best", { percent: best }), 13.5, undefined, "muted")
        ) : (
          <>
            {UiParts.text(w.t("exam.result", { score: result.score, total: result.total, percent: result.percent }), 17, 700)}
            {UiParts.text(result.passed ? "✓ " + w.t("exam.passed") : w.t("exam.failed", { need: LearningWindow.ExamPassPercent }), 15, 600, undefined, {
              color: result.passed ? "var(--cs-success)" : "var(--cs-danger)",
            })}
            <button type="button" className="secondary" onClick={() => w.renderLesson()}>
              {"↺  " + w.t("exam.retake")}
            </button>
          </>
        )}
      </div>
    </>
  );
}

/**
 * The optional project after a main chapter's exam: locked until the exam is passed, then its brief with the
 * milestones as the chapter's tasks. It never counts towards the course's progress.
 */
function Project({ window: w, chapter, markdown }: { window: LearningWindow; chapter: CourseChapter; markdown: ReactNode }) {
  if (!w.isProjectOpen(chapter)) {
    const exam = w.examOf(chapter.part);
    return (
      <div className="cs-stack" style={{ gap: 8, marginTop: 10 }}>
        {UiParts.text(w.tool.chapterTitle(chapter.id, w.lang), 30, 700)}
        {UiParts.text("🔒  " + w.t(exam !== undefined ? "project.locked" : "project.lockedNoExam"), 15)}
        {UiParts.text(w.t("project.optional"), 14, undefined, "muted")}
        {exam !== undefined && (
          <button type="button" className="flat" style={{ alignSelf: "flex-start" }} onClick={() => w.navigate(exam.id)}>
            {"→  " + w.tool.chapterTitle(exam.id, w.lang)}
          </button>
        )}
      </div>
    );
  }
  const complete = w.isProjectComplete(chapter);
  return (
    <>
      <div className={"cs-project-note cs-text" + (complete ? " complete" : "")}>
        {complete ? "✓  " + w.t("project.complete") : "🛠️  " + w.t("project.optional")}
      </div>
      {markdown}
    </>
  );
}
