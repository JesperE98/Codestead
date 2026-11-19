// Draws the chapters' diagrams: every <name>.mjs in this folder is the source of one picture (in one or more variants –
// per language, per API) and becomes images/<variant>.webp. See "Bilder i kapitlen" in docs/DEVELOPMENT.md.
//
//   node src/GP/content/images/diagrams/make.mjs [name …] [--preview <dir>] [--renders <dir>]
//
// A source exports
//   variants: [{ out: "en/x.webp", lang: "en", api?: "opengl" }, …]   (perLanguage / perApi in style.mjs help)
//   height: number (the width is always 720), or height(v)
//   draw(v, R, frame): the SVG (style.mjs's svg(…)) for a variant; R holds the simulator renders, see below
//   renders?: { id: { api, chapter, from?, edits?, width, times? } } or renders(v) – pictures the simulator draws from
//             the course's own projects (ts/packages/gp-gpu/test/RenderPictures.test.ts); R[id][i] is
//             { href, width, height } for times[i]. They are kept in --renders (default: a folder in the system's
//             temp folder) and drawn again only when their description changes.
//   frames?: number, frameMs?: number – an animation (draw is called for frame 0 … frames-1)
//   lossy?: true – WebP with quality 85 (for pictures with renders in them) instead of lossless
//   scale?: 1 – save at 720 px instead of 2× (1440 px); for animations, which would get large
//
// Needs Node with Playwright and its Chromium (require("playwright")), python3 with Pillow, the fonts Inter (bundled
// with the apps: ts/node_modules/@fontsource-variable/inter, so run npm ci in ts/ first) and JetBrains Mono (installed).
// --preview <dir> also writes each picture as PNG on the app's light and dark text background, to look at.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const images = dirname(here);
const repo = join(images, "..", "..", "..", "..");
const ts = join(repo, "ts");

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
};
const preview = option("--preview");
const rendersDir = option("--renders") ?? join(tmpdir(), "codestead-gp-renders");
const names = args.length > 0 ? args : readdirSync(here).filter((f) => f.endsWith(".mjs") && f !== "make.mjs" && f !== "style.mjs").map((f) => f.slice(0, -4)).sort();

const sources = [];
for (const name of names) {
  const file = join(here, `${name}.mjs`);
  if (!existsSync(file)) throw new Error(`no diagram ${name} (${file})`);
  sources.push({ name, mod: await import(pathToFileURL(file).href) });
}

// 1. The simulator renders: every description that is not drawn yet goes to RenderPictures.test.ts in one run.
const key = (id, spec) => `${id}-${createHash("sha1").update(JSON.stringify(spec)).digest("hex").slice(0, 10)}`;
const rendersOf = (mod, v) => (typeof mod.renders === "function" ? mod.renders(v) : mod.renders) ?? {};
const wanted = new Map();
for (const { mod } of sources)
  for (const v of mod.variants)
    for (const [id, spec] of Object.entries(rendersOf(mod, v))) wanted.set(key(id, spec), spec);
