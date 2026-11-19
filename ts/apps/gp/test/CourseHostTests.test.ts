// The course's work outside the window (electron/CourseService.ts, run by the app's worker thread) and what crosses
// from the worker to the window (src/CourseHost.ts): a check's report keeps its classes, a picture its pixels.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { BuildFacts, GpCourse, StartFiles } from "@codestead/gp-course";
import { afterAll, describe, expect, it } from "vitest";
import { CourseService } from "../electron/CourseService.js";
import { reportFromData } from "../src/CourseHost.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codestead-gp-host-"));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("CourseHostTests", () => {
  it("en kontroll går över som data och blir en CheckReport med BuildFacts igen", () => {
    StartFiles.copy(dir, GpCourse.solutionProject("hello-triangle", "opengl"));
    const data = CourseService.check(path.join(dir, "main.cpp"), "hello-triangle", "opengl");
    // Plain data: a structured clone keeps all of it.
    expect(structuredClone(data)).toEqual(data);
    const report = reportFromData(structuredClone(data));
    expect(report.chapterId).toBe("hello-triangle");
    expect(report.passedKeys).toEqual(data.tasks.filter((t) => t.passed).map((t) => t.key));
    expect(report.passedKeys.length).toBe(GpCourse.tasks("hello-triangle", "opengl").length);
    expect(report.facts).toBeInstanceOf(BuildFacts);
    expect(report.facts!.succeeded).toBe(true);
    expect(report.facts!.names).toContain("glBindVertexArray");
    expect(report.facts!.firstWords).toEqual(["build"]);
    // Every fact the achievements look at crosses over (the worker's BuildFacts and the window's are the same).
    const { names, firstWords, ...init } = data.facts!;
    expect(report.facts!.init).toEqual(init);
    expect([...report.facts!.names]).toEqual(names);
    expect([...report.facts!.firstWords]).toEqual(firstWords);
    expect(report.facts!.windowTitle).toBe("LearnOpenGL");
    expect([report.facts!.windowWidth, report.facts!.windowHeight]).toEqual([800, 600]);
    expect(report.facts!.triangles).toBe(2);
    expect(report.facts!.drawnPixels).toBeGreaterThan(0);
  });

  it("en kontroll av en fil som saknas säger vilka filer som inte hittades", () => {
    const report = reportFromData(CourseService.check(path.join(dir, "nothing", "main.cpp"), "hello-triangle", "opengl"));
    expect(report.passedKeys).toEqual([]);
    expect(report.messages[0]!.key).toBe("ide.missing");
    expect(report.messages[0]!.args.get("files")).toContain("main.cpp");
  });

  it("det förväntade resultatet: BGRA-pixlar i den begärda bredden, eller varför det inte finns någon bild", () => {
    const drawn = CourseService.draw("hello-triangle", "opengl", 5, 64);
    expect(drawn.message).toBe("");
    expect(drawn.width).toBe(64);
    expect(drawn.pixels!.length).toBe(drawn.width * drawn.height * 4);
    const none = CourseService.draw("creating-a-window", "opengl", 0, 64);
    expect(none.pixels).toBeNull();
    expect(none.message).toMatch(/^expected\./);
  });

  it("kursens bilder, modeller och typsnitt går att läsa", () => {
    expect(CourseService.smokeAssets()).toBeGreaterThan(0);
  });
});
