import type { GpuProject } from "@codestead/gp-gpu";
import { CourseTask } from "./CourseTask.js";
import { EditState } from "./EditState.js";
import { TaskEdit } from "./TaskEdit.js";

/**
 * The tasks of a chapter, read from projects/&lt;api&gt;/&lt;chapter&gt;/edits.txt, and applying their edits. The format
 * (see src/GP/verify/apply_edits.py, which checks it against solution/):
 * ```
 * === task: render-loop
 * --- file: main.cpp
 * --- find:
 *     // TODO: the render loop
 * --- replace:
 *     while (!glfwWindowShouldClose(window)) { … }
 * ```
 */
export const Edits = {
  parse(text: string): CourseTask[] {
    const tasks: { id: string; edits: TaskEdit[] }[] = [];
    let file: string | null = null;
    let find: string[] | null = null;
    let replace: string[] | null = null;
    let current: string[] | null = null;
    const flush = (): void => {
      if (file !== null && find !== null && replace !== null && tasks.length > 0) tasks.at(-1)!.edits.push(new TaskEdit(file, trim(find), trim(replace)));
      file = null;
      find = replace = current = null;
    };
    for (const line of text.replaceAll("\r\n", "\n").split("\n")) {
      if (line.startsWith("=== task:")) {
        flush();
        tasks.push({ id: trimNet(line.slice(9)), edits: [] });
      } else if (line.startsWith("--- file:")) {
        flush();
        file = trimNet(line.slice(9));
      } else if (trimNet(line) === "--- find:") current = find = [];
      else if (trimNet(line) === "--- replace:") current = replace = [];
      else current?.push(line);
    }
    flush();
    return tasks.map((t) => new CourseTask(t.id, t.edits));
  },

  /** Where an edit stands in a project: done (the new code is there), can be applied (the old code is there), or neither. */
  stateOf(project: GpuProject, edit: TaskEdit): EditState {
    const text = project.files.get(edit.file);
    if (text === undefined) return EditState.NotApplicable;
    if (edit.replace.length > 0 && Edits.normalize(text).includes(Edits.normalize(edit.replace))) return EditState.Done;
    return text.includes(edit.find) ? EditState.Applicable : EditState.NotApplicable;
  },

  /** Applies an edit; returns the offset and length of the new code, or null when it could not be applied. */
  apply(project: GpuProject, edit: TaskEdit): { start: number; length: number } | null {
    const text = project.files.get(edit.file);
    if (text === undefined) return null;
    const at = text.indexOf(edit.find);
    if (at < 0 || edit.find.length === 0) return null;
    project.files.set(edit.file, text.slice(0, at) + edit.replace + text.slice(at + edit.find.length));
    return { start: at, length: edit.replace.length };
  },

  /** Whitespace collapsed, for "is this code already there" comparisons. */
  normalize(s: string): string {
    return trimNet(s.replace(WHITESPACE_RUN, " "));
  },
};

function trim(lines: string[]): string {
  let n = lines.length;
  while (n > 0 && lines[n - 1] === "") n--;
  return lines.slice(0, n).join("\n");
}

/** .NET's white space (char.IsWhiteSpace, Regex \s): JavaScript's \s also has U+FEFF and lacks U+0085. */
const WS = "\\t-\\r \\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const TRIM = new RegExp(`^[${WS}]+|[${WS}]+$`, "g");
/** Regex \s+ of .NET. */
export const WHITESPACE_RUN = new RegExp(`[${WS}]+`, "g");

/** string.Trim() of .NET. */
export function trimNet(s: string): string {
  return s.replace(TRIM, "");
}
