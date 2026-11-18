# Byte till TypeScript

Beslutat 2026-11-17: Codestead – **Codestead Linux, Codestead GP och hubben** – går över till **TypeScript**:
React för gränssnittet, **Electron** för de installerade apparna (som före oktober 2026) och **simulatorerna omskrivna
i TypeScript** (Linux-skalet och GPU-simulatorn). C#-apparna finns kvar och släpps som vanligt **parallellt** tills
TypeScript-versionerna kan lika mycket; då byter vi.

## Principer
- **Översätt dagens C#-kod, med dess tester.** Varje C#-modul får en TypeScript-motsvarighet med samma beteende, och
  dess xUnit-tester översätts till Vitest. Paritet bevisas av testerna, inte av att koden "ser likadan ut". Den gamla
  TypeScript-versionen (före commit 2afb7c8) kan användas som referens för skalet, men grunden är C#-koden av i dag.
- **Innehållet delas.** Kurstexter, uppgifter, övningar, projekt, bilder och översättningar (`src/*/content`,
  `build/languages.json`, ändringsloggarna) används av båda versionerna utan kopior.
- **Samma data för eleven.** TypeScript-apparna läser och skriver samma filer som C#-apparna (`<AppData>/Codestead/
  <app-id>/*.json`, samma JSON-namn), så framsteg, XP och inställningar följer med vid bytet.
- **Samma produkter och katalog.** Samma app-id:n, ikoner, versionsserier och release-repo; hubben installerar och
  uppdaterar apparna som i dag.

## Kodbas
`ts/` i repots rot, ett npm-workspace (TypeScript strict, Vite, Vitest, React 19, Electron, electron-builder):

| Paket | Motsvarar | Innehåll |
|---|---|---|
| `ts/packages/common` | `Codestead.Common` | språk, produktinfo, små hjälpfunktioner |
| `ts/packages/learning` | `Codestead.Learning` | kursmodell, framsteg, spelregler (XP, utmärkelser, streaks), quiz |
| `ts/packages/ui` | `Codestead.UI`, `Codestead.Learning.UI` | React: tema, markdown-vy (bilder, länkar, hopfällda block), dialoger, lärfönstret |
| `ts/packages/linux-shell` | `Codestead.Shell`, `Codestead.Terminal` | skal, filsystem, kommandon, terminal |
| `ts/packages/linux-content` | `Codestead.Content` | Linux-kursens laddning och kontroller |
| `ts/packages/gp-gpu` | `Codestead.GP.Gpu` | den simulerade GPU:n: läsare, GLSL/HLSL-tolk, rasterizer |
| `ts/packages/gp-course` | `Codestead.GP.Course` | GP-kursen: uppgifter, övningar, kontroller, "Kontrollera min kod" |
| `ts/apps/linux`, `ts/apps/gp`, `ts/apps/hub` | apparna | Electron (main + preload) och appens React-del |

## Faser
1. **Grund** – workspace, verktyg, CI-jobb för TypeScript (bygg, typkontroll, Vitest), `common`.
2. **Gemensam kärna och UI** – `learning` och `ui`: lärfönstret visar kapitel, quiz, uppgifter, framsteg och
   ändringslogg; samma lagringsformat som C#.
3. **Linux** – `linux-shell` (översatt modul för modul med testerna), `linux-content`, appen `ts/apps/linux`.
4. **GP** – `gp-gpu` och `gp-course` (med uppgifts- och övningstesterna: varje uppgift och övning i varje API ska ge
   samma resultat som i C#), appen `ts/apps/gp`.
5. **Hubben och paketering** – `ts/apps/hub`, electron-builder (deb, rpm, pkg.tar.zst, AppImage, Windows), uppdateringar,
   katalogen, installationstesterna i CI.
6. **Byte** – när en TypeScript-app klarar sina tester och installationstester släpps den som nästa version av samma
   produkt; C#-koden för den appen tas sedan bort.

## Läge
- [x] 1. Grund – `ts/` (npm-workspace, TypeScript, Vitest), `@codestead/common`, CI-jobbet `TypeScript` i ci.yml
- [x] 2. Gemensam kärna och UI – `learning` och `ui` (React): lärfönstret, markdown, dialoger, spelvyer; samma sparfiler som C#
- [x] 3. Linux – `linux-shell` (hela skalet, alla kommandon), `linux-content` (alla kapitel lösta av sina lösningar i 4 distar och 11 språk) och appen `ts/apps/linux` (Electron, terminalen i React, `--smoke-test`, e2e-test)
- [x] 4. GP – `gp-gpu` (kärnan och läsarna för OpenGL, Vulkan, D3D12; samma bilder som C#), `gp-course` (alla 623 uppgifts- och övningstester gröna i alla tre API:er; körs i CI-jobbet `ts-gp-tasks`) och appen `ts/apps/gp` (Electron, "Ditt projekt" med Kontrollera min kod i en arbetstråd, `--smoke-test`, e2e-test)
- [ ] 5. Hubben och paketering – appen `ts/apps/hub` klar (samma katalog, paket och installationer som C#-hubben); kvar: paketering, självuppdatering, installationstester
- [ ] 6. Byte

## Apparna

### `ts/apps/linux` – Codestead Linux
Electron-appen: samma lärfönster (`@codestead/ui`) med Linux-verktyget och den simulerade terminalen.

| C# | TypeScript |
|---|---|
| `Program.cs`, `AppHost` (`--version`, `--smoke-test`) | `electron/main.ts` |
| `App.axaml(.cs)` (tema, Linux-färgen, lärfönstret) | `src/App.tsx`, `src/main.tsx` |
| `ProductInfo.cs` (ur `build/Codestead.props`) | `src/ProductInfo.ts` (läser samma fil) |
| `LinuxTool.cs`, `LinuxTool.Terminal.cs` | `src/LinuxTool.tsx`, `src/LinuxTool.Terminal.tsx` (titelraden) |
| `Codestead.Terminal/TerminalView.cs`, `Ansi.ToInlines` | `src/Terminal/TerminalView.tsx`, `src/Terminal/AnsiText.tsx` |
| `LearningWindow.SmokeTest.cs` | `src/SmokeTest.ts` |
| `Codestead.UI.Storage` | `electron/FileStorage.ts` (samma mapp och filer: `state.json`, `shell.<distro>.json` …) |

- **Bygga:** `npm run build` i `ts/apps/linux` – Vite bygger sidan till `dist/` och sedan, med
  `vite.electron.config.ts`, main-processen och preload-skriptet var för sig till `dist-electron/main.cjs` och
  `dist-electron/preload.cjs` (CommonJS: ett sandlådat preload-skript kan varken vara en ES-modul eller läsa egna filer).
- **Köra:** `npm start` (efter `build`); `npm run smoke-test` skriver `SMOKE OK …`. Som root (container, CI) behöver
  Electron `--no-sandbox`. Under utveckling: `npm run dev` (Vite) och `VITE_DEV_SERVER_URL=http://localhost:5173 npm start`.
  `CODESTEAD_DATA_DIR` styr datamappen som i C#.
- **Testa:** `npm test` (Vitest: terminalen, verktyget, lagringen) och `npm run test:e2e` (bygger appen och kör den med
  Playwrights `_electron`: första kapitlet, `ls`, frågorna, första uppgiften bockas av, omstart, `--smoke-test`;
  Playwright måste kunna hittas med `require("playwright")`, utan skärm startas Xvfb, `E2E_SHOTS=<mapp>` sparar bilder).
- Fönstret: `contextIsolation`, ingen `nodeIntegration`, `sandbox`; preload ger `window.codestead` (`electron/api.ts`):
  lagring (synkron, som i C#), webblänkar (bara http/https), fil- och mappväljare, version, avsluta.
- Kvar (fas 5): uppdateringar (Velopack i C#; nu "inga uppdateringar") och paketering; typsnittet Inter följer inte med
  än (C# bäddar in det), så systemets typsnitt används.

### `ts/apps/gp` – Codestead GP
Electron-appen: samma lärfönster (`@codestead/ui`) med GP-verktyget – kursen (`@codestead/gp-course`), API:erna som
varianter, IDE-väljaren och panelen "Your project" som arbetsyta.

| C# | TypeScript |
|---|---|
| `Program.cs`, `AppHost` (`--version`, `--smoke-test`) | `electron/main.ts` |
| `App.axaml(.cs)` (tema, GP-färgen, lärfönstret) | `src/App.tsx`, `src/main.tsx`, `src/gp.css` |
| `ProductInfo.cs` (ur `src/GP/Directory.Build.props` och `build/Codestead.props`) | `src/ProductInfo.ts` (läser samma filer) |
| `GpTool.cs`, `GpTool.Ide.cs`, `GpTool.Project.cs`, `GpTool.Files.cs`, `NoSandbox.cs` | `src/GpTool.tsx` (en klass), `src/GpTool.Ide.tsx` (väljaren), `src/ProjectResources.ts` (vad "Save resources…" sparar) |
| `GpTool.Solution.cs` | `src/GpTool.Solution.tsx` (lösningen i ett eget fönster; ✕, Escape och Close stänger) |
| `GpTool.SmokeTest.cs`, `LearningWindow.SmokeTest.cs` | `src/GpTool.SmokeTest.ts`, `src/SmokeTest.ts`, `GpTool.solveForSmokeTest` |
| `YourProject/*` (panelen, uppgifternas lägen, förväntat resultat) | `src/YourProject/*` (`MainFiles` finns i `@codestead/gp-course`) |
| Bakgrundstrådarna (`Task.Run`: kontrollen, bilderna) och filerna | `electron/worker.ts` + `electron/CourseService.ts` (arbetstråd i main-processen), `electron/CourseWorkers.ts`, `src/CourseHost.ts` |
| `Codestead.UI.Storage` | `electron/FileStorage.ts` (samma mapp och filer: `state.json`, `profile.json`, `ide.json`, `mainfiles.json`, `folders.json`, `project.<api>.<kapitel>.json` …) |

- **Var kursen körs:** fönstret (sandlådat, utan `node:fs`) har kursens texter, uppgifter och kontroller men läser och
  skriver inga filer. "Check my code" (elevens filer läses och körs i den simulerade GPU:n, kan ta sekunder), de
  förväntade bilderna och "Save resources…"/"Save my earlier code…" körs i en **Node-arbetstråd i main-processen**
  (`dist-electron/worker.cjs`, två stycken: en för kontroller och sparande, en för bilder – som C# kör dem på egna
  trådar), så varken fönstret eller main-processen (som svarar på fönstrets synkrona lagringsanrop) väntar. En
  kontroll som blir inaktuell (annan fil, annat kapitel, ny kontroll) stoppas genom att tråden avslutas. Fönstret
  frågar bara om sökvägar och om filer finns (synkron IPC, `PathOp`). Rapporten går över som data (`CheckReportData`)
  och blir `CheckReport`/`BuildFacts` igen; bilden som BGRA-pixlar och visas som BMP (ingen canvas behövs).
- **Kursens binära filer** (texturer, modeller, typsnitt) läses med `node:fs` i arbetstråden – inte med `preloadBytes`
  i fönstret: de behövs bara där simulatorn kör och där filer sparas, och båda sker i arbetstråden (som ändå måste
  läsa elevens filer); fönstret slipper ladda ~30 MB i onödan. Arbetstråden hittar dem i `src/GP/content` via
  sökvägen till `Resources.ts` (sätts i `vite.electron.config.ts`). Kapitlens bilder visas med URL:erna Vite ger dem
  (`GpTool.picture`), så bara de som visas laddas.
- **Bygga:** `npm run build` i `ts/apps/gp` – sidan till `dist/`, sedan main, preload och arbetstråden var för sig till
  `dist-electron/{main,preload,worker}.cjs`. **Köra:** `npm start` (som root: `npx electron . --no-sandbox`);
  `npm run smoke-test` skriver `SMOKE OK Codestead GP … (… chapters, … languages, … projects, … simulated builds, 4 IDEs,
  … checks of the learner's code)`. `npm run dev` ger sidan i en webbläsare (utan filer: ingen kontroll, inga bilder).
- **Testa:** `npm test` (Vitest: verktyget och panelen i fönstret med kursens arbete i samma process, rapportens
  överföring, lagringen och C#:s `PictureTests`) och `npm run test:e2e` (bygger appen och kör den med Playwrights
  `_electron`: första kapitlet; i Hello Triangle besvaras frågorna, en uppgift bockas av med Mark as done, den tidigare
  editorns kod – startfilerna – sparas i en mapp, Check my code på den (inga uppgifter lösta), kursens lösning skrivs
  dit och Check my code bockar av stegen, lösningsfönstret stängs med ✕ och Escape, förväntat resultat ritas och
  förstoras; sedan `--smoke-test` och `--version`. Mappväljaren besvaras från testet. Playwright måste kunna hittas
  med `require("playwright")`, utan skärm startas Xvfb, `E2E_SHOTS=<mapp>` sparar bilder).
- Kvar (fas 5): uppdateringar (Velopack; nu "inga uppdateringar") och paketering – paketet måste ta med kursens
  innehåll (`src/GP/content`) och peka arbetstråden dit.

### `ts/apps/hub` – hubben (Codestead)
Översättning av `src/Hub/Codestead.Hub.Core` (i `src/core/`) och `src/Hub/Codestead.Hub` (React). Hubben installerar
verktygen som i dag: den signerade katalogen (`catalog.json` + `.sig`, ECDSA P-256, nyckeln `build/catalog-signing.pub.pem`)
från release-repot, de portabla paketen per plattform (`linux-x64` → `.tar.gz`, `win-x64` → `.zip`) med kontroll av
storlek och SHA-256, installation per användare i `<CODESTEAD_HUB_DIR | ~/.local/share/codestead | %LOCALAPPDATA%\Codestead>/tools/<id>/<version>`
med `current.json` i samma format som C#-hubben (de läser varandras installationer, så C#-versionerna av apparna
installeras och uppdateras som förut), föregående version kvar för "Gå tillbaka", inställningarna i `Codestead/codestead-hub/state.json`
och verktygens `profile.json`/`whatsnew.json` i deras egna mappar.

- **Delar:** `src/core/` (ren TypeScript; det som behöver filsystem, nätverk eller processer – `ToolStore`, `CatalogClient`,
  `CatalogVerifier`, `Archives` (tar.gz/zip utan beroenden), `Autostart`, `SingleInstance` (samma pipe/socket som C#-hubbens),
  `TraySupport` – körs i Electrons main-process, med nätverket (`Http.ts`) och processerna injicerade som i C#),
  `src/MainWindow*.ts(x)` (fönstrets tillstånd och vy), `electron/main.ts` (Program/App, IPC, fältet, `--smoke-test`, `--version`),
  `electron/preload.ts` (`window.codestead`, typen `src/HubApi.ts`).
- **Bygga:** i `ts/apps/hub`: `npm run build` (Vite: fönstret till `dist/`, main och preload var för sig till
  `dist-electron/main.cjs` och `preload.cjs`). **Köra:** `npm start` (som root/i container: `npx electron . --no-sandbox`),
  `npm run dev` (Vites dev-server med omladdning). `--smoke-test [--catalog <fil> --public-key <pem> --install <id>]`
  fungerar som C#-hubbens (`packaging/hub-e2e.sh`).
- **Testa:** `npx vitest run apps/hub` från `ts/` (Hub.Core-testerna och hubbens övriga tester, plus fönstret mot en
  låtsad main-process). End-to-end: `npm run test:e2e` i `ts/apps/hub` – bygger appen och startar den med Playwright
  (`_electron`; Playwright hittas där det är installerat, t.ex. globalt) mot en egen signerad katalog med lokala paket,
  så inget laddas ner (`CODESTEAD_HUB_E2E=1` gör att `--catalog`/`--public-key` gäller utan `--smoke-test`). Utan
  skärm startar testet en egen Xvfb; `CODESTEAD_E2E_SHOTS=<mapp>` sparar skärmbilder.
- **Kvar (TODO):** självuppdatering (Velopack i C#; nu "inga uppdateringar", en nyare hubb i katalogen erbjuds som
  nedladdning) och paketering kommer i fas 5.
