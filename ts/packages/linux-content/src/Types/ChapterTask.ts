// Port of Types/ChapterTask.cs – one task in a chapter: text, hint, solution and check.

import type { Distro, World } from "@codestead/linux-shell";
import type { CheckContext } from "./CheckContext.js";
import { PerDistro } from "./PerDistro.js";

/** The properties a task is created with (C#'s object initializer). */
export interface ChapterTaskInit {
  id: string;
  text: PerDistro<string>;
  hint?: PerDistro<string> | null;
  solution?: PerDistro<string[]>;
  perFamily?: boolean | null;
  check?: (c: CheckContext) => boolean;
}

/** A task in a chapter. (TS: Task – renamed in C# because of System.Threading.Tasks.Task.) */
export class ChapterTask {
  id: string;
  /** Task text (markdown, one line). */
  text: PerDistro<string>;
  hint: PerDistro<string> | null;
  /** Commands that solve the task. Used for "Show solution" and in the tests. */
  solution: PerDistro<string[]>;
  /** The task is counted separately for each distribution family. */
  perFamily: boolean | null;
  check: (c: CheckContext) => boolean;

  constructor(init: ChapterTaskInit) {
    this.id = init.id;
    this.text = init.text;
    this.hint = init.hint ?? null;
    this.solution = init.solution ?? [];
    this.perFamily = init.perFamily ?? null;
    this.check = init.check ?? (() => false);
  }

  /** The solution for a distribution, with the student's world filled in (e.g. ~/{{documents}} → ~/documents). */
  solutionFor(d: Distro, w: World): string[] {
    return PerDistro.resolve(this.solution, d).map((l) => w.expand(l));
  }
}
