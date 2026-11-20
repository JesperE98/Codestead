// Draws Codestead Linux's chapter pictures: every <name>.mjs in this folder is the source of one picture (in one variant
// per language, or one shared) and becomes images/<variant>.webp. See "Bilder i Codestead Linux" in docs/DEVELOPMENT.md.
// Codestead GP's diagrams (src/GP/content/images/diagrams) are the model: the same style (style.mjs here re-exports
// GP's), the same WebP step (GP's to_webp.py); what is Linux's own is the eleven languages and the simulator's terminal.
//
//   npm ci --prefix src/Linux/content/images/diagrams     (once: the fonts for Arabic, Hindi, Chinese and Japanese)
//   node src/Linux/content/images/diagrams/make.mjs [name …] [--preview <dir>]
//
// A source exports
//   variants: perLanguage("x") (en/x.webp, sv/x.webp … – one per language) or shared("x") (x.webp, no words or names)
//   words?: { key: { en: "…", sv: "…", … } } – the picture's translation table; every entry needs all eleven languages
//   height: number (the width is always 720), or height(v, R)
//   draw(v, R): the SVG (svg(…) from style.mjs) for a variant; v.lang is its language
//   terminals?: { id: { commands: [...], setup?: [...], distro?, time? } } or terminals(v) – commands the simulator runs
//              on a fresh computer with the learner's world in v.lang ({{placeholders}} are filled in); R[id].lines is
//              what the terminal shows (see terminal() in style.mjs). ts/packages/linux-shell/test/TerminalPictures.test.ts
//              runs them (only with CODESTEAD_TERMINAL_PICTURES, so ordinary test runs are not affected).
//   lossy?: true, quality?: 85, scale?: 1 – as GP's (lossless 2× by default)
//
// A language whose picture comes out the same as English's (no words, and the world's names are the English ones – ru,
// zh, ja, ar, hi) is not written: the app falls back to en/. Needs Node with Playwright and its Chromium, python3 with
// Pillow, Inter (ts/node_modules, npm ci in ts/), JetBrains Mono (installed) and the Noto fonts of this folder's
// package.json (build-time only, never in an app). --preview <dir> writes every picture as PNG on the app's light and
// dark text background, to look at.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LANGS } from "./style.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const images = dirname(here);
const repo = join(images, "..", "..", "..", "..");
const ts = join(repo, "ts");
const gpDiagrams = join(repo, "src", "GP", "content", "images", "diagrams");

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
};
const preview = option("--preview");
const names = args.length > 0 ? args : readdirSync(here).filter((f) => f.endsWith(".mjs") && !f.startsWith("_") && f !== "make.mjs" && f !== "style.mjs").map((f) => f.slice(0, -4)).sort();

const sources = [];
const problems = [];
for (const name of names) {
  const file = join(here, `${name}.mjs`);
  if (!existsSync(file)) throw new Error(`no picture ${name} (${file})`);
  const mod = await import(pathToFileURL(file).href);
  sources.push({ name, mod });
  // The translation table: every entry in every language.
  for (const [key, entry] of Object.entries(mod.words ?? {}))
    for (const lang of LANGS) if (typeof entry[lang] !== "string" || entry[lang].trim() === "") problems.push(`${name}: words.${key} has no ${lang}`);
}
if (problems.length > 0) {
  for (const p of problems) console.error(`ERROR ${p}`);
  process.exit(1);
}

// 1. The terminals: every command list of every variant goes to the simulator in one run.
const terminalsOf = (mod, v) => (typeof mod.terminals === "function" ? mod.terminals(v) : mod.terminals) ?? {};
const key = (name, id, v, spec) => `${name}-${id}-${v.lang}-${createHash("sha1").update(JSON.stringify(spec)).digest("hex").slice(0, 10)}`;
const termDir = join(tmpdir(), `codestead-linux-terminals-${process.pid}`);
const requests = [];
for (const { name, mod } of sources)
  for (const v of mod.variants)
    for (const [id, spec] of Object.entries(terminalsOf(mod, v))) requests.push({ key: key(name, id, v, spec), lang: v.lang, ...spec });
if (requests.length > 0) {
  mkdirSync(termDir, { recursive: true });
  writeFileSync(join(termDir, "requests.json"), JSON.stringify(requests, null, 1));
  console.log(`The simulator runs ${requests.length} terminal(s) …`);
  execFileSync("npx", ["vitest", "run", "packages/linux-shell/test/TerminalPictures.test.ts"], {
    cwd: ts,
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, CODESTEAD_TERMINAL_PICTURES: termDir, TZ: "UTC" },
  });
}
function terminalsFor(name, mod, v) {
  const R = {};
  for (const [id, spec] of Object.entries(terminalsOf(mod, v))) R[id] = JSON.parse(readFileSync(join(termDir, `${key(name, id, v, spec)}.json`), "utf8"));
  return R;
}

