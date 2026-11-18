// IdeBlockTests.cs: ":::ide" blocks in the texts – alone or inside API blocks, text outside them for every IDE.
import { Apis } from "@codestead/gp-gpu";
import { describe, expect, it } from "vitest";
import { CourseText, Ides } from "../src/index.js";

const Text = `Everyone.
:::ide vs rider
Solution route.
:::
:::opengl
OpenGL for all.
:::ide clion vscode
OpenGL with CMake.
:::
OpenGL again.
:::
:::vulkan d3d12
Not OpenGL.
:::
The end.`;

describe("IdeBlockTests", () => {
  it("IDE-block visas bara för sina IDE:er, även inuti API-block", () => {
    const clion = CourseText.preprocess(Text, Apis.OpenGL, Ides.CLion);
    expect(clion).toContain("Everyone.");
    expect(clion).not.toContain("Solution route.");
    expect(clion).toContain("OpenGL for all.");
    expect(clion).toContain("OpenGL with CMake.");
    expect(clion).toContain("OpenGL again.");
    expect(clion).not.toContain("Not OpenGL.");
    expect(clion).toContain("The end.");
    expect(clion).not.toContain(":::");

    const vs = CourseText.preprocess(Text, Apis.OpenGL, Ides.VisualStudio);
    expect(vs).toContain("Solution route.");
    expect(vs).not.toContain("OpenGL with CMake.");
    expect(vs).toContain("OpenGL again.");

    const vulkanRider = CourseText.preprocess(Text, Apis.Vulkan, Ides.Rider);
    expect(vulkanRider).toContain("Solution route.");
    expect(vulkanRider).not.toContain("OpenGL for all.");
    expect(vulkanRider).toContain("Not OpenGL.");

    // No IDE: every IDE's steps (the questions are counted this way).
    const all = CourseText.preprocess(Text, Apis.OpenGL);
    expect(all).toContain("Solution route.");
    expect(all).toContain("OpenGL with CMake.");
  });

  it("ett utelämnat block skiljer styckena runt det åt", () => {
    const shown = CourseText.preprocess("Before.\n:::ide vs\nOnly VS.\n:::\nAfter.", Apis.OpenGL, Ides.CLion);
    expect(shown).toBe("Before.\n\nAfter.");
  });

  it("standard-IDE: Visual Studio på Windows, annars CLion", () => {
    expect(Ides.default).toBe(process.platform === "win32" ? "vs" : "clion");
  });
});
