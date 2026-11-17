import { NoteLevel, Simulator } from "@codestead/gp-gpu";
import { CheckContext } from "../CheckContext.js";
import { TaskChecks } from "../Checks/TaskChecks.js";
import { BuildFacts } from "../Game/BuildFacts.js";
import { GpCourse } from "../GpCourse.js";
import type { TaskCheck } from "../TaskCheck.js";
import { CheckMessage } from "./CheckMessage.js";
import { CheckReport } from "./CheckReport.js";
import { defaultFileSystem, type FileSystem } from "./FileSystem.js";
import { ProjectRead } from "./ProjectRead.js";
import { ProjectReader } from "./ProjectReader.js";
import { TaskResult } from "./TaskResult.js";

/**
 * Checks the learner's code with the course's own task checks: the code is read into a project, the simulated
 * GPU builds and runs it once, and every task's check of the chapter looks at the result in order – as the
 * TaskTests do with the course's solutions. C# runs it on a background thread and can cancel it between tasks; here
 * an AbortSignal does that (the app runs it in a worker or another process to keep the window responsive).
 */
export const ProjectChecker = {
  /** Checks the code around the chapter's main file, which the learner picked ({@link ProjectReader.readFrom}), or a project already read. */
  check(main: string | ProjectRead, chapterId: string, api: string, cancel?: AbortSignal, fs?: FileSystem): CheckReport {
    if (typeof main === "string") {
      const read = ProjectReader.readFrom(main, chapterId, api, fs ?? defaultFileSystem());
      cancel?.throwIfAborted();
      return checkRead(read, chapterId, api, cancel);
    }
    return checkRead(main, chapterId, api, cancel);
  },
};

function checkRead(read: ProjectRead, chapterId: string, api: string, cancel?: AbortSignal): CheckReport {
  const messages: CheckMessage[] = [];
  if (read.missing.length > 0) messages.push(new CheckMessage("ide.missing", new Map([["files", read.missing.join(", ")]]), true));
  const tasks = GpCourse.allTasks(chapterId, api);
  if (read.project.files.size === 0)
    return new CheckReport(
      chapterId,
      api,
      tasks.map((t) => new TaskResult(t.id, GpCourse.taskKey(chapterId, t.id, api), false, TaskChecks.for(chapterId, t.id) !== null)),
      messages,
      null,
    );
  const context = new CheckContext(api, read.project, Simulator.build(read.project, api));
  cancel?.throwIfAborted();
  const error = context.build.diagnostics.find((d) => d.isError);
  if (error !== undefined)
    messages.push(
      new CheckMessage(
        "ide.buildFailed",
        new Map([
          ["file", error.file],
          ["line", String(error.line)],
          ["message", error.message],
        ]),
        true,
      ),
    );
  for (const note of context.scene?.notes.filter((n) => n.level !== NoteLevel.Info) ?? [])
    messages.push(new CheckMessage("sim." + note.key, note.args, note.level === NoteLevel.Error));
  const results: TaskResult[] = [];
  for (const task of tasks) {
    cancel?.throwIfAborted();
    const check = TaskChecks.for(chapterId, task.id);
    const passed = check !== null && safe(check, context);
    results.push(new TaskResult(task.id, GpCourse.taskKey(chapterId, task.id, api), passed, check !== null));
  }
  cancel?.throwIfAborted();
  let facts: BuildFacts | null = null;
  try {
    facts = BuildFacts.from(context);
  } catch {
    // The facts are for the statistics; the checks above count.
  }
  return new CheckReport(chapterId, api, results, messages, facts);
}

/** A check that throws has not passed (C#: every exception but OutOfMemoryException). */
function safe(check: TaskCheck, c: CheckContext): boolean {
  try {
    return check(c);
  } catch {
    return false;
  }
}
