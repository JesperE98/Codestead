// The 3D scenes' materials in the light theme (engine/light.ts), with three.js's objects (no WebGL needed).
import { AdditiveBlending, BoxGeometry, Mesh, MeshBasicMaterial, NormalBlending, Scene } from "three";
import { describe, expect, it } from "vitest";
import { themeScene } from "../engine/light.js";

const key = (m: MeshBasicMaterial) => m.customProgramCacheKey();

describe("themeScene", () => {
  it("en yta ändras för det ljusa temat, ändras igen när sliden byter blending, och blir som sliden gjorde den i det mörka", () => {
    const scene = new Scene();
    const m = new MeshBasicMaterial({ color: 0x38e1ff, transparent: true, opacity: 0.45, blending: NormalBlending });
    scene.add(new Mesh(new BoxGeometry(), m));
    const original = key(m);

    themeScene(scene, true);
    expect(key(m)).toContain("cs-dark");
    expect(m.blending).toBe(NormalBlending);
    themeScene(scene, true);
    expect(key(m)).toContain("cs-dark");

    // The blending slide's panes turn additive: in the light theme that is glow, alpha blended.
    m.blending = AdditiveBlending;
    themeScene(scene, true);
    expect(key(m)).toContain("cs-glow");
    expect(m.blending).toBe(NormalBlending);

    // Drawn as in the dark theme (the dark stage): the slide's own material, with the blending the slide gave it last.
    themeScene(scene, false);
    expect(key(m)).toBe(original);
    expect(m.blending).toBe(AdditiveBlending);
    expect(m.transparent).toBe(true);
  });

  it("stjärnfältet göms i det ljusa temat, och på en mörk scen i det", () => {
    const stars = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    stars.userData.xrHideInAR = true;
    const scene = new Scene().add(stars);
    themeScene(scene, false);
    expect(stars.visible).toBe(true);
    themeScene(scene, false, true);
    expect(stars.visible).toBe(false);
  });
});
