// The visualizer's 3D scenes are drawn for a dark background: neon lines, glowing sprites added on top of black, a star
// field, bloom. For Codestead's light theme each material is changed once, before it is drawn (onBeforeCompile):
//   - glow (additive blending, which adds light and so cannot show on white) becomes ordinary alpha blending of the
//     same hue, somewhat darker, as opaque as the glow was bright;
//   - lines, points and sprites get their lightness turned round, as the stylesheets do (engine/css.ts): a white line
//     becomes black, cyan a darker cyan;
//   - unlit surfaces (MeshBasicMaterial: faces, highlights, glass panels) keep their colours, except dark ones (the
//     panels' dark glass), which become light;
//   - lit surfaces (the model, shaded as the visualizer's CPU pipeline shades it) and the visualizer's own shaders that
//     draw without glow keep their colours: they are what the GPU would draw;
// and the star field (tagged xrHideInAR) is hidden. Bloom is turned off by mount.ts. A slide that changes a material's
// blending later (the blending slide's panes turn additive) gets that material changed again, for its new blending.
// The composer's output pass, finally, turns the picture into sRGB as straight colours (themeOutput): on the
// transparent canvas, see-through parts (the overview's file text, faint lines) would otherwise come out lighter than
// their colour, white on the light page.

import { AdditiveBlending, NormalBlending, SRGBColorSpace, ShaderMaterial, type Material, type Object3D, type Scene, type WebGLProgramParametersWithUniforms } from 'three';

/** GLSL: lightness turned round (every channel + 1 − max − min), and glow as a dark, covering colour. */
const lightGlsl = `
vec3 csToSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 csToLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec4 csLightFlat(vec4 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  return vec4(clamp(c.rgb + (1.0 - mx - mn), 0.0, 1.0), c.a);
}
vec4 csLightDark(vec4 c) {
  float l = (max(c.r, max(c.g, c.b)) + min(c.r, min(c.g, c.b))) * 0.5;
  return mix(c, csLightFlat(c), smoothstep(0.32, 0.12, l));
}
vec4 csLightGlow(vec4 c) {
  float m = max(c.r, max(c.g, c.b));
  if (m <= 0.0) return vec4(0.0);
  vec3 hue = c.rgb / m;
  float mn = min(hue.r, min(hue.g, hue.b));
  return vec4(mix(hue, clamp(hue - mn, 0.0, 1.0) * 0.85, 0.5), clamp(c.a * min(m, 1.0), 0.0, 1.0));
}
`;

type Kind = 'glow' | 'flat' | 'dark';

interface Saved {
  blending: Material['blending'];
  /** The blending the material got here: another one means the slide changed it since. */
  applied: Material['blending'];
  transparent: boolean;
  onBeforeCompile: Material['onBeforeCompile'];
  customProgramCacheKey: Material['customProgramCacheKey'];
}

const saved = new WeakMap<Material, Saved>();

/** Which change a material gets in the light theme, or null for none. */
function kindOf(m: Material): Kind | null {
  if (m.blending === AdditiveBlending) return 'glow';
  if (m instanceof ShaderMaterial) return null;
  const lit = (m as { isMeshStandardMaterial?: boolean; isMeshPhongMaterial?: boolean; isMeshLambertMaterial?: boolean; isMeshPhysicalMaterial?: boolean; isMeshToonMaterial?: boolean });
  if (lit.isMeshStandardMaterial || lit.isMeshPhongMaterial || lit.isMeshLambertMaterial || lit.isMeshPhysicalMaterial || lit.isMeshToonMaterial) return null;
  const flat = m as { isLineBasicMaterial?: boolean; isPointsMaterial?: boolean; isSpriteMaterial?: boolean };
  return flat.isLineBasicMaterial || flat.isPointsMaterial || flat.isSpriteMaterial ? 'flat' : 'dark';
}

/**
 * Wraps a fragment shader's main() so its colour goes through `fn`, in sRGB: `linear` when the shader writes linear
 * colours (into the composer's render targets, whose output pass converts them).
 */
export function wrapFragment(source: string, fn: 'csLightFlat' | 'csLightDark' | 'csLightGlow', linear: boolean): string {
  const renamed = source.replace(/void\s+main\s*\(\s*(?:void)?\s*\)/, 'void csMain()');
  if (renamed === source) return source;
  const call = linear
    ? `vec4 csC = ${fn}(vec4(csToSrgb(gl_FragColor.rgb), gl_FragColor.a));\n  gl_FragColor = vec4(csToLinear(csC.rgb), csC.a);`
    : `gl_FragColor = ${fn}(gl_FragColor);`;
  return `${renamed}\n${lightGlsl}\nvoid main() {\n  csMain();\n  ${call}\n}\n`;
}

