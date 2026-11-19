// The localised texts of the checkpoint controls.

/** Localised texts used by the checkpoint controls. */
export interface CheckpointTexts {
  check: string;
  correct: string;
  wrong: string;
  predictPrompt: string;
  tryPrompt: string;
  done: string;
  answerPlaceholder: string;
  question: string;
  /** "Show the answer" when not given. */
  showAnswer?: string;
  /** The hint for answers without the directories ls prints (an English default when not given). */
  almostPath?: string;
}

export const CheckpointTextDefaults = {
  showAnswer: "Show the answer",
  almostPath: "Almost! Look at how the paths are written: ls shows each name the way you gave it, with the directory in front.",
} as const;