const missing = [...wanted].filter(([k, spec]) => !existsSync(join(rendersDir, k, `${(spec.times?.length ?? 1) - 1}.png`)));
if (missing.length > 0) {
  mkdirSync(rendersDir, { recursive: true });
  writeFileSync(join(rendersDir, "requests.json"), JSON.stringify(missing.map(([k, spec]) => ({ key: k, ...spec })), null, 1));
  console.log(`The simulator draws ${missing.length} picture(s) …`);
  execFileSync("npx", ["vitest", "run", "packages/gp-gpu/test/RenderPictures.test.ts"], {
    cwd: ts,
    stdio: "inherit",
    env: { ...process.env, CODESTEAD_RENDER_PICTURES: rendersDir },
  });
}
function rendersFor(mod, v) {
  const R = {};
  for (const [id, spec] of Object.entries(rendersOf(mod, v))) {
    const dir = join(rendersDir, key(id, spec));
    R[id] = (spec.times ?? [1.0]).map((_, i) => {
      const png = readFileSync(join(dir, `${i}.png`));
      return { href: `data:image/png;base64,${png.toString("base64")}`, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
    });
  }
  return R;
}

// 2. Every frame of every variant, at 2×, by Chromium.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const work = join(tmpdir(), `codestead-gp-diagrams-${process.pid}`);
mkdirSync(work, { recursive: true });
const inter = join(ts, "node_modules", "@fontsource-variable", "inter");
if (!existsSync(join(inter, "wght.css"))) throw new Error(`Inter is missing (${inter}): run npm ci in ts/ first`);
const page0 = (body) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(join(inter, "wght.css")).href}">
<link rel="stylesheet" href="${pathToFileURL(join(inter, "wght-italic.css")).href}">
<style>html,body{margin:0;background:transparent}svg{display:block}text,tspan{font-variant-ligatures:none}</style>
</head><body>${body}</body></html>`;

const browser = await chromium.launch();
const context = await browser.newContext({ deviceScaleFactor: 2 });
const page = await context.newPage();
const jobs = [];
const problems = [];
for (const { name, mod } of sources) {
  for (const v of mod.variants) {
    const R = rendersFor(mod, v);
    const height = Math.round(typeof mod.height === "function" ? mod.height(v) : mod.height);
    const frames = mod.frames ?? 1;
    const pngs = [];
    for (let f = 0; f < frames; f++) {
      const html = join(work, "page.html");
      writeFileSync(html, page0(mod.draw(v, R, f)));
      await page.setViewportSize({ width: 720, height });
      await page.goto(pathToFileURL(html).href);
      await page.evaluate(() => document.fonts.ready);
      if (f === 0) {
        const found = await page.evaluate(async () => {
          // A font is there when text set in it (with a very different fallback) gets another width.
          const ctx = document.createElement("canvas").getContext("2d");
          const width = (font) => ((ctx.font = font), ctx.measureText("iiiiWWWW 0123").width);
          await document.fonts.load("14px 'Inter Variable'");
          return [width("14px 'Inter Variable', monospace") !== width("14px monospace"), width("14px 'JetBrains Mono', serif") !== width("14px serif")];
        });
        if (!found[0]) throw new Error("the bundled Inter did not load");
        if (!found[1]) problems.push(`${v.out}: JetBrains Mono is not installed (code is drawn with a fallback font)`);
        // Text that is wider than the room it was given (data-fit), or that sticks out of the picture.
        const overflow = await page.evaluate(() => {
          const svg = document.querySelector("svg");
          const w = svg.viewBox.baseVal.width, h = svg.viewBox.baseVal.height;
          const list = [];
          for (const t of document.querySelectorAll("text")) {
            const b = t.getBBox();
            const fit = Number(t.getAttribute("data-fit") ?? "0");
            if (fit > 0 && b.width > fit + 0.5) list.push(`"${t.textContent}" is ${b.width.toFixed(0)} px wide, room for ${fit}`);
            if (b.x < 2 || b.y < 2 || b.x + b.width > w - 2 || b.y + b.height > h - 2) list.push(`"${t.textContent}" sticks out of the picture`);
          }
          return list;
        });
        for (const o of overflow) problems.push(`${v.out}: ${o}`);
      }
      const png = join(work, `${v.out.replaceAll("/", "_")}-${f}.png`);
      await page.screenshot({ path: png, omitBackground: true });
      pngs.push(png);
    }
    const scale = mod.scale ?? 2;
    jobs.push({ out: join(images, v.out), frames: pngs, frameMs: mod.frameMs ?? 100, width: 720 * scale, height: height * scale, lossy: mod.lossy === true, quality: mod.quality ?? 85 });
  }
  console.log(`${name}: ${mod.variants.length} variant(s)`);
}
await browser.close();

// 3. WebP (Pillow): still or animated, at 2× (or scaled down to 720 px).
writeFileSync(join(work, "jobs.json"), JSON.stringify({ jobs, preview }));
try {
  execFileSync("python3", [join(here, "to_webp.py"), join(work, "jobs.json")], { stdio: "inherit" });
} finally {
  rmSync(work, { recursive: true, force: true });
}
for (const p of problems) console.warn(`WARNING ${p}`);
if (problems.length > 0) process.exitCode = 1;
