// The OpenGL course projects as Codestead.GP.Course builds them (GpCourse.StartProject, Edits.Parse / Apply), read from
// src/GP/content – for the reader's tests, until @codestead/gp-course has the real thing.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { GpuProject } from "../src/index.js";
import { Repo } from "./Repo.js";

export interface TaskEdit { file: string; find: string; replace: string }
export interface CourseTask { id: string; edits: TaskEdit[] }

const projects = (): string => join(Repo.content, "projects", "opengl");

/** GpCourse.IsAsset: binary files of a project (images, models), loaded as assets rather than code. */
const isAsset = (path: string): boolean => [".png", ".jpg", ".hdr", ".obj", ".mtl", ".otf", ".ttf", ".gltf", ".bin"].some((e) => path.toLowerCase().endsWith(e));

function filesUnder(dir: string): string[] {
  const list: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) list.push(...filesUnder(path));
    else list.push(path);
  }
  return list;
}

const fileName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

/** GpCourse.Order: main.cpp first, then headers, then vertex shaders, then the rest; ordinal by path within each. */
function rank(path: string): number {
  if (fileName(path) === "main.cpp") return 0;
  if (path.endsWith(".h")) return 1;
  if (path.includes("vert") || path.endsWith(".vs")) return 2;
  return 3;
}

/** The project a chapter starts with (start/). */
export function startProject(chapter: string): GpuProject {
  const dir = join(projects(), chapter, "start");
  const files = filesUnder(dir).map((f) => relative(dir, f).replaceAll("\\", "/"));
  const text = files.filter((f) => !isAsset(f)).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  const project = new GpuProject(text.map((f) => [f, readFileSync(join(dir, f), "utf8")] as [string, string]));
  for (const f of files.filter(isAsset)) project.assets.set(f, new Uint8Array(readFileSync(join(dir, f))));
  return project;
}

/** Edits.Parse: the tasks of an edits.txt / exercises.txt. */
export function parseEdits(text: string): CourseTask[] {
  const tasks: CourseTask[] = [];
  let file: string | null = null;
  let find: string[] | null = null, replace: string[] | null = null, current: string[] | null = null;
  const trimLines = (lines: string[]): string => {
    let n = lines.length;
    while (n > 0 && lines[n - 1] === "") n--;
    return lines.slice(0, n).join("\n");
  };
  const flush = (): void => {
    if (file !== null && find !== null && replace !== null && tasks.length > 0) tasks.at(-1)!.edits.push({ file, find: trimLines(find), replace: trimLines(replace) });
    file = null;
    find = replace = current = null;
  };
  for (const line of text.replaceAll("\r\n", "\n").split("\n")) {
    if (line.startsWith("=== task:")) {
      flush();
      tasks.push({ id: line.slice(9).trim(), edits: [] });
    } else if (line.startsWith("--- file:")) {
      flush();
      file = line.slice(9).trim();
    } else if (line.trim() === "--- find:") current = find = [];
    else if (line.trim() === "--- replace:") current = replace = [];
    else current?.push(line);
  }
  flush();
  return tasks;
}

const tasksIn = (chapter: string, file: string): CourseTask[] => {
  const path = join(projects(), chapter, file);
  return existsSync(path) ? parseEdits(readFileSync(path, "utf8")) : [];
};

/** Edits.Apply: replaces the first occurrence of the edit's text; false when it is not there. */
export function applyEdit(project: GpuProject, edit: TaskEdit): boolean {
  const text = project.files.get(edit.file);
  if (text === undefined) return false;
  const at = text.indexOf(edit.find);
  if (at < 0 || edit.find.length === 0) return false;
  project.files.set(edit.file, text.slice(0, at) + edit.replace + text.slice(at + edit.find.length));
  return true;
}

/** The chapter's finished program: the start project with every step's edits. */
export function solutionProject(chapter: string): GpuProject {
  const project = startProject(chapter);
  for (const task of tasksIn(chapter, "edits.txt")) for (const e of task.edits) applyEdit(project, e);
  return project;
}

/** An exercise: the chapter's finished program with the exercise's edits. */
export function exerciseProject(chapter: string, exercise: string): GpuProject {
  const project = solutionProject(chapter);
  const task = tasksIn(chapter, "exercises.txt").find((t) => t.id === exercise);
  if (task === undefined) throw new Error(`no exercise ${exercise} in ${chapter}`);
  for (const e of task.edits) if (!applyEdit(project, e)) throw new Error(`${chapter}/${exercise}: the edit's 'find' text is not in ${e.file}`);
  return project;
}

/** "chapter/start", "chapter/solution" or "chapter/ex-…". */
export function courseProject(id: string): GpuProject {
  const [chapter, which] = id.split("/") as [string, string];
  return which === "start" ? startProject(chapter) : which === "solution" ? solutionProject(chapter) : exerciseProject(chapter, which);
}
