import { Languages } from "@codestead/common";
import { Apis, GpuProject } from "@codestead/gp-gpu";
import { ChapterKinds, CourseChapter, CourseOutline, OutlinePart } from "@codestead/learning";
import type { CourseTask } from "./CourseTask.js";
import { Edits } from "./Edits.js";
import * as Resources from "./Resources.js";

const parts: readonly string[] = ["start", "getting-started", "lighting", "model-loading", "advanced-opengl", "advanced-lighting", "pbr", "in-practice", "guest-articles"];

/** The lessons in course order: (chapter id, part). */
const lessonList: readonly (readonly [id: string, part: string])[] = [
  ["introduction", "start"],
  ["api", "getting-started"],
  ["ide-setup", "getting-started"],
  ["creating-a-window", "getting-started"],
  ["hello-window", "getting-started"],
  ["hello-triangle", "getting-started"],
  ["shaders", "getting-started"],
  ["textures", "getting-started"],
  ["transformations", "getting-started"],
  ["coordinate-systems", "getting-started"],
  ["camera", "getting-started"],
  ["colors", "lighting"],
  ["basic-lighting", "lighting"],
  ["materials", "lighting"],
  ["lighting-maps", "lighting"],
  ["light-casters", "lighting"],
  ["multiple-lights", "lighting"],
  ["assimp", "model-loading"],
  ["mesh", "model-loading"],
  ["model", "model-loading"],
  ["depth-testing", "advanced-opengl"],
  ["stencil-testing", "advanced-opengl"],
  ["blending", "advanced-opengl"],
  ["face-culling", "advanced-opengl"],
  ["framebuffers", "advanced-opengl"],
  ["cubemaps", "advanced-opengl"],
  ["advanced-data", "advanced-opengl"],
  ["advanced-glsl", "advanced-opengl"],
  ["geometry-shader", "advanced-opengl"],
  ["instancing", "advanced-opengl"],
  ["anti-aliasing", "advanced-opengl"],
  ["advanced-lighting", "advanced-lighting"],
  ["gamma-correction", "advanced-lighting"],
  ["shadow-mapping", "advanced-lighting"],
  ["point-shadows", "advanced-lighting"],
  ["normal-mapping", "advanced-lighting"],
  ["parallax-mapping", "advanced-lighting"],
  ["hdr", "advanced-lighting"],
  ["bloom", "advanced-lighting"],
  ["deferred-shading", "advanced-lighting"],
  ["ssao", "advanced-lighting"],
  ["pbr-theory", "pbr"],
  ["pbr-lighting", "pbr"],
  ["diffuse-irradiance", "pbr"],
  ["specular-ibl", "pbr"],
  ["debugging", "in-practice"],
  ["text-rendering", "in-practice"],
  ["game-intro", "in-practice"],
  ["game-setup", "in-practice"],
  ["rendering-sprites", "in-practice"],
  ["levels", "in-practice"],
  ["ball", "in-practice"],
  ["collision-detection", "in-practice"],
  ["collision-resolution", "in-practice"],
  ["particles", "in-practice"],
  ["postprocessing", "in-practice"],
  ["powerups", "in-practice"],
  ["audio", "in-practice"],
  ["render-text", "in-practice"],
  ["final-thoughts", "in-practice"],
  ["oit-introduction", "guest-articles"],
  ["weighted-blended", "guest-articles"],
  ["skeletal-animation", "guest-articles"],
  ["scene-graph", "guest-articles"],
  ["frustum-culling", "guest-articles"],
  ["csm", "guest-articles"],
  ["tessellation-height-map", "guest-articles"],
  ["tessellation", "guest-articles"],
  ["dsa", "guest-articles"],
  ["physically-based-bloom", "guest-articles"],
  ["compute-shaders", "guest-articles"],
  ["area-lights", "guest-articles"],
];