// 2. The fonts: Inter (the apps' own copy) for Latin, Greek and Cyrillic, JetBrains Mono for code, and for the other
// scripts a Noto font from this folder's node_modules under the name "CS Script", after Inter and JetBrains Mono in
// every font list (so it is only used for what they cannot draw).
const inter = join(ts, "node_modules", "@fontsource-variable", "inter");
if (!existsSync(join(inter, "wght.css"))) throw new Error(`Inter is missing (${inter}): run npm ci in ts/ first`);
const scriptFont = { ar: "noto-sans-arabic", hi: "noto-sans-devanagari", zh: "noto-sans-sc", ja: "noto-sans-jp" };
function scriptCss(lang) {
  const pkg = scriptFont[lang];
  if (pkg === undefined) return "";
  const dir = join(here, "node_modules", "@fontsource-variable", pkg);
  if (!existsSync(join(dir, "wght.css"))) throw new Error(`The ${lang} font is missing (${dir}): run npm ci --prefix ${here}`);
  return readFileSync(join(dir, "wght.css"), "utf8")
    .replace(/font-family:\s*'[^']+'/g, "font-family: 'CS Script'")
    .replace(/url\(\.\/([^)]+)\)/g, (_m, f) => `url(${pathToFileURL(join(dir, f)).href})`);
}
const page0 = (lang, body) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(join(inter, "wght.css")).href}">
<link rel="stylesheet" href="${pathToFileURL(join(inter, "wght-italic.css")).href}">
<style>${scriptCss(lang)}
html,body{margin:0;background:transparent}svg{display:block}text,tspan{font-variant-ligatures:none}
[font-family*="Inter"]{font-family:'Inter Variable','CS Script',sans-serif}
[font-family*="JetBrains"]{font-family:'JetBrains Mono','CS Script',monospace}</style>
</head><body>${body}</body></html>`;

// 3. Every variant at 2×, by Chromium; a language the same as English is left out.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const work = join(tmpdir(), `codestead-linux-diagrams-${process.pid}`);
mkdirSync(work, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ deviceScaleFactor: 2 });
const page = await context.newPage();
const jobs = [];
const notWritten = [];
for (const { name, mod } of sources) {
  const english = new Map();
  let written = 0;
  for (const v of mod.variants) {
    const R = terminalsFor(name, mod, v);
    const height = Math.round(typeof mod.height === "function" ? mod.height(v, R) : mod.height);
    const body = mod.draw(v, R);
    const base = v.out.replace(/^[a-z]{2}\//, "");
    if (v.lang === "en") english.set(base, body);
    else if (english.get(base) === body) {
      // The same as English: the app shows en/ (an older picture of this language would be shown instead, so it goes).
      rmSync(join(images, v.out), { force: true });
      notWritten.push(v.lang);
      continue;
    }
    const html = join(work, "page.html");
    writeFileSync(html, page0(v.lang, body));
    await page.setViewportSize({ width: 720, height });
    await page.goto(pathToFileURL(html).href);
    const fonts = await page.evaluate(async () => {
      const all = document.querySelector("svg").textContent;
      const loaded = await document.fonts.load("19px 'CS Script'", all);
      await document.fonts.load("14px 'Inter Variable'");
      await document.fonts.ready;
      const ctx = document.createElement("canvas").getContext("2d");
      const width = (font) => ((ctx.font = font), ctx.measureText("iiiiWWWW 0123").width);
      return { script: loaded.length, inter: width("14px 'Inter Variable', monospace") !== width("14px monospace"), mono: width("14px 'JetBrains Mono', serif") !== width("14px serif"), text: all };
    });
    if (!fonts.inter) throw new Error("the bundled Inter did not load");
    if (!fonts.mono) problems.push(`${v.out}: JetBrains Mono is not installed (code is drawn with a fallback font)`);
    // Letters Inter has no glyphs for (not Latin, Greek or Cyrillic) need the language's script font.
    if (/[^\u0000-ԯḀ-῿ -⯿]/u.test(fonts.text) && fonts.script === 0) problems.push(`${v.out}: no script font for "${v.lang}" (text in another script is drawn with a system font)`);
    const issues = await page.evaluate((min) => {
      const svg = document.querySelector("svg");
      const w = svg.viewBox.baseVal.width, h = svg.viewBox.baseVal.height;
      const list = [];
      for (const t of document.querySelectorAll("text")) {
        const b = t.getBBox();
        const fit = Number(t.getAttribute("data-fit") ?? "0");
        if (fit > 0 && b.width > fit + 0.5) list.push(`"${t.textContent}" is ${b.width.toFixed(0)} px wide, room for ${fit}`);
        if (b.x < 2 || b.y < 2 || b.x + b.width > w - 2 || b.y + b.height > h - 2) list.push(`"${t.textContent}" sticks out of the picture`);
      }
      for (const t of document.querySelectorAll("text, tspan"))
        if (t.textContent.trim() !== "" && parseFloat(getComputedStyle(t).fontSize) < min - 0.05) list.push(`"${t.textContent}" is ${parseFloat(getComputedStyle(t).fontSize).toFixed(1)} px (at least ${min})`);
      return list;
    }, 19);
    for (const o of issues) problems.push(`${v.out}: ${o}`);
    const png = join(work, `${v.out.replaceAll("/", "_")}.png`);
    await page.screenshot({ path: png, omitBackground: true });
    const scale = mod.scale ?? 2;
    jobs.push({ out: join(images, v.out), frames: [png], frameMs: 100, width: 720 * scale, height: height * scale, lossy: mod.lossy === true, quality: mod.quality ?? 85 });
    written++;
  }
  console.log(`${name}: ${written} picture(s)${mod.variants.length > written ? ` (${mod.variants.length - written} language(s) the same as English)` : ""}`);
}
await browser.close();

// 4. WebP (GP's to_webp.py): lossless at 2× unless the source says otherwise.
writeFileSync(join(work, "jobs.json"), JSON.stringify({ jobs, preview: preview === null ? null : resolve(preview), root: images }));
try {
  execFileSync("python3", [join(gpDiagrams, "to_webp.py"), join(work, "jobs.json")], { stdio: "inherit" });
} finally {
  rmSync(work, { recursive: true, force: true });
  rmSync(termDir, { recursive: true, force: true });
}
if (notWritten.length > 0) console.log(`Not written (the same as English, the app shows en/): ${notWritten.length} language picture(s).`);
for (const p of problems) console.warn(`WARNING ${p}`);
if (problems.length > 0) process.exitCode = 1;
