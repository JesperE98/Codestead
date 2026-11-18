// IdeTests.cs: "Your project" – the reader that finds the learner's files from the main file they picked, in a
// structure of their own, and the checker that runs the course's checks on them.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Apis } from "@codestead/gp-gpu";
import { MemoryStorage } from "@codestead/ui";
import { afterEach, beforeEach, describe, expect } from "vitest";
import { ExpectedResult, GpCourse, MainFiles, ProjectChecker, ProjectReader, StartFiles } from "../src/index.js";
import { itNeeds } from "./Repo.js";

const T0 = new Date(Date.UTC(2026, 10, 1, 12, 0, 0));
const ordinal = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const sortedKeys = (m: Map<string, string>): string[] => [...m.keys()].sort(ordinal);

// The checker builds, runs and renders the chapter for every task: seconds, not milliseconds.
describe("IdeTests", { timeout: 120_000 }, () => {
  let dir = "";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "codestead-gp-ide-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function write(relative: string, text: string, time: Date): string {
    const path = join(dir, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
    utimesSync(path, time, time);
    return path;
  }

  itNeeds([Apis.OpenGL], "läsaren hittar kapitlets filer, även med annat namn på huvudfilen, och inte biblioteken", () => {
    const start = GpCourse.startProject("hello-triangle", Apis.OpenGL);
    const main = start.mainFile;
    // Visual Studio names the main file after the project; GLAD's and stb's files are libraries.
    write("src/HelloTriangle.cpp", start.files.get(main)!, T0);
    write("include/glad/glad.c", "int main() { }", T0);
    write("build/main.cpp", "// a copy in the build folder", T0);
    for (const [path, text] of [...start.files].filter(([k]) => k !== main)) write("src/" + path, text, T0);
    const read = ProjectReader.read(dir, "hello-triangle", Apis.OpenGL);
    expect(read.missing).toEqual([]);
    expect(read.project.files.get(main)).toBe(start.files.get(main));
    expect(sortedKeys(read.project.files)).toEqual(sortedKeys(start.files));
  });

  itNeeds([Apis.OpenGL], "från huvudfilen: filerna bredvid den, under den eller i mappen ovanför, i en egen mappstruktur", () => {
    const start = GpCourse.startProject("textures", Apis.OpenGL);
    const main = start.mainFile;
    expect(start.files.size > 1, "textures has shaders").toBe(true);
    // The learner's own layout: one folder for the course, the chapter's code in src/04-textures.cpp, its shaders
    // in a folder beside src/; another chapter's main.cpp next to it is not read.
    const file = write("course/src/04-textures.cpp", start.files.get(main)!, T0);
    write("course/src/main.cpp", "int main() { return 1; }", T0);
    for (const [path, text] of [...start.files].filter(([k]) => k !== main)) write("course/" + path, text, T0);
    const read = ProjectReader.readFrom(file, "textures", Apis.OpenGL);
    expect(read.missing).toEqual([]);
    expect(read.project.files.get(main)).toBe(start.files.get(main));
    expect(sortedKeys(read.project.files)).toEqual(sortedKeys(start.files));
    // The check passes the same tasks as for the course's own layout.
    const report = ProjectChecker.check(file, "textures", Apis.OpenGL);
    expect(report.messages.some((m) => m.isError)).toBe(false);
  });

  itNeeds([], "startfilerna kopieras, och konflikter syns", () => {
    const start = GpCourse.startProject("textures", Apis.OpenGL);
    expect(StartFiles.conflicts(dir, start)).toEqual([]);
    const n = StartFiles.copy(dir, start);
    expect(n).toBe(start.files.size + start.assets.size);
    expect(StartFiles.conflicts(dir, start)).toEqual([]);
    writeFileSync(join(dir, start.mainFile), "// changed");
    expect(StartFiles.conflicts(dir, start)).toEqual([start.mainFile]);
  });

  itNeeds([Apis.OpenGL], "kontrollen: startprojektet löser inte alla uppgifter, lösningen löser alla", () => {
    const chapter = "hello-triangle";
    const api = Apis.OpenGL;
    const count = GpCourse.tasks(chapter, api).length;
    StartFiles.copy(dir, GpCourse.startProject(chapter, api));
    const main = join(dir, GpCourse.startProject(chapter, api).mainFile);
    const start = ProjectChecker.check(main, chapter, api);
    expect(start.tasks.length).toBe(count + GpCourse.exercises(chapter, api).length);
    expect(start.tasks.some((t) => !t.passed)).toBe(true);
    expect(start.facts).not.toBeNull();
    StartFiles.copy(dir, ExpectedResult.project(chapter, api, count - 1));
    const solved = ProjectChecker.check(main, chapter, api);
    // Every step is solved; the exercises are changes of their own to the finished program.
    for (const t of solved.tasks.filter((t) => !GpCourse.isExercise(t.taskId))) expect(t.passed, t.taskId).toBe(true);
    expect(solved.tasks.some((t) => GpCourse.isExercise(t.taskId))).toBe(true);
    expect(solved.messages).toEqual([]);
  });

  itNeeds([Apis.OpenGL], "kontrollen säger vad som är fel när koden inte går att läsa", () => {
    StartFiles.copy(dir, GpCourse.startProject("hello-triangle", Apis.OpenGL));
    const main = join(dir, "main.cpp");
    writeFileSync(main, readFileSync(main, "utf8").replaceAll("glClear(", "glClaer("));
    const report = ProjectChecker.check(main, "hello-triangle", Apis.OpenGL);
    for (const t of report.tasks) expect(t.passed).toBe(false);
    expect(report.messages.some((m) => m.key === "ide.buildFailed" && m.isError)).toBe(true);
    unlinkSync(main);
    const missing = ProjectChecker.check(main, "hello-triangle", Apis.OpenGL);
    expect(missing.messages.some((m) => m.key === "ide.missing" && (m.args.get("files") ?? "").includes("main.cpp"))).toBe(true);
  });

  for (const api of Apis.all)
    itNeeds([api.id], `förväntat resultat: varje uppgifts lösning visar en bild (${api.id})`, () => {
      for (let i = 0; i < GpCourse.tasks("hello-triangle", api.id).length; i++)
        expect(ExpectedResult.scene("hello-triangle", api.id, i)?.showsFrames === true, `${api.id} task ${i}`).toBe(true);
    });

  itNeeds([], "huvudfilerna sparas per kapitel och API, och den gamla appens mappar används tills en fil valts", () => {
    // Not in C#'s tests (MainFiles is the C# app's): mainfiles.json and folders.json as the C# app reads and writes them.
    const storage = new MemoryStorage();
    write("old/hello-window/main.cpp", "int main() { }", T0);
    storage.saveText("folders", JSON.stringify({ folders: { "opengl/hello-window": join(dir, "old", "hello-window") } }));
    const files = new MainFiles(storage);
    expect(files.get("opengl", "hello-window", "main.cpp")).toBe(join(dir, "old", "hello-window", "main.cpp"));
    expect(files.get("vulkan", "hello-window", "main.cpp")).toBeNull();
    expect(files.lastFolder).toBeNull();
    const picked = write("mine/window.cpp", "int main() { }", T0);
    files.set("opengl", "hello-window", picked);
    expect(files.get("opengl", "hello-window", "main.cpp")).toBe(picked);
    expect(files.lastFolder).toBe(join(dir, "mine"));
    expect(JSON.parse(storage.loadText("mainfiles")!)).toEqual({ files: { "opengl/hello-window": picked }, lastFolder: join(dir, "mine") });
    expect(new MainFiles(storage).get("opengl", "hello-window", "main.cpp")).toBe(picked);
  });
});
