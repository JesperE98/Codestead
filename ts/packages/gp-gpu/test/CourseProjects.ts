// The course's projects for the reader tests, read from src/GP/content/projects the way C#'s GpCourse does
// (StartProject, SolutionProject, Exercises; Edits.Parse / Apply). A small stand-in until gp-course ports GpCourse.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { GpuProject } from "../src/index.js";
import { Repo } from "./Repo.js";

export interface TaskEdit {
  file: string;
  find: string;
  replace: string;
}

export interface CourseTask {
  id: string;
  edits: TaskEdit[];
}

const AssetExtensions = [".png", ".jpg", ".hdr", ".obj", ".mtl", ".otf", ".ttf", ".gltf", ".bin"];

/** GpCourse.IsAsset: binary files (images, models), loaded as assets rather than code. */
export function isAsset(path: string): boolean {
  const lower = path.toLowerCase();
  return AssetExtensions.some((e) => lower.endsWith(e));
}

function projectDir(api: string, chapter: string): string {
  return join(Repo.content, "projects", api, chapter);
}

function listFiles(dir: string, prefix = ""): string[] {
  const list: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) list.push(...listFiles(full, prefix + name + "/"));
    else list.push(prefix + name);
  }
  return list;
}

/** StreamReader(UTF-8) without a BOM, CRLF → LF (Resources.Read). */
function readText(path: string): string {
  let text = readFileSync(path, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text.replaceAll("\r\n", "\n");
}

const ordinal = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** main.cpp first, then headers, then shaders – the order of the editor's tabs (GpCourse.Order). */
function rank(key: string): number {
  const file = key.slice(key.lastIndexOf("/") + 1);
  return file === "main.cpp" ? 0 : key.endsWith(".h") ? 1 : key.includes("vert") || key.endsWith(".vs") ? 2 : 3;
}

/** The project a chapter starts with for an API (every Vulkan chapter has its own start/). */
export function startProject(api: string, chapter: string): GpuProject {
  const dir = join(projectDir(api, chapter), "start");
  if (!existsSync(dir)) throw new Error(`no start project for ${api}/${chapter}`);
  const files = listFiles(dir).sort(ordinal);
  const text = files.filter((f) => !isAsset(f)).sort((a, b) => rank(a) - rank(b) || ordinal(a, b));
  const project = new GpuProject(text.map((f) => [f, readText(join(dir, f))] as [string, string]));
  for (const f of files.filter(isAsset)) project.assets.set(f, new Uint8Array(readFileSync(join(dir, f))));
  return project;
}

/** Edits.Parse: the tasks of an edits.txt / exercises.txt. */
export function parseEdits(text: string): CourseTask[] {
  const tasks: CourseTask[] = [];
  let file: string | null = null;
  let find: string[] | null = null, replace: string[] | null = null, current: string[] | null = null;
  const trim = (lines: string[]): string => {
    let n = lines.length;
    while (n > 0 && lines[n - 1] === "") n--;
    return lines.slice(0, n).join("\n");
  };
  const flush = (): void => {
    if (file !== null && find !== null && replace !== null && tasks.length > 0) tasks[tasks.length - 1]!.edits.push({ file, find: trim(find), replace: trim(replace) });
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
    else (current as string[] | null)?.push(line);
  }
  flush();
  return tasks;
}

function tasksIn(api: string, chapter: string, name: string): CourseTask[] {
  const path = join(projectDir(api, chapter), name);
  return existsSync(path) ? parseEdits(readText(path)) : [];
}

/** The steps of a chapter (edits.txt). */
export function tasks(api: string, chapter: string): CourseTask[] {
  return tasksIn(api, chapter, "edits.txt");
}

/** The exercises of a chapter (exercises.txt): each changes the finished program on its own. */
export function exercises(api: string, chapter: string): CourseTask[] {
  return tasksIn(api, chapter, "exercises.txt");
}

/** Edits.Apply: false when the edit's find text is not there. */
export function applyEdit(project: GpuProject, edit: TaskEdit): boolean {
  const text = project.files.get(edit.file);
  if (text === undefined) return false;
  const at = text.indexOf(edit.find);
  if (at < 0 || edit.find.length === 0) return false;
  project.files.set(edit.file, text.slice(0, at) + edit.replace + text.slice(at + edit.find.length));
  return true;
}

/** The chapter's finished program: the start project with every step's edits. */
export function solutionProject(api: string, chapter: string): GpuProject {
  const project = startProject(api, chapter);
  for (const t of tasks(api, chapter)) for (const e of t.edits) applyEdit(project, e);
  return project;
}

/** The chapter's finished program with one exercise's edits. */
export function exerciseProject(api: string, chapter: string, exercise: string): GpuProject {
  const project = solutionProject(api, chapter);
  const ex = exercises(api, chapter).find((x) => x.id === exercise);
  if (ex === undefined) throw new Error(`no exercise ${exercise} in ${api}/${chapter}`);
  for (const e of ex.edits) applyEdit(project, e);
  return project;
}
