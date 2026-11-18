// Port of YourProject/Tr.cs.

/** A user-interface text in the learner's language (LearningWindow.t). */
export type Tr = (key: string, args?: Readonly<Record<string, unknown>>) => string;
