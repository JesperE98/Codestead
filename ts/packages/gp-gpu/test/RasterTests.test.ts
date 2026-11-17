// RasterTests.cs: the simulated GPU's fixed-function stages and shader stages, with hand-made draws (no program to read).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  Apis, BlendFactor, BlendState, ClearOp, CompareFunc, CubeTexture, DrawCall, Frame, Image, RadianceHdr, Rasterizer, RenderTarget, SamplerState, Scene,
  ShaderParser, ShaderProgram, ShaderRunner, ShaderValue, StencilOp, StencilState, StorageImage, Texture, Topology, type VertexData,
} from "../src/index.js";
import { roundEven } from "../src/internal/dotnet.js";
import { Repo } from "./Repo.js";

const PassVs = `#version 330 core
layout (location = 0) in vec3 aPos;
void main() { gl_Position = vec4(aPos, 1.0); }`;

const colorFs = (color: string): string => `#version 330 core
out vec4 FragColor;
void main() { FragColor = ${color}; }`;

const vertex = (x: number, y: number, z: number): VertexData => new Map([["0", ShaderValue.vec(x, y, z)]]);

/** A quad from (x0, y0) to (x1, y1) in normalized device coordinates, at depth z. */
function quad(x0: number, y0: number, x1: number, y1: number, z = 0): VertexData[] {
  const corners: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]];
  return corners.map(([x, y]) => vertex(x, y, z));
}

interface DrawCallInit {
  topology?: Topology;
  depthTest?: boolean;
  depthFunc?: CompareFunc;
  depthWrite?: boolean;
  stencil?: StencilState | null;
  blend?: BlendState | null;
  target?: string | null;
  geometry?: string | null;
  textures?: ((name: string, u: number, v: number) => number[]) | null;
  cubes?: ((name: string, x: number, y: number, z: number) => number[] | null) | null;
  pointSize?: number;
  programPointSize?: boolean;
}

function draw(vertices: VertexData[], fs: string, vs = PassVs, init: (o: DrawCallInit) => void = () => {}): DrawCall {
  const o: DrawCallInit = { topology: Topology.Triangles, depthFunc: CompareFunc.Less, depthWrite: true, pointSize: 1 };
  init(o);
  return new DrawCall({
    vertexShader: ShaderParser.parseProgram(vs),
    fragmentShader: ShaderParser.parseProgram(fs),
    geometryShader: o.geometry ? ShaderParser.parseProgram(o.geometry) : null,
    vertices,
    count: vertices.length,
    topology: o.topology,
    depthTest: o.depthTest ?? false,
    depthFunc: o.depthFunc,
    depthWrite: o.depthWrite,
    stencil: o.stencil ?? null,
    blend: o.blend ?? null,
    target: o.target ?? null,
    textures: o.textures ?? null,
    cubeTextures: o.cubes ?? null,
    pointSize: o.pointSize,
    programPointSize: o.programPointSize ?? false,
  });
}

function render(...draws: DrawCall[]): Frame {
  return renderWith(null, ...draws);
}

function renderWith(setup: ((scene: Scene) => void) | null, ...draws: DrawCall[]): Frame {
  const scene = new Scene({ api: Apis.OpenGL, windowCreated: true, renderLoop: true, presents: true, clearColor: [0, 0, 0, 1], width: 100, height: 100 });
  setup?.(scene);
  scene.draws.push(...draws);
  return Rasterizer.render(scene, 100);
}

function assertColor(expected: number[], actual: number[], tolerance = 0.02): void {
  for (let i = 0; i < 3; i++)
    expect(Math.abs(expected[i]! - actual[i]!) <= tolerance, `expected (${expected.join(", ")}), got (${actual.slice(0, 3).map((v) => v.toFixed(3)).join(", ")})`).toBe(true);
}

/** xUnit's Assert.Equal(expected, actual, precision): both rounded to that many decimals. */
function assertEqualPrecision(expected: number, actual: number, precision: number): void {
  const round = (x: number): number => roundEven(x * 10 ** precision) / 10 ** precision;
  expect(round(actual)).toBe(round(expected));
}

