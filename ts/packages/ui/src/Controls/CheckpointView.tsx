import { Checkpoint } from "@codestead/learning";
import { type Ref, useId, useImperativeHandle, useReducer, useRef } from "react";
import { type CheckpointTexts, CheckpointTextDefaults } from "./CheckpointTexts.js";
import { MarkdownView } from "./MarkdownView.js";
import type { ISandbox } from "./Sandbox/ISandbox.js";
import type { SandboxRun } from "./Sandbox/SandboxRun.js";

/** What the window does with a checkpoint on screen. */
export interface CheckpointHandle {
  readonly isSolved: boolean;
  readonly examMode: boolean;
  /**
   * A command line run in the tool's terminal. Solves a "try it" question when it is one of the accepted
   * commands, or prints what the first of them prints on a fresh computer. Other kinds ignore it.
   */
  commandRan(run: SandboxRun): void;
  /** Exam mode: marks the answer right or wrong, locks it and returns whether it was right. */
  grade(): boolean;
}

export interface CheckpointViewProps {
  cp: Checkpoint;
  texts: CheckpointTexts;
  alreadySolved: boolean;
  /** Gives the output a "try" command has on a fresh computer (another command with the same output also counts). */
  sandbox: ISandbox;
  examMode?: boolean;
  onCommandClicked?: (command: string) => void;
  /** Called once when the checkpoint has been answered correctly (lesson mode). */
  onSolved?: (cp: Checkpoint) => void;
  ref?: Ref<CheckpointHandle>;
}

/** Wrong answers before "Show the answer" appears (lessons only; exams are graded at the end). */
export const AttemptsBeforeAnswer = 2;

/** The state of one checkpoint (C#'s CheckpointView fields); the view re-renders when it changes. */
class CheckpointModel {
  chosen = new Set<number>();
  answer = "";
  trySolved = false;
  solved = false;
  wrongAttempts = 0;
  showAnswerVisible = false;
  feedback: { text: string; right: boolean } | null = null;
  explanationVisible = false;
  /** The card's look: plain, solved (accent background), or graded right/wrong (border). */
  look: "" | "solved" | "right" | "wrong" = "";
  locked = false;
  private tryExpected: string | null = null;

  constructor(
    private readonly cp: Checkpoint,
    private readonly texts: CheckpointTexts,
    private readonly examMode: boolean,
    private readonly sandbox: ISandbox,
    private readonly onSolved: () => void,
  ) {}

  commandRan(run: SandboxRun): boolean {
    const cp = this.cp;
    if (cp.kind !== Checkpoint.Try || this.solved || !run.finished) return false;
    const line = Checkpoint.normalize(run.line);
    let right = cp.commands.some((c) => Checkpoint.normalize(c) === line);
    if (!right && run.exitCode === 0) {
      this.tryExpected ??= this.sandbox.outputOf(cp.commands[0]!).trim();
      right = this.tryExpected !== "" && run.output.trim() === this.tryExpected;
    }
    if (!right) return false;
    this.trySolved = true;
    if (!this.examMode) this.markSolved(false);
    return true;
  }

  isAnswerRight(): boolean {
    switch (this.cp.kind) {
      case Checkpoint.Quiz:
        return this.cp.isCorrectChoice(this.chosen);
      case Checkpoint.Predict:
        return this.cp.isCorrectPrediction(this.answer);
      default:
        return this.trySolved;
    }
  }

  checkNow(): void {
    if (this.solved) return;
    if (this.isAnswerRight()) {
      this.markSolved(false);
      return;
    }
    this.wrongAttempts++;
    // The most common slip in "what does this print?": the names without the directory ls prints in front.
    const almost = this.cp.kind === Checkpoint.Predict && this.cp.isRightWithoutDirectories(this.answer);
    this.feedback = { text: "✗ " + (almost ? (this.texts.almostPath ?? CheckpointTextDefaults.almostPath) : this.texts.wrong), right: false };
    // Nobody should be stuck: after a few tries the answer can be shown (and the chapter goes on).
    if (!this.examMode && this.cp.kind !== Checkpoint.Try && this.wrongAttempts >= AttemptsBeforeAnswer) this.showAnswerVisible = true;
  }

  showAnswer(): void {
    if (this.solved) return;
    if (this.cp.kind === Checkpoint.Predict) this.answer = this.cp.expected;
    this.markSolved(false);
  }

  markSolved(silent: boolean): void {
    if (this.solved) return;
    this.solved = true;
    this.showAnswerVisible = false;
    this.feedback = { text: "✓ " + (silent ? this.texts.done : this.texts.correct), right: true };
    this.explanationVisible = this.cp.explanation !== null;
    this.look = "solved";
    if (this.cp.kind === Checkpoint.Quiz) {
      this.chosen = new Set(this.cp.options.flatMap((o, i) => (o.correct ? [i] : [])));
      this.locked = true;
    }
    if (this.cp.kind === Checkpoint.Predict) {
      if (this.answer.trim() === "") this.answer = this.cp.expected;
      this.locked = true;
    }
    if (!silent) this.onSolved();
  }

