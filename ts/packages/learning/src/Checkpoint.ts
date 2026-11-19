// Port of Codestead.UI/Learning/Checkpoint.cs and QuizOption.cs. In C# they live in Codestead.UI; here they are in
// @codestead/learning, without React, so that the content packages (and their tests) can parse checkpoints too.
// @codestead/ui re-exports them.

/** One answer option in a quiz. */
export class QuizOption {
  constructor(
    readonly text: string,
    readonly correct: boolean,
  ) {}
}

/** A malformed checkpoint (C#'s FormatException). */
export class FormatException extends Error {
  override name = "FormatException";
}

const block = /^```(quiz|predict|try)[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm;
const optionLine = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/;
// (?<=^|\s)(?:[^\s/]*/)+(?=[^\s/]+(\s|$)) with RegexOptions.Multiline: ^ and $ also at line breaks.
const directoryPrefix = /(?<=^|\s)(?:[^\s/]*\/)+(?=[^\s/]+(\s|$))/gm;

/** The init-only properties of a {@link Checkpoint}. */
export interface CheckpointInit {
  index?: number;
  kind?: string;
  prompt?: string;
  options?: QuizOption[];
  commands?: string[];
  expected?: string;
  explanation?: string | null;
}

/**
 * An interactive checkpoint inside a lesson text. Written as fenced blocks in the chapter markdown,
 * so translators keep the same structure in every language:
 * ```
 * ```quiz
 * Which command shows the directory you are in?
 * - [ ] ls
 * - [x] pwd
 * ---
 * `pwd` stands for "print working directory".
 * ```
 *
 * ```predict
 * $ echo $((2 + 3))
 * 5
 * ---
 * Optional explanation.
 * ```
 *
 * ```try
 * pwd
 * ---
 * Optional text shown when it worked.
 * ```
 * ```
 * A quiz with several [x] options requires all of them (check boxes); with one it is a single choice.
 * A predict block shows the command(s) after "$ " and expects the remaining lines as the answer.
 * A try block lists accepted commands; it is solved when the student runs one of them (or a command
 * with the same output) in the tool's terminal.
 */
export class Checkpoint {
  static readonly Quiz = "quiz";
  static readonly Predict = "predict";
  static readonly Try = "try";

  static readonly Kinds: readonly string[] = [Checkpoint.Quiz, Checkpoint.Predict, Checkpoint.Try];

  /** Position among the checkpoints of the text (0, 1, 2 ...). */
  readonly index: number;
  readonly kind: string;
  /** The question (markdown, quiz only). */
  readonly prompt: string;
  readonly options: readonly QuizOption[];
  /** Commands shown (predict) or accepted (try). */
  readonly commands: readonly string[];
  /** The expected output (predict). */
  readonly expected: string;
  /** Shown after the right answer (markdown). */
  readonly explanation: string | null;

  constructor(init: CheckpointInit = {}) {
    this.index = init.index ?? 0;
    this.kind = init.kind ?? Checkpoint.Quiz;
    this.prompt = init.prompt ?? "";
    this.options = init.options ?? [];
    this.commands = init.commands ?? [];
    this.expected = init.expected ?? "";
    this.explanation = init.explanation ?? null;
  }

  get multipleAnswers(): boolean {
    return this.options.filter((o) => o.correct).length > 1;
  }

  /** All checkpoints in a markdown text, in order. */
  static parseAll(markdown: string): Checkpoint[] {
    const list: Checkpoint[] = [];
    for (const m of markdown.matchAll(block)) list.push(Checkpoint.parse(m[1]!, m[2]!, list.length));
    return list;
  }

  /** Parses the body of one fenced block. Throws {@link FormatException} if it is malformed. */
  static parse(kind: string, body: string, index: number): Checkpoint {
    const lines = body.replaceAll("\r\n", "\n").split("\n");
    const sep = lines.findIndex((l) => l.trim() === "---");
    const main = sep >= 0 ? lines.slice(0, sep) : lines;
    let explanation: string | null = sep >= 0 ? lines.slice(sep + 1).join("\n").trim() : null;
    if (explanation === "") explanation = null;

    switch (kind) {
      case Checkpoint.Quiz: {
        const prompt: string[] = [];
        const options: QuizOption[] = [];
        for (const line of main) {
          const o = optionLine.exec(line);
          if (o) options.push(new QuizOption(o[2]!.trim(), o[1]!.toLowerCase() === "x"));
          else if (options.length === 0) prompt.push(line);
          else if (line.trim() !== "") throw new FormatException(`quiz ${index}: text after the options: "${line}"`);
        }
        if (options.length < 2) throw new FormatException(`quiz ${index}: needs at least two options`);
        if (!options.some((o) => o.correct)) throw new FormatException(`quiz ${index}: no option is marked [x]`);
        const text = prompt.join("\n").trim();
        if (text === "") throw new FormatException(`quiz ${index}: the question is missing`);
        return new Checkpoint({ index, kind: Checkpoint.Quiz, prompt: text, options, explanation });
      }
      case Checkpoint.Predict: {
        const commands: string[] = [];
        for (const l of main) {
          if (!l.startsWith("$ ")) break;
          commands.push(l.slice(2));
        }
        if (commands.length === 0) throw new FormatException(`predict ${index}: the first line must start with "$ "`);
        const expected = main.slice(commands.length).join("\n").trimEnd();
        return new Checkpoint({ index, kind: Checkpoint.Predict, commands, expected, explanation });
      }
      case Checkpoint.Try: {
        const commands = main.map((l) => l.trim()).filter((l) => l !== "");
        if (commands.length === 0) throw new FormatException(`try ${index}: no command`);
        return new Checkpoint({ index, kind: Checkpoint.Try, commands, explanation });
      }
    }
    throw new FormatException(`Unknown checkpoint kind ${kind}`);
  }

  /** Normalises an answer or command line for comparison (trims, collapses spaces). */
  static normalize(s: string): string {
    return s.replaceAll("\r\n", "\n").trim().replace(/[ \t]+/g, " ").replaceAll(" \n", "\n").replaceAll("\n ", "\n");
  }

  /** Is the predicted output right? */
  isCorrectPrediction(answer: string): boolean {
    return Checkpoint.normalize(answer) === Checkpoint.normalize(this.expected);
  }

  /**
   * Wrong, but only because the directory in front of the file names is missing
   * ("fruits.txt" where ls prints "documents/fruits.txt").
   */
  isRightWithoutDirectories(answer: string): boolean {
    const bare = this.expected.replace(directoryPrefix, "");
    return bare !== this.expected && !this.isCorrectPrediction(answer) && Checkpoint.normalize(answer) === Checkpoint.normalize(bare);
  }

  /** Is this set of chosen options right (exactly the correct ones)? */
  isCorrectChoice(chosen: Iterable<number>): boolean {
    const set = new Set(chosen);
    return this.options.every((o, i) => o.correct === set.has(i));
  }
}