function adapt(m: Material, kind: Kind): void {
  const s: Saved = { blending: m.blending, applied: m.blending, transparent: m.transparent, onBeforeCompile: m.onBeforeCompile, customProgramCacheKey: m.customProgramCacheKey };
  saved.set(m, s);
  const before = m.onBeforeCompile.bind(m);
  const key = m.customProgramCacheKey.bind(m);
  const fn = kind === 'glow' ? 'csLightGlow' : kind === 'flat' ? 'csLightFlat' : 'csLightDark';
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    before(shader, renderer);
    shader.fragmentShader = wrapFragment(shader.fragmentShader, fn, (shader as { outputColorSpace?: string }).outputColorSpace !== SRGBColorSpace);
  };
  m.customProgramCacheKey = () => `${key()}|cs-${kind}`;
  if (kind === 'glow') {
    m.blending = NormalBlending;
    m.transparent = true;
  }
  s.applied = m.blending;
  m.needsUpdate = true;
}

/** The material as the slide made it (with the blending the slide gave it last). */
function restore(m: Material): void {
  const s = saved.get(m);
  if (!s) return;
  saved.delete(m);
  const blending = m.blending !== s.applied ? m.blending : s.blending;
  m.transparent = s.transparent;
  m.onBeforeCompile = s.onBeforeCompile;
  m.customProgramCacheKey = s.customProgramCacheKey;
  m.blending = blending;
  m.needsUpdate = true;
}

/**
 * Keeps a scene's materials in the theme's colours: call it before every frame (new objects appear as slides play).
 * `hideStars`: the star field is hidden (in the light theme, also where a step is drawn as in the dark theme).
 */
export function themeScene(scene: Scene | Object3D, light: boolean, hideStars = light): void {
  scene.traverse((o) => {
    if (o.userData.xrHideInAR && hideStars) o.visible = false;
    const mats = (o as { material?: Material | Material[] }).material;
    if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      if (!light) {
        if (saved.has(m)) restore(m);
        continue;
      }
      const s = saved.get(m);
      if (s && m.blending !== s.applied) restore(m);
      // (A material left as it is, until the slide changes its blending.)
      else if (s || (m.userData as { csNone?: number }).csNone === m.blending) continue;
      const kind = kindOf(m);
      if (kind === null) {
        (m.userData as { csNone?: number }).csNone = m.blending;
        continue;
      }
      adapt(m, kind);
    }
  });
}

/**
 * The output pass's fragment shader for the light theme. The composer's picture holds premultiplied colours (alpha
 * blended over a transparent clear), and the pass turns them into sRGB as they are: a pixel of colour c and coverage a
 * then shows as sRGB(c·a) + page·(1 − a), which is more than its colour where a is small – on the light page, the text
 * of the overview's first step became white inside its coloured edges. Here the colour is taken out of the
 * premultiplication first and put back after the conversion: sRGB(c)·a + page·(1 − a), the colour over the page.
 * (Not on a dark stage or in the dark theme: there added light, more than its coverage, is the point.)
 */
export function lightOutputFragment(source: string): string {
  const renamed = source.replace(/void\s+main\s*\(\s*(?:void)?\s*\)/, 'void csMain()');
  if (renamed === source) return source;
  const read = /gl_FragColor\s*=\s*texture2D\(\s*tDiffuse\s*,\s*vUv\s*\)\s*;/;
  if (!read.test(renamed)) return source;
  const straight = renamed.replace(read, 'gl_FragColor = texture2D( tDiffuse, vUv );\n  if (gl_FragColor.a > 0.0) gl_FragColor.rgb = min(gl_FragColor.rgb / gl_FragColor.a, vec3(1.0));');
  return `${straight}\nvoid main() {\n  csMain();\n  gl_FragColor.rgb *= gl_FragColor.a;\n}\n`;
}

const outputShaders = new WeakMap<object, string>();

/** The composer's output pass material: its light-theme shader (lightOutputFragment) when `light`, else its own. */
export function themeOutput(material: { fragmentShader: string; needsUpdate: boolean }, light: boolean): void {
  const own = outputShaders.get(material) ?? material.fragmentShader;
  outputShaders.set(material, own);
  const wanted = light ? lightOutputFragment(own) : own;
  if (material.fragmentShader === wanted) return;
  material.fragmentShader = wanted;
  material.needsUpdate = true;
}