function lit(f: Frame): number {
  let n = 0;
  for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) if (f.at(x, y)[0]! > 0.5) n++;
  return n;
}

describe("RasterTests", () => {
  it("djuptest: GL_ALWAYS ritar över, GL_LESS ritar inte bakom", () => {
    const near = draw(quad(-1, -1, 1, 1, -0.5), colorFs("vec4(1.0, 0.0, 0.0, 1.0)"), undefined, (o) => (o.depthTest = true));
    const far = draw(quad(-1, -1, 1, 1, 0.5), colorFs("vec4(0.0, 1.0, 0.0, 1.0)"), undefined, (o) => (o.depthTest = true));
    assertColor([1, 0, 0], render(near, far).at(50, 50));
    const farAlways = draw(quad(-1, -1, 1, 1, 0.5), colorFs("vec4(0.0, 1.0, 0.0, 1.0)"), undefined, (o) => {
      o.depthTest = true;
      o.depthFunc = CompareFunc.Always;
    });
    assertColor([0, 1, 0], render(near, farAlways).at(50, 50));
    // glDepthMask(GL_FALSE): the near quad does not write depth, so the far one is still drawn.
    const nearNoWrite = draw(quad(-1, -1, 1, 1, -0.5), colorFs("vec4(1.0, 0.0, 0.0, 1.0)"), undefined, (o) => {
      o.depthTest = true;
      o.depthWrite = false;
    });
    assertColor([0, 1, 0], render(nearNoWrite, far).at(50, 50));
  });

  it("stenciltest: en kontur ritas bara utanför det första objektet", () => {
    const write = new StencilState(CompareFunc.Always, 1, 0xff, 0xff, StencilOp.Keep, StencilOp.Keep, StencilOp.Replace);
    const test = new StencilState(CompareFunc.NotEqual, 1, 0xff, 0x00, StencilOp.Keep, StencilOp.Keep, StencilOp.Replace);
    const obj = draw(quad(-0.5, -0.5, 0.5, 0.5), colorFs("vec4(1.0, 1.0, 1.0, 1.0)"), undefined, (o) => (o.stencil = write));
    const outline = draw(quad(-0.6, -0.6, 0.6, 0.6), colorFs("vec4(0.04, 0.28, 0.26, 1.0)"), undefined, (o) => (o.stencil = test));
    const frame = render(obj, outline);
    assertColor([1, 1, 1], frame.at(50, 50));
    assertColor([0.04, 0.28, 0.26], frame.at(22, 50));
    assertColor([0, 0, 0], frame.at(5, 50));
  });

  it("blandning: SRC_ALPHA, ONE_MINUS_SRC_ALPHA blandar halvgenomskinligt glas", () => {
    const back = draw(quad(-1, -1, 1, 1), colorFs("vec4(0.0, 0.0, 1.0, 1.0)"));
    const glass = draw(quad(-1, -1, 1, 1), colorFs("vec4(1.0, 0.0, 0.0, 0.25)"), undefined,
      (o) => (o.blend = new BlendState(BlendFactor.SrcAlpha, BlendFactor.OneMinusSrcAlpha, BlendFactor.One, BlendFactor.Zero)));
    assertColor([0.25, 0, 0.75], render(back, glass).at(50, 50));
  });

  it("discard lämnar pixeln orörd", () => {
    const fs = `#version 330 core
out vec4 FragColor;
void main() { if (gl_FragCoord.x < 50.0) discard; FragColor = vec4(1.0); }`;
    const frame = render(draw(quad(-1, -1, 1, 1), fs));
    assertColor([0, 0, 0], frame.at(25, 50));
    assertColor([1, 1, 1], frame.at(75, 50));
  });

  it("framebuffer: det som ritats i ett mål kan samplas som textur (efterbehandling)", () => {
    const scene = draw(quad(-1, -1, 0, 1), colorFs("vec4(0.2, 0.4, 0.6, 1.0)"), undefined, (o) => (o.target = "fbo"));
    const vs = `#version 330 core
layout (location = 0) in vec3 aPos;
out vec2 TexCoords;
void main() { TexCoords = aPos.xy * 0.5 + 0.5; gl_Position = vec4(aPos, 1.0); }`;
    const fs = `#version 330 core
in vec2 TexCoords;
out vec4 FragColor;
uniform sampler2D screenTexture;
void main() { FragColor = vec4(vec3(1.0 - texture(screenTexture, TexCoords)), 1.0); }`;
    const tex = new Texture(() => Rasterizer.targetImage("fbo"), SamplerState.Default);
    const q = draw(quad(-1, -1, 1, 1), fs, vs, (o) => (o.textures = (_, u, v) => tex.sample(u, v)));
    const frame = renderWith((s) => {
      s.targets.set("fbo", new RenderTarget("fbo"));
      s.ops.push(new ClearOp(0, "fbo", [0.1, 0.1, 0.1, 1], 1, 0));
    }, scene, q);
    assertColor([0.8, 0.6, 0.4], frame.at(25, 50)); // inverted (0.2, 0.4, 0.6)
    assertColor([0.9, 0.9, 0.9], frame.at(75, 50)); // inverted clear colour
  });

  it("multisampling: en kant får blandade färger, utan MSAA bara hela", () => {
    // A triangle whose edge crosses pixels diagonally.
    const tri = [vertex(-1, -1, 0), vertex(1, -1, 0), vertex(1, 1, 0)];
    const d = draw(tri, colorFs("vec4(1.0)"));
    const aliased = render(d);
    const smooth = renderWith((s) => (s.samples = 4), d);
    const grey = (f: Frame): number => Array.from({ length: 100 }, (_, i) => f.at(i, 99 - i)[0]!).filter((v) => v > 0.05 && v < 0.95).length;
    expect(grey(aliased)).toBe(0);
    const greysSmooth = grey(smooth);
    expect(greysSmooth > 50, `only ${greysSmooth} edge pixels are blended`).toBe(true);
  });

  it("punkter och linjer rastreras", () => {
    const vs = `#version 330 core
layout (location = 0) in vec3 aPos;
void main() { gl_Position = vec4(aPos, 1.0); gl_PointSize = 10.0; }`;
    const pt = draw([vertex(0, 0, 0)], colorFs("vec4(1.0)"), vs, (o) => {
      o.topology = Topology.Points;
      o.programPointSize = true;
    });
    const frame = render(pt);
    assertColor([1, 1, 1], frame.at(53, 53));
    assertColor([0, 0, 0], frame.at(58, 50));
    const ln = draw([vertex(-1, 0.01, 0), vertex(1, 0.01, 0)], colorFs("vec4(1.0)"), undefined, (o) => (o.topology = Topology.Lines));
    const lf = render(ln);
    expect(Array.from({ length: 100 }, (_, x) => lf.at(x, 49)[0]!).filter((v) => v > 0.5).length > 95).toBe(true);
    expect(Array.from({ length: 100 }, (_, x) => lf.at(x, 40)[0]!).filter((v) => v > 0.5).length === 0).toBe(true);
  });

  it("geometrishader: en punkt blir en kvadrat (triangle_strip) med interface-block", () => {
    const vs = `#version 330 core
layout (location = 0) in vec3 aPos;
out VS_OUT { vec3 color; } vs_out;
void main() { gl_Position = vec4(aPos, 1.0); vs_out.color = vec3(0.0, 1.0, 0.0); }`;
    const gs = `#version 330 core
layout (points) in;
layout (triangle_strip, max_vertices = 4) out;
in VS_OUT { vec3 color; } gs_in[];
out vec3 fColor;
void main() {
    fColor = gs_in[0].color;
    gl_Position = gl_in[0].gl_Position + vec4(-0.2, -0.2, 0.0, 0.0); EmitVertex();
    gl_Position = gl_in[0].gl_Position + vec4( 0.2, -0.2, 0.0, 0.0); EmitVertex();
    gl_Position = gl_in[0].gl_Position + vec4(-0.2,  0.2, 0.0, 0.0); EmitVertex();
    gl_Position = gl_in[0].gl_Position + vec4( 0.2,  0.2, 0.0, 0.0); EmitVertex();
    EndPrimitive();
}`;
    const fs = `#version 330 core
in vec3 fColor;
out vec4 FragColor;
void main() { FragColor = vec4(fColor, 1.0); }`;
    const d = draw([vertex(0.5, 0.5, 0)], fs, vs, (o) => {
      o.topology = Topology.Points;
      o.geometry = gs;
    });
    const frame = render(d);
    assertColor([0, 1, 0], frame.at(75, 25));
    assertColor([0, 1, 0], frame.at(66, 34));
    assertColor([0, 0, 0], frame.at(50, 50));
  });

  it("interface-block mellan vertex- och fragmentshader", () => {
    const vs = `#version 330 core
layout (location = 0) in vec3 aPos;
out VS_OUT { vec3 color; float strength; } vs_out;
void main() { gl_Position = vec4(aPos, 1.0); vs_out.color = vec3(1.0, 0.5, 0.0); vs_out.strength = 0.5; }`;
    const fs = `#version 330 core
in VS_OUT { vec3 color; float strength; } fs_in;
out vec4 FragColor;
void main() { FragColor = vec4(fs_in.color * fs_in.strength, 1.0); }`;
    assertColor([0.5, 0.25, 0], render(draw(quad(-1, -1, 1, 1), fs, vs)).at(50, 50));
  });

  it("kubkarta: riktningen väljer sida (+X, -Z …)", () => {
    const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255]];
    const cube = new CubeTexture(colors.map((c) => new Texture(new Image(1, 1, 4, new Uint8Array([c[0]!, c[1]!, c[2]!, 255])), SamplerState.Default)));
    assertColor([1, 0, 0], cube.sample(1, 0.1, 0.2));
    assertColor([0, 1, 0], cube.sample(-1, 0.1, 0.2));
    assertColor([0, 0, 1], cube.sample(0.1, 1, 0.2));
    assertColor([1, 0, 1], cube.sample(0.1, 0.2, -1));
    const fs = `#version 330 core
out vec4 FragColor;
uniform samplerCube skybox;
void main() { FragColor = texture(skybox, vec3(0.0, 0.0, -1.0)); }`;
    const frame = render(draw(quad(-1, -1, 1, 1), fs, undefined, (o) => (o.cubes = (n, x, y, z) => (n === "skybox" ? cube.sample(x, y, z) : null))));
    assertColor([1, 0, 1], frame.at(50, 50));
  });

  it("sRGB: en sRGB-textur avkodas till linjära värden, ett sRGB-fönster kodar dem igen", () => {
    const image = new Image(1, 1, 4, new Uint8Array([188, 128, 0, 255]));
    const linear = new Texture(image, SamplerState.Default).sample(0.5, 0.5);
    const decoded = new Texture(image, SamplerState.Default, { srgb: true }).sample(0.5, 0.5);
    assertEqualPrecision(188 / 255.0, linear[0]!, 3);
    assertEqualPrecision(0.5029, decoded[0]!, 3); // sRGB 188 is linear 0.503
    assertEqualPrecision(0.2158, decoded[1]!, 3); // sRGB 128 is linear 0.216
    assertEqualPrecision(0.0, decoded[2]!, 6);
    const fs = `#version 330 core
out vec4 FragColor;
void main() { FragColor = vec4(0.5029, 0.2158, 0.0, 1.0); }`;
    assertColor([188 / 255.0, 128 / 255.0, 0], renderWith((s) => (s.windowSrgb = true), draw(quad(-1, -1, 1, 1), fs)).at(50, 50));
  });

  it("HDR: en Radiance-fil (.hdr) läses som flyttal, med värden över 1.0", () => {
    const bytes = new Uint8Array(readFileSync(join(Repo.content, "textures", "hdr", "environment.hdr")));
    expect(RadianceHdr.isHdr(bytes)).toBe(true);
    const image = RadianceHdr.decode(bytes)!;
    expect([image.width, image.height, image.channels]).toEqual([512, 256, 3]);
    expect(image.floats).not.toBeNull();
    // The sun is far brighter than white; the zenith is a moderate blue.
    expect(image.floats!.reduce((a, b) => Math.max(a, b)) > 40).toBe(true);
    const zenith = new Texture(image, SamplerState.Default).sample(0.1, 0.02);
    expect(zenith[2]! > zenith[0]! && zenith[2]! > 0.5 && zenith[2]! < 3).toBe(true);
  });

  it("C++: std::map sorterar fönstren och reverse_iterator går bakifrån", () => {
    const runner = new ShaderRunner(new ShaderProgram(), { lenient: true });
    runner.runStatements(ShaderParser.parseStatementsLenient(`
{
    std::vector<glm::vec3> windows = { glm::vec3(0.0f, 0.0f, 0.7f), glm::vec3(0.0f, 0.0f, -2.3f), glm::vec3(1.5f, 0.0f, 0.51f) };
    glm::vec3 cameraPos = glm::vec3(0.0f, 0.0f, 3.0f);
    std::map<float, glm::vec3> sorted;
    for (unsigned int i = 0; i < windows.size(); i++)
    {
        float distance = glm::length(cameraPos - windows[i]);
        sorted[distance] = windows[i];
    }
    float order = 0.0f;
    for (std::map<float, glm::vec3>::reverse_iterator it = sorted.rbegin(); it != sorted.rend(); ++it)
    {
        order = order * 10.0f + it->second.z;
    }
    result = order;
}`));
    // Farthest first: z = -2.3, then 0.51, then 0.7.
    assertEqualPrecision((-2.3 * 10 + 0.51) * 10 + 0.7, runner.globals.get("result")!.x, 6);
  });

  it("C++: rand() ger glibc:s tal, och strängar byggs med + och to_string", () => {
    const runner = new ShaderRunner(new ShaderProgram(), { lenient: true });
    runner.runStatements(ShaderParser.parseStatementsLenient(`
{
    srand(42);
    int a = rand();
    int b = rand();
    int i = 7;
    std::string name = "offsets[" + std::to_string(i) + "]";
    glm::mat4* matrices;
    matrices = new glm::mat4[3];
}`));
    expect(runner.globals.get("a")!.x).toBe(71876166);
    expect(runner.globals.get("b")!.x).toBe(708592740);
    expect(runner.globals.get("name")!.text).toBe("offsets[7]");
    expect(runner.globals.get("matrices")!.items!.length).toBe(3);
  });

  const PatchTcs = `#version 410 core
layout (vertices = 4) out;
uniform float level;
void main()
{
    gl_out[gl_InvocationID].gl_Position = gl_in[gl_InvocationID].gl_Position;
    if (gl_InvocationID == 0)
    {
        gl_TessLevelOuter[0] = level; gl_TessLevelOuter[1] = level; gl_TessLevelOuter[2] = level; gl_TessLevelOuter[3] = level;
        gl_TessLevelInner[0] = level; gl_TessLevelInner[1] = level;
    }
}`;

  /** A patch of 4 corners (x0, y0) … (x1, y1) in learnopengl's order: (0,0), (1,0), (0,1), (1,1). */
  function patch(tes: string, level: number, wireframe = false): DrawCall {
    const corners: [number, number][] = [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]];
    const vertices = corners.map(([x, y]) => vertex(x, y, 0));
    return new DrawCall({
      vertexShader: ShaderParser.parseProgram(PassVs),
      fragmentShader: ShaderParser.parseProgram(colorFs("vec4(1.0)")),
      tessControlShader: ShaderParser.parseProgram(PatchTcs),
      tessEvalShader: ShaderParser.parseProgram(tes),
      patchVertices: 4,
      vertices,
      count: 4,
      topology: Topology.Patches,
      wireframe,
      uniforms: () => new Map([["level", ShaderValue.scalar(level)]]),
    });
  }

  const QuadTes = `#version 410 core
layout (quads, equal_spacing, ccw) in;
void main()
{
    vec4 p0 = mix(gl_in[0].gl_Position, gl_in[1].gl_Position, gl_TessCoord.x);
    vec4 p1 = mix(gl_in[2].gl_Position, gl_in[3].gl_Position, gl_TessCoord.x);
    gl_Position = mix(p0, p1, gl_TessCoord.y);
}`;

  it("tessellering: en fyrhörningspatch delas upp och täcker samma yta, trådmodellen får fler linjer", () => {
    // Filled, the tessellated patch covers what the patch covers (80 × 80 of 100 × 100 pixels).
    const filled = lit(render(patch(QuadTes, 4)));
    expect(filled).toBeGreaterThanOrEqual(80 * 80 - 200);
    expect(filled).toBeLessThanOrEqual(80 * 80 + 200);
    // As lines, a level of 8 draws many more edges than a level of 1 (one quad, two triangles).
    const coarse = lit(render(patch(QuadTes, 1, true)));
    const fine = lit(render(patch(QuadTes, 8, true)));
    expect(fine > coarse * 3, `level 1: ${coarse} line pixels, level 8: ${fine}`).toBe(true);
    expect(fine < filled, "a wireframe leaves gaps").toBe(true);
  });

  it("tessellering: triangeldomän och fraktionerad udda uppdelning täcker hela patchen", () => {
    const tri = `#version 410 core
layout (triangles, fractional_odd_spacing, ccw) in;
void main()
{
    gl_Position = gl_TessCoord.x * gl_in[0].gl_Position + gl_TessCoord.y * gl_in[1].gl_Position + gl_TessCoord.z * gl_in[3].gl_Position;
}`;
    // The triangle (0,0)-(1,0)-(1,1) of the patch: half its square.
    const half = lit(render(patch(tri, 5.5)));
    expect(half).toBeGreaterThanOrEqual((80 * 80) / 2 - 150);
    expect(half).toBeLessThanOrEqual((80 * 80) / 2 + 150);
    const q = lit(render(patch(QuadTes.replace("equal_spacing", "fractional_odd_spacing"), 6.3)));
    expect(q).toBeGreaterThanOrEqual(80 * 80 - 200);
    expect(q).toBeLessThanOrEqual(80 * 80 + 200);
  });

  it("compute: en dispatch skriver varje texel i bilden med imageStore", () => {
    const cs = ShaderParser.parseProgram(`#version 430 core
layout (local_size_x = 4, local_size_y = 2, local_size_z = 1) in;
layout (rgba32f, binding = 0) uniform image2D img;
uniform float t;
void main()
{
    ivec2 p = ivec2(gl_GlobalInvocationID.xy);
    imageStore(img, p, vec4(float(p.x) / (gl_NumWorkGroups.x * gl_WorkGroupSize.x), float(p.y) / 6.0, t, 1.0));
}`);
    const image = new StorageImage(8, 6);
    const errors = Rasterizer.dispatch(cs, "main", false, new Map([["t", ShaderValue.scalar(0.5)]]), new Map([["img", image]]), [2, 3, 1], 1.0);
    expect(errors).toEqual([]);
    expect(image.data.slice((4 * 8 + 3) * 4, (4 * 8 + 3) * 4 + 4)).toEqual([3 / 8.0, 4 / 6.0, 0.5, 1]);
    expect(image.data[(5 * 8 + 7) * 4 + 3]).toBe(1.0);
  });

  it("C++: glm::quat, slerp och toMat4 ger GLM:s rotationer", () => {
    const runner = new ShaderRunner(new ShaderProgram(), { lenient: true });
    runner.runStatements(ShaderParser.parseStatementsLenient(`
{
    float s = 0.70710678f;
    glm::quat a = glm::quat(1.0f, 0.0f, 0.0f, 0.0f);
    glm::quat b = glm::quat(s, 0.0f, 0.0f, s);
    glm::quat h = glm::normalize(glm::slerp(a, b, 0.5f));
    glm::mat4 r = glm::toMat4(b);
    glm::vec4 x = r * glm::vec4(1.0f, 0.0f, 0.0f, 1.0f);
}`));
    // b turns 90° about z: x goes to y; halfway is 45°.
    const x = runner.globals.get("x")!.v!;
    assertEqualPrecision(0, x[0]!, 6);
    assertEqualPrecision(1, x[1]!, 6);
    const h = runner.globals.get("h")!.v!;
    assertEqualPrecision(Math.sin(Math.PI / 8), h[2]!, 6);
    assertEqualPrecision(Math.cos(Math.PI / 8), h[3]!, 6);
  });
});
