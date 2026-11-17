// The OpenGL reader (GlReader.cs and its parts, CppStatements.cs). C# tests it through the course (TaskTests,
// SimulatorTests: gp-course ports them); here: what the reader makes of small changes to a course program, its
// statement walker, and a representative set of chapters rendered and compared with the frames C#'s reader and
// rasterizer make (the hashes below were printed by C#: SHA-256 of the 160-pixel-wide frame's BGRA bytes, first 16 hex
// digits, at the times the course's checks read them).
import { describe, expect, it } from "vitest";
import {
  Apis, CppSource, CppStatements, GlReader, GpuProject, NoteLevel, Rasterizer, Simulator, Topology, type Scene,
} from "../src/index.js";
import { std140 } from "../src/Readers/GlReader.Advanced.js";
import { sha256Hex } from "../src/internal/sha256.js";
import { courseProject, solutionProject } from "./GlCourse.js";

/** The hello-triangle chapter's finished program with some text replaced. */
function triangle(...changes: [string, string][]): GpuProject {
  const p = solutionProject("hello-triangle");
  let text = p.files.get("main.cpp")!;
  for (const [from, to] of changes) {
    expect(text).toContain(from);
    text = text.replace(from, to);
  }
  p.files.set("main.cpp", text);
  return p;
}

const read = (p: GpuProject, time = 1.0): Scene => GlReader.read(p, time);
const keys = (s: Scene): string[] => s.notes.map((n) => n.key);
const frameHash = (s: Scene, time = 1.0): string => sha256Hex(Rasterizer.render(s, 160, time).pixels).slice(0, 16).toLowerCase();

describe("CppStatements", () => {
  const walk = (body: string) => CppStatements.walk(new CppSource("main.cpp", `int main()\n{\n${body}\n}\n`), "main");

  it("går igenom satserna i ordning och markerar renderingsloopen (villkoret behålls som en sats)", () => {
    const list = walk("int a = 1;\nglfwInit();\nwhile (!glfwWindowShouldClose(window))\n{\n  glClear(GL_COLOR_BUFFER_BIT);\n  glfwSwapBuffers(window);\n}\nreturn 0;");
    expect(list.map((s) => [s.kind, s.text])).toEqual([
      ["stmt", "int a = 1"], ["stmt", "glfwInit()"], ["stmt", "!glfwWindowShouldClose(window)"], ["loop-start", ""], ["stmt", "glClear(GL_COLOR_BUFFER_BIT)"], ["stmt", "glfwSwapBuffers(window)"], ["loop-end", ""], ["stmt", "return 0"],
    ]);
  });

  it("en if kommer med båda grenarna; en felgren tas inte, men dess else gör det", () => {
    const list = walk("if (cubeVAO == 0) { glGenVertexArrays(1, &cubeVAO); } else { x = 2; }\nif (!ok) { std::cout << 1; return -1; } else { y = 3; }");
    expect(list[0]!.kind).toBe("if");
    expect(list[0]!.text).toBe("cubeVAO == 0");
    expect(list[0]!.body!.map((s) => s.text)).toEqual(["glGenVertexArrays(1, &cubeVAO)"]);
    expect(list[0]!.else_!.map((s) => s.text)).toEqual(["x = 2"]);
    expect(list.slice(1).map((s) => [s.kind, s.text])).toEqual([["stmt", "!ok"], ["stmt", "y = 3"]]);
  });

  it("en for-loop kommer med sitt huvud, sin kropp och var den slutar; do-while hoppas över", () => {
    const code = "for (int i = 0; i < 3; i++)\n  draw(i);\ndo { k++; } while (k < 3);\nz = 1;";
    const list = walk(code);
    expect(list[0]!.kind).toBe("for");
    expect(list[0]!.text).toBe("int i = 0; i < 3; i++");
    expect(list[0]!.body!.map((s) => s.text)).toEqual(["draw(i)"]);
    const src = new CppSource("main.cpp", `int main()\n{\n${code}\n}\n`);
    expect(src.code.slice(list[0]!.offset, list[0]!.end)).toBe("for (int i = 0; i < 3; i++)\n  draw(i);");
    expect(list.slice(1).map((s) => s.text)).toEqual(["z = 1"]);
  });

  it("en annan while-loop kommer med sitt villkor och sin kropp", () => {
    const list = walk("while (std::getline(file, line)) { n++; }");
    expect(list.map((s) => [s.kind, s.text, s.body?.map((b) => b.text)])).toEqual([["while", "std::getline(file, line)", ["n++"]]]);
  });
});

