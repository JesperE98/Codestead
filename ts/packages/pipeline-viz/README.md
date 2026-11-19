# @codestead/pipeline-viz

The scenes of the **Render Pipeline Visualizer** (<https://github.com/jesper-e98/RenderpipelineVisualizer>, by the
same owner as Codestead), live inside Codestead GP's chapters: the learner steps through a slide's steps and sees its
real animations, in the chosen graphics API, the window's language (Swedish or English; other languages get English)
and its light or dark theme. How a chapter places a scene, and the rest, is in `docs/DEVELOPMENT.md`
("Scener ur visualiseraren").

**Source:** the visualizer at commit **d4ec337** ("Merge pull request #4 …"), copied by `scripts/sync-visualizer.mjs`.

## Layout

| Folder | What | Type-checked by |
| --- | --- | --- |
| `visualizer/` | The visualizer's code as it is in its repository: `core/`, `model/`, `pipeline/`, `slides/`, `views/`, `workers/`, `styles/`, and the tests of that code in `tests/`. Not copied: the app shell (`main.ts`), its slide engine (URL hash, transitions), the file drop and loading overlay, and the WebXR holo lab (`src/xr/`). | `tsconfig.json` here (the visualizer's own compiler options) |
| `engine/` | Codestead's code that runs a slide in a chapter: `mount.ts` (one scene: shadow roots, its own WebGL renderer, the design size scaled to the chapter's width), `light.ts` (the 3D scenes in the light theme), `css.ts`/`styles.ts`/`embed.css` (the stylesheets in the scene's shadow root, and their light version), `tween.ts` (instead of GSAP, see below). Loaded on demand, with three.js, as a chunk of its own. | `tsconfig.json` here |
| `src/` | The React side: `PipelineScene` (the scene with its controls, lazy start, pause, fallback), `Scenes` (which scenes a chapter can place), `VizSource` (`viz:` sources), `SceneSteps`, `SceneBudget` (at most two scenes run at once), `useAppTheme`. Never imports the engine directly (`Environment.ts` loads it). | the workspace's `tsconfig.json` |
| `test/` | Codestead's tests (jsdom, no WebGL). | the workspace's `tsconfig.json` |

The copy in `visualizer/` is changed only mechanically by the sync script: `import gsap from 'gsap'` points to
`engine/tween.ts`, the slides' stylesheet imports become comments (the stylesheets are adopted in each scene's shadow
root by `engine/styles.ts`, so they never style the rest of the window), and the tests' `../src/` paths become `../`.

## Updating from the visualizer

```bash
cd ts/packages/pipeline-viz
node scripts/sync-visualizer.mjs /path/to/RenderpipelineVisualizer   # prints the commit it copied
git diff visualizer/
cd ../.. && npm run typecheck && npx vitest run packages/pipeline-viz apps/gp/test
```

Then put the new commit above, check the scenes in the app (see `docs/DEVELOPMENT.md`), and capture the still pictures
again if the slides changed (`src/GP/content/images/visualizer/`). If the visualizer starts using a part of GSAP that
`engine/tween.ts` lacks, the typecheck says so (it has GSAP's names, only what the slides use).

## Licences

- **three.js** (MIT) and **highlight.js** (BSD-3-Clause) are bundled into the app; their licence texts are in
  `THIRD-PARTY-NOTICES.txt`, which the engine's chunk ships (`engine/mount.ts`: `thirdPartyNotices`).
- **GSAP is not shipped.** The visualizer uses GSAP 3, whose package is under GreenSock's "Standard 'no charge'
  license", which the package only links to (gsap.com/standard-license): not an open-source licence, with terms that
  can change and restrictions on some uses. Since it is not clearly fine to redistribute in a free desktop app,
  `engine/tween.ts` implements the small part of GSAP's API the slides use (to, from, fromTo, set, timeline,
  killTweensOf, delayedCall; the eases none, power1–3, sine and back).
- The visualizer's own code is the owner's, like Codestead.