function build(): CourseChapter[] {
  const list: CourseChapter[] = [];
  for (const part of parts) {
    list.push(...lessonList.filter(([, p]) => p === part).map(([id]) => new CourseChapter(id, part, ChapterKinds.Lesson)));
    for (const kind of [ChapterKinds.Summary, ChapterKinds.Exam, ChapterKinds.Project])
      if (Resources.read(`chapters/en/${part}-${kind}.md`) !== null) list.push(new CourseChapter(`${part}-${kind}`, part, kind));
  }
  return list;
}

let chapters: readonly CourseChapter[] | null = null;
let outline: CourseOutline | null = null;
const taskCache = new Map<string, CourseTask[]>();
const exerciseCache = new Map<string, CourseTask[]>();

/** Binary files of a project (images, models: OBJ + MTL, glTF + its .bin), loaded as assets rather than code. */
const assetExtensions = [".png", ".jpg", ".hdr", ".obj", ".mtl", ".otf", ".ttf", ".gltf", ".bin"];

/** Path.GetFileName of a path with forward slashes. */
const fileName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

/** main.cpp first, then headers, then shaders – the order of the editor's tabs (OrderBy rank, ThenBy path, ordinal). */
function order(files: [string, string][]): [string, string][] {
  const rank = (k: string): number => (fileName(k) === "main.cpp" ? 0 : k.endsWith(".h") ? 1 : k.includes("vert") || k.endsWith(".vs") ? 2 : 3);
  return [...files].sort(([a], [b]) => rank(a) - rank(b) || Resources.ordinal(a, b));
}

/**
 * The Codestead GP course: learnopengl.com's structure, section by section, for OpenGL, Vulkan and DirectX 12.
 * Parts and lessons are listed here in course order; each part ends with a summary and an exam when their texts
 * exist (chapters/en/&lt;part&gt;-summary.md and -exam.md), and then an optional project (-project.md): a brief whose
 * milestones are tasks like a lesson's (projects/&lt;api&gt;/&lt;part&gt;-project/: its own start/, edits.txt and solution/).
 */