describe("GlReader", () => {
  it("registreras för OpenGL och läser kapitlets program", () => {
    const scene = Simulator.read(solutionProject("hello-triangle"), Apis.OpenGL, 1.0);
    expect(scene.api).toBe(Apis.OpenGL);
    expect(scene.showsFrames).toBe(true);
    expect(scene.windowTitle).toBe("LearnOpenGL");
    expect([scene.width, scene.height]).toEqual([800, 600]);
    expect(scene.clearColor).toEqual([0.2, 0.3, 0.3, 1]);
    expect(scene.notes).toEqual([]);
    expect(scene.draws).toHaveLength(1);
    const draw = scene.draws[0]!;
    expect(draw.indices).toEqual([0, 1, 3, 1, 2, 3]);
    expect(draw.vertices.map((v) => v.get("0")!.v)).toEqual([[0.5, 0.5, 0], [0.5, -0.5, 0], [-0.5, -0.5, 0], [-0.5, 0.5, 0]]);
    expect(draw.topology).toBe(Topology.Triangles);
    const frame = Rasterizer.render(scene, 160);
    expect(frame.atRelative(0.5, 0.5).map((c) => Math.round(c * 100) / 100)).toEqual([1, 0.5, 0.2, 1]);
  });

  it("utan main finns inget att köra", () => {
    expect(keys(read(new GpuProject([["main.cpp", "int helper() { return 1; }"]])))).toEqual(["noMain"]);
  });

  it("utan glfwInit öppnas inget fönster", () => {
    const scene = read(triangle(["    glfwInit();\n", ""]));
    expect(scene.windowCreated).toBe(false);
    expect(keys(scene)).toEqual(["glfwInitMissing", "noWindow"]);
  });

  it("ett OpenGL-anrop innan GLAD har laddats kraschar programmet (en gång, med rad)", () => {
    const p = triangle(["if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))", "if (false)"]);
    const scene = read(p);
    const note = scene.notes.find((n) => n.key === "gladMissing")!;
    expect(note.level).toBe(NoteLevel.Error);
    expect(note.args.get("call")).toBe("glCreateShader");
    const line = p.files.get("main.cpp")!.split("\n").findIndex((l) => l.includes("glCreateShader(GL_VERTEX_SHADER)")) + 1;
    expect(note.args.get("line")).toBe(String(line));
    expect(keys(scene).filter((k) => k === "gladMissing")).toHaveLength(1);
  });

  it("utan glClear säger simulatorn till", () => {
    const scene = read(triangle(["        glClear(GL_COLOR_BUFFER_BIT);\n", ""]));
    expect(scene.clearColor).toBeNull();
    expect(keys(scene)).toContain("noClear");
  });

  it("ett avstängt attribut ritar inget och säger varför", () => {
    const scene = read(triangle(["    glEnableVertexAttribArray(0);\n", ""]));
    const note = scene.notes.find((n) => n.key === "attribDisabled")!;
    expect([...note.args]).toEqual([["location", "0"], ["name", "aPos"]]);
    expect(scene.draws[0]!.vertices[0]!.size).toBe(0);
  });

  it("utan bunden VAO ritar glDrawElements inget", () => {
    const scene = read(triangle(["        glBindVertexArray(VAO); // seeing", "        // seeing"]));
    expect(scene.notes.map((n) => [n.key, n.args.get("call")])).toEqual([["noVaoBound", "glDrawElements"]]);
    expect(scene.draws).toHaveLength(0);
  });

  it("fler index än elementbufferten har: varning, och de som finns ritas", () => {
    const scene = read(triangle(["glDrawElements(GL_TRIANGLES, 6,", "glDrawElements(GL_TRIANGLES, 9,"]));
    expect(scene.notes.map((n) => [n.key, ...n.args.values()])).toEqual([["tooManyIndices", "9", "6"]]);
    expect(scene.draws[0]!.count).toBe(6);
  });

  it("en uniform utan program i bruk: varning och GL_INVALID_OPERATION i glGetError", () => {
    const scene = read(triangle(["        glUseProgram(shaderProgram);\n", "        glUniform1f(glGetUniformLocation(shaderProgram, \"x\"), 1.0f);\n        std::cout << glGetError() << std::endl;\n        std::cout << glGetError() << std::endl;\n        glUseProgram(shaderProgram);\n"]));
    expect(scene.notes.map((n) => [n.key, n.args.get("call")])).toEqual([["uniformWithoutProgram", "glUniform1f"]]);
    expect(scene.log).toEqual(["1282", "0"]);
  });

  it("glTexImage2D med fel mål: GL_INVALID_ENUM, och en debugkontexts callback får Mesas meddelande", () => {
    const callback = "void onDebug(GLenum source, GLenum type, unsigned int id, GLenum severity, GLsizei length, const char* message, const void* userParam)\n{\n    std::cout << \"debug: \" << message << std::endl;\n}\n\nint main()";
    const upload = "    unsigned int tex;\n    glGenTextures(1, &tex);\n    glBindTexture(GL_TEXTURE_2D, tex);\n    glTexImage2D(GL_FRAMEBUFFER, 0, GL_RGB, 1, 1, 0, GL_RGB, GL_UNSIGNED_BYTE, NULL);\n    std::cout << glGetError() << std::endl;\n    // render loop";
    const plain = read(triangle(["    // render loop", upload]));
    expect(plain.log).toEqual(["1280"]);
    const debug = read(triangle(["int main()", callback], ["    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);", "    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);\n    glfwWindowHint(GLFW_OPENGL_DEBUG_CONTEXT, true);"],
      ["    // build and compile", "    glEnable(GL_DEBUG_OUTPUT);\n    glDebugMessageCallback(onDebug, nullptr);\n    // build and compile"], ["    // render loop", upload]));
    expect(debug.log).toEqual(["debug: GL_INVALID_ENUM in glTexImage2D(target=GL_FRAMEBUFFER)", "1280"]);
  });

  it("programmets egna frågor om gränser får llvmpipes svar", () => {
    const scene = read(triangle(["    // render loop", "    int patches = 0;\n    glGetIntegerv(GL_MAX_PATCH_VERTICES, &patches);\n    std::cout << patches << std::endl;\n    // render loop"]));
    expect(scene.log).toEqual(["32"]);
  });

  it("ett syntaxfel i en shader: loggraden som learnopengl skriver ut, och en anmärkning", () => {
    const scene = read(triangle(['"   FragColor = vec4(1.0f, 0.5f, 0.2f, 1.0f);\\n"', '"   FragColor = vec4(1.0f, 0.5f, 0.2f, 1.0f)\\n"']));
    const note = scene.notes.find((n) => n.key === "shaderSyntax")!;
    expect(note.args.get("stage")).toBe("fragment");
    expect(scene.log[0]).toBe("ERROR::SHADER::FRAGMENT::COMPILATION_FAILED");
    expect(keys(scene)).not.toContain("notLinked");
    expect(scene.draws).toHaveLength(0);
  });

  it("utan renderingsloop stängs fönstret direkt", () => {
    const scene = read(triangle(["while (!glfwWindowShouldClose(window))", "for (int frame = 0; frame < 1; frame++)"]));
    expect(scene.renderLoop).toBe(false);
    expect(keys(scene)).toEqual(["noLoop"]);
  });

  it("ett spel: mellanslaget trycks i bildruta 30 och släpps i 33", () => {
    expect([GlReader.SpacePressFrame, GlReader.SpaceReleaseFrame]).toEqual([30, 33]);
  });

  it("ritlägen, jämförelser och std140", () => {
    expect(["GL_TRIANGLES", "GL_TRIANGLE_STRIP", "GL_TRIANGLE_FAN", "GL_LINES", "GL_LINE_LOOP", "GL_POINTS", "GL_PATCHES", "VK_PRIMITIVE_TOPOLOGY_LINE_LIST"].map(GlReader.topologyOf))
      .toEqual([Topology.Triangles, Topology.TriangleStrip, Topology.TriangleFan, Topology.Lines, Topology.LineStrip, Topology.Points, Topology.Patches, Topology.Lines]);
    expect([std140("float", 0), std140("vec3", 0), std140("mat4", 0), std140("vec3", 4), std140("float", 16)]).toEqual([[4, 4], [16, 12], [16, 64], [16, 64], [16, 256]]);
  });
});