  grade(): boolean {
    const right = this.isAnswerRight();
    this.feedback = { text: right ? "✓ " + this.texts.correct : "✗ " + this.texts.wrong, right };
    this.look = right ? "right" : "wrong";
    this.explanationVisible = this.cp.explanation !== null;
    this.locked = true;
    return right;
  }
}

/**
 * One interactive checkpoint in a lesson (or a question in an exam): a quiz, a "what does this print?"
 * question or a "try it" question. A "try it" question has no terminal of its own: the student runs the
 * command in the tool's terminal, and the window passes every command line on with {@link CheckpointHandle.commandRan}.
 * In lesson mode answers are checked at once and the card turns green when solved.
 * In exam mode answers are only collected; {@link CheckpointHandle.grade} marks them.
 */
export function CheckpointView({ cp, texts, alreadySolved, sandbox, examMode = false, onCommandClicked, onSolved, ref }: CheckpointViewProps) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const solvedRef = useRef(onSolved);
  solvedRef.current = onSolved;
  const modelRef = useRef<CheckpointModel | null>(null);
  if (modelRef.current === null) {
    modelRef.current = new CheckpointModel(cp, texts, examMode, sandbox, () => solvedRef.current?.(cp));
    if (alreadySolved && !examMode) modelRef.current.markSolved(true);
  }
  const m = modelRef.current;
  const group = useId();

  useImperativeHandle(
    ref,
    () => ({
      get isSolved() {
        return m.solved;
      },
      examMode,
      commandRan(run: SandboxRun) {
        if (m.commandRan(run)) rerender();
      },
      grade() {
        const right = m.grade();
        rerender();
        return right;
      },
    }),
    [m, examMode],
  );

  const act = (f: () => void) => {
    f();
    rerender();
  };
  const multiline = cp.expected.includes("\n");
  const label = (examMode ? `${texts.question} ${cp.index + 1}` : "✎ " + texts.question).toUpperCase();

  return (
    <div className={"cs-checkpoint" + (m.look ? " " + m.look : "")} data-solved={m.solved || undefined}>
      <div className="cs-checkpoint-label">{label}</div>

      {cp.kind === Checkpoint.Quiz && (
        <>
          <MarkdownView markdown={cp.prompt} baseFontSize={15.5} onCommandClicked={onCommandClicked} />
          {cp.options.map((option, i) => (
            <label key={i} className="cs-checkpoint-option">
              <input
                type={cp.multipleAnswers ? "checkbox" : "radio"}
                name={group}
                checked={m.chosen.has(i)}
                disabled={m.locked}
                onChange={(e) =>
                  act(() => {
                    if (!cp.multipleAnswers) m.chosen.clear();
                    if (e.target.checked) m.chosen.add(i);
                    else m.chosen.delete(i);
                  })
                }
              />
              <MarkdownView markdown={option.text} baseFontSize={14.5} />
            </label>
          ))}
        </>
      )}

      {cp.kind === Checkpoint.Predict && (
        <>
          <div className="cs-text">{texts.predictPrompt}</div>
          <pre className="cs-checkpoint-code" dir="ltr">
            {cp.commands.map((c, i) => (
              <span key={i}>
                {i > 0 && "\n"}
                <span className="prompt">$ </span>
                {c}
              </span>
            ))}
          </pre>
          {multiline ? (
            <textarea
              className="cs-checkpoint-answer"
              dir="ltr"
              style={{ minHeight: 70 }}
              placeholder={texts.answerPlaceholder}
              value={m.answer}
              readOnly={m.locked}
              onChange={(e) => act(() => (m.answer = e.target.value))}
            />
          ) : (
            <input
              type="text"
              className="cs-checkpoint-answer"
              dir="ltr"
              placeholder={texts.answerPlaceholder}
              value={m.answer}
              readOnly={m.locked}
              onChange={(e) => act(() => (m.answer = e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !examMode) {
                  e.preventDefault();
                  act(() => m.checkNow());
                }
              }}
            />
          )}
        </>
      )}

      {cp.kind === Checkpoint.Try && (
        <>
          <div className="cs-text">{texts.tryPrompt}</div>
          {onCommandClicked ? (
            // A click puts the command in the terminal, like the commands in the lesson text.
            <button type="button" className="solution" style={{ alignSelf: "flex-start" }} onClick={() => onCommandClicked(cp.commands[0]!)}>
              {cp.commands[0]}
            </button>
          ) : (
            <div className="cs-checkpoint-try">{cp.commands[0]}</div>
          )}
        </>
      )}

      {!examMode && cp.kind !== Checkpoint.Try && !m.solved && (
        <div className="cs-row" style={{ gap: 8 }}>
          <button type="button" className="secondary" onClick={() => act(() => m.checkNow())}>
            {texts.check}
          </button>
          {m.showAnswerVisible && (
            <button type="button" className="secondary" onClick={() => act(() => m.showAnswer())}>
              {texts.showAnswer ?? CheckpointTextDefaults.showAnswer}
            </button>
          )}
        </div>
      )}
      {m.feedback && <div className={"cs-checkpoint-feedback cs-text " + (m.feedback.right ? "right" : "wrong")}>{m.feedback.text}</div>}
      {cp.explanation !== null && m.explanationVisible && <MarkdownView markdown={cp.explanation} baseFontSize={14} />}
    </div>
  );
}
