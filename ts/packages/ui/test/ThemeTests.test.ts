import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Brand } from "../src/index.js";

type Theme = Map<string, string>;

/** The #rrggbb variables of a CSS rule (the rgba ones are the controls' own colours, not the theme's). */
function variables(css: string, selector: string): Theme {
  const start = css.indexOf(selector + " {");
  if (start < 0) throw new Error(`no rule ${selector}`);
  const body = css.slice(start, css.indexOf("}", start));
  return new Map([...body.matchAll(/--(cs-[a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
}

const css = readFileSync(join(import.meta.dirname, "..", "src", "Themes", "codestead.css"), "utf8");

/** Theme → colour name → colour, from codestead.css. */
const themes: Record<"Light" | "Dark", Theme> = {
  Light: variables(css, ':root,\n:root[data-theme="light"]'),
  Dark: variables(css, ':root[data-theme="dark"]'),
};

function luminance(hex: string): number {
  const channel = (i: number) => {
    const s = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const meanings = ["success", "warning", "danger", "info", "reward"];

/** The colour system: every colour exists in both themes, and text is readable (WCAG AA). */
describe("ThemeTests", () => {
  it("alla färger finns i både ljust och mörkt tema", () => {
    expect([...themes.Light.keys()].sort()).toEqual([...themes.Dark.keys()].sort());
    for (const m of meanings) {
      expect(themes.Light.has(`cs-${m}`)).toBe(true);
      expect(themes.Light.has(`cs-${m}-soft`)).toBe(true);
    }
    expect(themes.Light.has("cs-reward-strong")).toBe(true);
    expect(themes.Light.has("cs-on-accent")).toBe(true);
  });

  it("mörkt tema är detsamma från systemet och från inställningen", () => {
    expect(Object.fromEntries(variables(css, ':root:not([data-theme="light"])'))).toEqual(Object.fromEntries(themes.Dark));
  });

  it.each(["Light", "Dark"] as const)("text och betydelsefärger går att läsa (kontrast ≥ 4.5): %s", (name) => {
    const t = themes[name];
    const failures: string[] = [];
    const check = (fg: string, bg: string, min = 4.5) => {
      const c = contrast(t.get(fg)!, t.get(bg)!);
      if (c < min) failures.push(`${fg} on ${bg}: ${c.toFixed(2)}`);
    };
    for (const bg of ["cs-bg", "cs-surface", "cs-surface-2"]) {
      check("cs-text", bg);
      check("cs-text-muted", bg);
      check("cs-link", bg);
      for (const m of meanings) check(`cs-${m}`, bg);
    }
    for (const m of meanings) {
      check(`cs-${m}`, `cs-${m}-soft`);
      check("cs-text", `cs-${m}-soft`);
      check("cs-text-muted", `cs-${m}-soft`);
    }
    check("cs-on-accent", "cs-accent");
    expect(failures).toEqual([]);
  });

  it.each([
    ["Linux", Brand.Linux],
    ["Hub", Brand.Hub],
    ["GP", Brand.GP],
  ] as const)("appens accentfärg: knapptexten går att läsa: %s", (name, brand) => {
    for (const [shade, surface] of [
      [brand.light, themes.Light.get("cs-surface")!],
      [brand.dark, themes.Dark.get("cs-surface")!],
    ] as const) {
      expect(contrast(shade.onAccent, shade.accent), `${name}: text on accent`).toBeGreaterThanOrEqual(4.5);
      // The accent is also used for the current chapter and focus rings next to the surface.
      expect(contrast(shade.accent, surface), `${name}: accent on surface`).toBeGreaterThanOrEqual(3);
    }
  });

  it("appens accentfärg blir temats CSS-variabler", () => {
    expect(Brand.Linux.css()).toContain("--cs-accent: #0f766e;");
    for (const brand of [Brand.Linux, Brand.Hub, Brand.GP]) expect(brand.css()).toContain(`--cs-on-accent: ${brand.light.onAccent}`);
  });
});
