// Copies the Render Pipeline Visualizer's code into visualizer/ (see README.md, "Updating from the visualizer"):
//
//   node scripts/sync-visualizer.mjs <path to a clone of the visualizer>
//
// What is copied: src/{core,model,pipeline,slides,views,workers,styles} and the tests of that code. Not copied: the
// app shell (main.ts, index.html), the slide engine with its URL hash and transitions (core/SlideEngine.ts: engine/
// has its own), the file drop and loading overlay (core/modelLoader.ts, views/LoadingOverlay.ts) and the WebXR holo
// lab (src/xr/, its tests). The copy is changed only mechanically:
//   - `import gsap from 'gsap'` → engine/tween.ts (GSAP is not shipped, see engine/tween.ts),
//   - a slide's `import '../styles/slides/x.css'` becomes a comment: the scenes live in a shadow root, and
//     engine/styles.ts adopts every stylesheet there (imported globally they would style the whole app),
//   - the tests' `../src/` → `../`.
// Afterwards: git diff visualizer/, npm run typecheck and the tests in ts/, and the README's source commit.

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const source = process.argv[2];
if (!source || !fs.existsSync(path.join(source, "src", "slides"))) {
  console.error("usage: node scripts/sync-visualizer.mjs <path to the visualizer's clone>");
  process.exit(1);
}
const pkg = fileURLToPath(new URL("..", import.meta.url));
const target = path.join(pkg, "visualizer");
const dirs = ["core", "model", "pipeline", "slides", "views", "workers", "styles"];
const skip = new Set(["core/SlideEngine.ts", "core/modelLoader.ts", "views/LoadingOverlay.ts"]);
const tests = ["fixtures.ts", "loaders.test.ts", "pipeline.test.ts", "workers.test.ts"];

for (const d of [...dirs, "tests"]) fs.rmSync(path.join(target, d), { recursive: true, force: true });

function copy(from, to, rel) {
  if (fs.statSync(from).isDirectory()) {
    for (const name of fs.readdirSync(from)) copy(path.join(from, name), path.join(to, name), `${rel}/${name}`);
    return;
  }
  if (skip.has(rel)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  let text = fs.readFileSync(from, "utf8");
  if (to.endsWith(".ts")) {
    const tween = path.relative(path.dirname(to), path.join(pkg, "engine", "tween")).replaceAll("\\", "/");
    text = text.replace(/^import gsap from 'gsap';$/m, `import gsap from '${tween}';`);
    text = text.replace(/^import '(\.\.\/styles\/[^']+\.css)';$/gm, "// $1: adopted in the scene's shadow root (engine/styles.ts)");
    if (rel.startsWith("tests/")) text = text.replaceAll("'../src/", "'../");
  }
  fs.writeFileSync(to, text);
}

for (const d of dirs) copy(path.join(source, "src", d), path.join(target, d), d);
for (const t of tests) copy(path.join(source, "tests", t), path.join(target, "tests", t), `tests/${t}`);

let commit = "?";
try {
  commit = execFileSync("git", ["-C", source, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
} catch {
  /* not a git clone */
}
console.log(`Copied the visualizer (commit ${commit}) into ${path.relative(process.cwd(), target) || "."}; update the commit in README.md.`);
