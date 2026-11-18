// The files "Save resources…" and "Save my earlier code…" write (C#'s GpTool.Files.cs: Resources, IsData and
// SaveOldCode's project). Used by the window (is there anything to save?) and by the course worker (the bytes).

import { GpCourse } from "@codestead/gp-course";
import { GpuProject } from "@codestead/gp-gpu";
import type { FilesToSave } from "./CourseHost.js";

/** Path.GetExtension of a path with '/' (or '\'). */
function extension(path: string): string {
  const name = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot);
}

function fileName(path: string): string {
  return path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
}

/** Text files of the course's own that are data, not code: levels, licences, the LTC fit tables. */
export function isData(path: string): boolean {
  const ext = extension(path);
  return ext === ".lvl" || ext === ".txt" || fileName(path) === "ltc_matrix.hpp";
}

/**
 * The chapter's files of the course's own: textures, models, fonts (with their licences), levels and data tables –
 * no code. (In the window the binary files' bytes are not read: only their names count there.)
 */
export function resources(chapter: string, api: string): GpuProject {
  const result = new GpuProject();
  if (chapter === "") return result;
  const start = GpCourse.startProject(chapter, api);
  for (const [name, bytes] of start.assets) result.assets.set(name, bytes);
  const encoder = new TextEncoder();
  for (const [name, text] of start.files) if (isData(name)) result.assets.set(name, encoder.encode(text));
  return result;
}

/** The project of a {@link FilesToSave}: the resources, or the old editor's code with the chapter's binary files. */
export function projectToSave(files: FilesToSave): GpuProject {
  if (files.kind === "resources") return resources(files.chapter, files.api);
  const project = new GpuProject(Object.entries(files.files));
  for (const [name, bytes] of GpCourse.startProject(files.chapter, files.api).assets) project.assets.set(name, bytes);
  return project;
}
