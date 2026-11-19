import { describe, expect, it } from "vitest";
import { invertLightness, lightCss, scopeToScene, stripViewportMedia } from "../engine/css.js";
import { wrapFragment } from "../engine/light.js";

describe("SceneCss", () => {
  it("regler för fönstrets bredd tas bort, annat står kvar", () => {
    const css = ".a { color: red; }\n@media (max-width: 900px) { .a { color: blue; } .b { x: y; } }\n@media (prefers-reduced-motion: reduce) { .c { animation: none; } }\n.d {}";
    const out = stripViewportMedia(css);
    expect(out).not.toContain("blue");
    expect(out).toContain(".a { color: red; }");
    expect(out).toContain("prefers-reduced-motion");
    expect(out).toContain(".d {}");
  });

  it("sidans rot blir scenen", () => {
    const out = scopeToScene(":root { --bg: #000; }\nhtml, body { margin: 0; height: 100%; }\nbody { color: red; }\nbody[data-api='vulkan'] { --api: x; }\nbody.code-open .x {}\n.body-x {}");
    expect(out).toContain(":host { --bg: #000; }");
    expect(out).not.toContain("html");
    expect(out).toContain(".rpv { color: red; }");
    expect(out).toContain(".rpv[data-api='vulkan']");
    expect(out).toContain(".rpv.code-open .x");
    expect(out).toContain(".body-x {}");
  });

  it("ljusheten vänds, kulören står kvar", () => {
    expect(invertLightness({ r: 0, g: 0, b: 0, a: 1 })).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(invertLightness({ r: 255, g: 255, b: 255, a: 0.5 })).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    // Cyan stays cyan, darker: the largest channel is still blue/green and the spread is the same.
    const c = invertLightness({ r: 56, g: 225, b: 255, a: 1 });
    expect(c.b - c.r).toBe(255 - 56);
    expect(c.r + c.b).toBe(255 * 2 - (56 + 255));
  });

  it("ljus stilmall: varje färg vänds, selektorer och annat lämnas", () => {
    const out = lightCss("#app .x { color: #fff; background: rgba(5, 6, 13, 0.6); border: 1px solid #38e1ff; box-shadow: 0 0 4px rgb(0,0,0); }");
    expect(out).toContain("#app .x");
    expect(out).toContain("color: rgb(0, 0, 0)");
    expect(out).toContain("background: rgba(");
    expect(out).toContain("0.6)");
    expect(out).not.toContain("#fff");
    expect(out).not.toContain("#38e1ff");
    expect(out).toContain("box-shadow: 0 0 4px rgb(255, 255, 255);");
  });

  it("fragmentshaderns main() lindas så att färgen går genom ljusa temat", () => {
    const src = "uniform vec3 c;\nvoid main() {\n  gl_FragColor = vec4(c, 1.0);\n}\n";
    const srgb = wrapFragment(src, "csLightFlat", false);
    expect(srgb).toContain("void csMain()");
    expect(srgb).toContain("gl_FragColor = csLightFlat(gl_FragColor);");
    expect(srgb.match(/void main\(\)/g)?.length).toBe(1);
    expect(wrapFragment(src, "csLightGlow", true)).toContain("csToLinear");
    expect(wrapFragment("no main here", "csLightFlat", false)).toBe("no main here");
  });
});