export const GpCourse = {
  parts,

  get chapters(): readonly CourseChapter[] {
    return (chapters ??= build());
  },

  chapter(id: string): CourseChapter {
    return GpCourse.chapters.find((c) => c.id === id) ?? GpCourse.chapters[0]!;
  },

  lessonsIn(part: string): readonly CourseChapter[] {
    return GpCourse.chapters.filter((c) => c.part === part && c.isLesson);
  },

  get outline(): CourseOutline {
    return (outline ??= new CourseOutline(
      parts.map(
        (p) =>
          new OutlinePart(
            p,
            GpCourse.lessonsIn(p).map((l) => l.id),
            GpCourse.chapters.some((c) => c.part === p && c.kind === ChapterKinds.Exam),
            GpCourse.chapters.some((c) => c.part === p && c.isProject),
          ),
      ),
    ));
  },

  /** The progress key of a task for an API: "hello-window/clear@vulkan". */
  taskKey(chapterId: string, taskId: string, api: string): string {
    return `${chapterId}/${taskId}@${api}`;
  },

  /** The tasks of a chapter for an API (none for summaries and exams; a project's milestones). */
  tasks(chapterId: string, api: string): readonly CourseTask[] {
    const key = `${api}/${chapterId}`;
    let tasks = taskCache.get(key);
    if (tasks === undefined) {
      const text = Resources.read(`projects/${api}/${chapterId}/edits.txt`);
      taskCache.set(key, (tasks = text !== null ? Edits.parse(text) : []));
    }
    return tasks;
  },

  /** The id prefix of a chapter's exercises ("ex-two-triangles"): small tasks of their own after the steps. */
  ExercisePrefix: "ex-",

  isExercise(taskId: string): boolean {
    return taskId.startsWith(GpCourse.ExercisePrefix);
  },

  /**
   * A chapter's exercises for an API (projects/&lt;api&gt;/&lt;chapter&gt;/exercises.txt): each one changes the chapter's
   * finished program on its own, not the exercise before it.
   */
  exercises(chapterId: string, api: string): readonly CourseTask[] {
    const key = `${api}/${chapterId}`;
    let exercises = exerciseCache.get(key);
    if (exercises === undefined) {
      const text = Resources.read(`projects/${api}/${chapterId}/exercises.txt`);
      exerciseCache.set(key, (exercises = text !== null ? Edits.parse(text) : []));
    }
    return exercises;
  },

  /** The steps of a chapter followed by its exercises: what the learner ticks, in order. */
  allTasks(chapterId: string, api: string): readonly CourseTask[] {
    return [...GpCourse.tasks(chapterId, api), ...GpCourse.exercises(chapterId, api)];
  },

  /** The chapter's finished program: the start project with every step's edits. */
  solutionProject(chapterId: string, api: string): GpuProject {
    const project = GpCourse.startProject(chapterId, api);
    for (const edit of GpCourse.tasks(chapterId, api).flatMap((t) => t.edits)) Edits.apply(project, edit);
    return project;
  },

  /** The project a chapter starts with for an API (a lesson without its own project uses the previous one's). */
  startProject(chapterId: string, api: string): GpuProject {
    const list = GpCourse.chapters;
    for (let i = list.findIndex((c) => c.id === chapterId); i >= 0; i--) {
      const prefix = `projects/${api}/${list[i]!.id}/start/`;
      const files = Resources.list(prefix);
      if (files.length === 0) continue;
      const text = files.filter((f) => !GpCourse.isAsset(f));
      const project = new GpuProject(order(text.map((f) => [f.slice(prefix.length), Resources.read(f) ?? ""])));
      for (const f of files.filter((f) => GpCourse.isAsset(f))) project.assets.set(f.slice(prefix.length), Resources.readBytes(f) ?? new Uint8Array(0));
      return project;
    }
    return new GpuProject([["main.cpp", ""]]);
  },

  /**
   * A picture of the chapters' texts ("images/pipeline.webp"): the one for the language (images/sv/pipeline.webp)
   * if there is one, else the shared one. Null when there is none.
   */
  picture(path: string, lang: string): Uint8Array | null {
    const prefix = "images/";
    if (!path.startsWith(prefix) || path.includes("..")) return null;
    const name = path.slice(prefix.length);
    for (const l of Languages.fallbackChain(lang)) {
      const own = Resources.readBytes(`${prefix}${l}/${name}`);
      if (own !== null) return own;
    }
    return Resources.readBytes(path);
  },

  isAsset(path: string): boolean {
    const lower = path.toLowerCase();
    return assetExtensions.some((e) => lower.endsWith(e));
  },

  /** The API functions a chapter's solutions use, in order (shown when the chapter is done). */
  functions(chapterId: string, api: string): readonly string[] {
    const names: string[] = [];
    const re =
      api === Apis.Vulkan
        ? /\b(vk[A-Z]\w*|glfw[A-Z]\w*)\s*\(/g
        : api === Apis.D3D12
          ? /(?:->|\b)(D3D12\w+|CreateDXGIFactory\w*|D3DCompileFromFile|Create\w+|Clear\w+|Draw\w+|IASet\w+|RSSet\w+|OMSet\w+|Present|ResourceBarrier|ExecuteCommandLists|Signal|SetGraphicsRoot\w+)\s*\(/g
          : /\b(gl[A-Z]\w*|glfw[A-Z]\w*|gladLoadGLLoader)\s*\(/g;
    for (const task of GpCourse.tasks(chapterId, api))
      for (const edit of task.edits)
        for (const m of edit.replace.matchAll(re)) {
          const name = m[1]!;
          if (!names.includes(name) && !edit.find.includes(name + "(")) names.push(name);
        }
    return names;
  },

  /** Fetches a chapter's binary start files and pictures where there is no node:fs (a browser renderer). */
  preload(prefix: string): Promise<void> {
    return Resources.preloadBytes(prefix);
  },
};