/**
 * Chapters of every part, as C# reads and renders them (Codestead.GP.Gpu with Codestead.GP.Course): the frame at each
 * time the C# tests read it, and the scene's notes.
 */
const CSharp: { id: string; frames: [number, string][]; draws: number; notes: string[] }[] = [
  { id: "creating-a-window/solution", frames: [], draws: 0, notes: ["noLoop"] },
  { id: "debugging/start", frames: [[1, "e8a70c97904335c2"]], draws: 1, notes: ["uniformWithoutProgram", "uniformWithoutProgram", "noTextureOnUnit"] },
  { id: "hello-window/solution", frames: [[1, "e8a70c97904335c2"]], draws: 0, notes: [] },
  { id: "hello-triangle/ex-house", frames: [[1, "6c16347253596927"]], draws: 1, notes: [] },
  { id: "shaders/ex-pulse", frames: [[1, "37aeb703f36c299f"], [4, "2f384d3e410d317b"]], draws: 1, notes: [] },
  { id: "textures/solution", frames: [[1, "04563b3fc0cd6d69"]], draws: 1, notes: [] },
  { id: "transformations/ex-no-flip", frames: [[1, "b0d987adfd6e6e49"], [1.5708, "556c106222801742"], [4, "c909507da6f11c7d"]], draws: 2, notes: [] },
  { id: "camera/solution", frames: [[1, "5bd93c67b4bb6eb7"]], draws: 10, notes: [] },
  { id: "basic-lighting/solution", frames: [[1, "3816d7a4591fd161"]], draws: 2, notes: [] },
  { id: "light-casters/ex-fading", frames: [[1, "195c3097e1bb06f8"], [2.356, "2fca9cc654720572"]], draws: 10, notes: [] },
  { id: "model/solution", frames: [[1, "f36159de07c6f709"]], draws: 2, notes: [] },
  { id: "stencil-testing/solution", frames: [[1, "2a187023fcf84acc"]], draws: 5, notes: [] },
  { id: "blending/solution", frames: [[1, "86d2c2d1cc22d803"]], draws: 8, notes: [] },
  { id: "framebuffers/solution", frames: [[1, "e357e278c8d94efe"]], draws: 4, notes: [] },
  { id: "cubemaps/solution", frames: [[1, "42352a345009c7c9"]], draws: 3, notes: [] },
  { id: "advanced-glsl/solution", frames: [[1, "7c44379207c993b2"]], draws: 4, notes: [] },
  { id: "geometry-shader/solution", frames: [[1, "38bcaf3121287208"]], draws: 4, notes: [] },
  { id: "anti-aliasing/solution", frames: [[1, "d10fe8c7fc323d9d"]], draws: 2, notes: [] },
  { id: "advanced-lighting/solution", frames: [[1, "07c9582f7f9f4cb6"]], draws: 1, notes: [] },
  { id: "shadow-mapping/solution", frames: [[1, "b13bf5b8c9ebeb72"]], draws: 8, notes: [] },
  { id: "normal-mapping/solution", frames: [[1, "4910f5c1541b5996"]], draws: 1, notes: [] },
  { id: "hdr/solution", frames: [[1, "03f49698bf87c549"]], draws: 2, notes: [] },
  { id: "pbr-theory/solution", frames: [[1, "fdcc84924967a070"]], draws: 49, notes: [] },
  { id: "debugging/solution", frames: [[1, "9aa4992ba41b88aa"]], draws: 1, notes: [] },
  { id: "text-rendering/solution", frames: [[1, "d79f12ee8a2dd6d6"]], draws: 35, notes: [] },
  { id: "rendering-sprites/ex-spin", frames: [[1, "126490db681088f0"], [2, "579a4b7f9b6157cc"]], draws: 1, notes: [] },
  { id: "levels/solution", frames: [[1, "ba76122d152fcd75"]], draws: 70, notes: [] },
  { id: "ball/ex-big-ball", frames: [[0.4, "e22fee3d47f52044"], [1, "a1cb85e39f009017"]], draws: 71, notes: [] },
  { id: "oit-introduction/solution", frames: [[1, "144c4c567a5e6900"]], draws: 3, notes: [] },
  { id: "weighted-blended/solution", frames: [[1, "902174a754e40d16"]], draws: 5, notes: [] },
  { id: "scene-graph/ex-moon", frames: [[1, "71d74d4a56ade34f"], [2, "5b61163f66bcc89d"]], draws: 24, notes: [] },
  { id: "tessellation/solution", frames: [[1, "62556be7ec545ef2"]], draws: 1, notes: [] },
  { id: "dsa/solution", frames: [[1, "4b70c10b4c0bb5b5"]], draws: 1, notes: [] },
];

describe("kapitlen som i C#", () => {
  for (const c of CSharp) {
    it(c.id, () => {
      const build = Simulator.build(courseProject(c.id), Apis.OpenGL);
      expect(build.succeeded).toBe(true);
      const scene = build.scene!;
      expect(scene.notes.map((n) => n.key)).toEqual(c.notes);
      expect(scene.draws).toHaveLength(c.draws);
      for (const [time, hash] of c.frames) {
        const s = time === 1.0 || !scene.animated || scene.atTime === null ? scene : scene.atTime(time);
        expect(frameHash(s, time), `${c.id} at ${time} s`).toBe(hash);
      }
    });
  }
});
