# Byte till TypeScript

Beslutat 2026-11-17: Codestead – **Codestead Linux, Codestead GP och hubben** – går över till **TypeScript**:
React för gränssnittet, **Electron** för de installerade apparna (som före oktober 2026) och **simulatorerna omskrivna
i TypeScript** (Linux-skalet och GPU-simulatorn). C#-apparna finns kvar och släpps som vanligt **parallellt** tills
TypeScript-versionerna kan lika mycket; då byter vi.

**Bytet är gjort (fas 6, 2026-11-18).** Release-flödet bygger nu TypeScript-apparna: nästa version av varje produkt –
Codestead Linux 0.6.6, Codestead GP 0.2.6 och hubben 0.2.5 – är den första i TypeScript, och C#-koden är borttagen ur
repot (den finns kvar i git-historiken, t.ex. i commit `a616425`). Den här filen är historiken över flytten; hur
projektet byggs, testas och släpps i dag står i [DEVELOPMENT.md](DEVELOPMENT.md). Kommentarer som "Port of
Codestead.Shell/…" eller "Port of tests/…" i TypeScript-koden pekar på C#-koden i historiken.

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
| `ts/packages/pipeline-viz` | (ny, Render Pipeline Visualizer) | visualiserarens scener, interaktiva i GP:s kapitel (`viz:`) |
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
- [x] 5. Hubben och paketering – appen `ts/apps/hub` klar (samma katalog, paket och installationer som C#-hubben); paketering (`build-linux.sh --ts`, `build-windows.ps1 -TsApp`: samma artefakter, namn, id:n och sökvägar), självuppdatering med Velopack (samma uppdateringskälla) och installationstesterna (`ts-packaging.yml`, grön i CI för Linux och Windows) klara
- [x] 6. Byte – uppgraderingstestet (en användares släppta C#-installation uppdaterar sig till TypeScript-bygget, se "Uppgraderingstest" nedan) grönt i `ts-packaging.yml` (AppImage och Setup.exe); release.yml bygger TypeScript-apparna och har uppgraderingstestet som spärr före publiceringen; C#-koden borttagen (se "Fas 6: bytet" nedan). Kvar: den första releasen för hand (Actions → Release → publish) och checklistan på riktiga datorer ([RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md), "Första TypeScript-releasen")

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
- Uppdateringar och paketering: se "Paketering och uppdateringar" nedan (`LinuxTool` får preloadens `selfUpdate`).
- Typsnittet Inter följer med apparna (`@fontsource-variable/inter` i `codestead.css`), som i C#. Det saknades i de
  första TypeScript-versionerna (0.6.6 / 0.2.6 / 0.2.5), som visade systemets typsnitt.

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
- Uppdateringar och paketering: se "Paketering och uppdateringar" nedan. Arbetstrådens bygge listar kursens binära
  filer i `dist-electron/repo-files.json`; paketet har dem på samma plats i förhållande till appen som i repot, så
  arbetstråden hittar dem utan ändring.

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
- Självuppdatering och paketering: se "Paketering och uppdateringar" nedan (en hubb som inte kan uppdatera sig själv
  erbjuder som förut en nyare hubb i katalogen som nedladdning).

## Paketering och uppdateringar (fas 5)
Så som det gjordes i fas 5, då C#-apparna fortfarande släpptes; vad som ändrades vid bytet står i "Fas 6: bytet" nedan.

TypeScript-apparna blir **samma artefakter** som C#-apparna – samma filnamn, paket-id:n, installationsmappar
(`/opt/<id>/`, `/usr/bin/<id>`, `%LOCALAPPDATA%\<id>\current\`), skrivbordsfiler, ikoner och körbara filer
(`Codestead.Linux`, `Codestead.GP`, `Codestead.Hub`; hubbens `current.json` och katalogen pekar på dem) – så att en
TypeScript-version kan släppas som nästa version av samma produkt (fas 6).

- **Bygga:** `packaging/build-linux.sh --ts ts/apps/<app> <csproj> <id> "<namn>" <version> [ut]` och
  `packaging/build-windows.ps1 -TsApp ts/apps/<app> -Project <csproj> …`: i stället för `dotnet publish` gör
  `packaging/ts/package-app.mjs` app-mappen, sedan samma steg som för C# (tar.gz/zip, nfpm, `vpk pack`). C#-projektet
  anges fortfarande: det ger den körbara filens namn. Utan `--ts`/`-TsApp` är skripten oförändrade.
- **`packaging/ts/package-app.mjs`:** bygger appen (`npm run build` med `VITE_CODESTEAD_VERSION`, som C#:s
  `-p:Version`), lägger den i Electrons app-mapp `resources/app` med **repots layout** (`ts/apps/<app>/dist`,
  `dist-electron`, och filerna appen läser från repot vid körning – GP:s kursfiler enligt `repo-files.json`), låter
  electron-builder (`--dir`) byta namn på Electron till den körbara filen, sätta ikon och versionsinformation i .exe
  (rcedit, bara på Windows) och ta bort Chromiums språkfiler utom apparnas språk. Ingen asar (arbetstråden och den
  inbyggda modulen är vanliga filer). `desktopName` = `<exe>.desktop` ger fönstret klassen `<exe>` som C#-appens
  (skrivbordsfilens `StartupWMClass`).
- **Linux: Chromiums sandlåda.** Den körbara filen (`<exe>`) är ett litet skript (`packaging/ts/launcher.sh`) bredvid
  Electron (`<exe>.bin`): Chromium sandlådar med användarnamnrymder eller med den setuid-märkta hjälpen
  `chrome-sandbox`, och startar inte alls där ingen av dem fungerar. Skriptet startar då med `--no-sandbox`: som root
  (containrar, installationstesterna), när namnrymderna är avstängda eller begränsade (Ubuntu 23.10 och senare,
  AppArmor) och `chrome-sandbox` inte är setuid root (hubbens installation per användare, AppImage). .deb/.rpm/Arch
  gör `chrome-sandbox` setuid root (`packaging/ts/postinstall.sh`), så där fungerar sandlådan alltid.
  Beroendena (`packaging/ts/nfpm.yaml`) är Electrons bibliotek (GTK, NSS, ALSA, CUPS …; på Ubuntu t64-paketen först).
- **Uppdateringar:** Velopacks Node-SDK (npm-paketet `velopack` 1.2.161 – samma version som C#-apparnas Velopack och
  `vpk`) i main-processen, `@codestead/ui/electron-main` (`runVelopackHooks` först i main, som
  `VelopackApp.Build().Run()`; `VelopackSelfUpdate` som C#:s `SelfUpdate`, med samma källa
  `https://github.com/<repo>/releases/download/<id>-latest/` som `HttpSource` – en sträng skulle Node-SDK:n tolka som
  ett GitHub-repo) och `@codestead/ui/electron-bridge` (preloadens `window.codestead.selfUpdate`). Installerad med
  Setup.exe eller som AppImage uppdaterar appen sig själv; .deb/.rpm/Arch och hubbens installation inte (Velopack är
  inte installerat där), som i C#. `vpk pack` får `--skipVeloAppCheck` på Windows (anropet finns i JavaScript, som
  vpk inte kan granska). Nupkg-filerna har samma id, kanal (`linux`/`win`) och `mainExe` som C#:s, och AppImagens
  `UpdateNix` och `AppRun` är byte för byte desamma, så en C#-installation uppdateras till en TypeScript-version från
  samma källa.
- **glibc:** Velopacks Linux-modul är byggd mot glibc 2.39 men använder 2.39-funktionerna (`pidfd_spawnp`,
  `pidfd_getpid`) bara som svaga symboler; `package-app.mjs` märker den versionen som valfri i modulen, så den laddas
  även med glibc 2.34–2.38 (Ubuntu 22.04, Debian 12). Modulen laddas först när den behövs; går den inte att ladda
  startar appen ändå, utan självuppdatering.
- **Testa:** `packaging/install-test.sh <id> <exe> <deb|rpm|arch|appimage> electron` (AppImagens bibliotek, och att
  `chrome-sandbox` är setuid root i paketen), `packaging/hub-e2e.sh` och `install-test-windows.ps1` som för C#.
  `.github/workflows/ts-packaging.yml` (vid `workflow_dispatch` och push till `ts-migration`) bygger de tre apparnas
  Linux- och Windows-artefakter och kör samma testmatris som release.yml, utan att publicera något.
- **Uppgraderingstest (C# → TypeScript):** `packaging/upgrade-test.sh <id> <exe> "<namn>" <produktmapp> <artefakter> [image]`
  (AppImage, i en ren container) och `packaging/upgrade-test-windows.ps1` (Setup.exe), jobben `upgrade-linux` och
  `upgrade-windows` i `ts-packaging.yml`. Den **släppta** C#-versionen (den som `<id>-latest`:s källa anger, hämtad
  från release-repot, inte byggd om) installeras som en användare gör, får användardata (lärapparna: en `state.json`
  med språk, tema och ett godkänt prov; C#-appen startas normalt en gång och skriver själv `state.json`,
  `profile.json` med sin XP och `whatsnew.json`; hubben: sina inställningar) och uppdaterar sig sedan från en lokal
  källa med TypeScript-bygget (samma filer som release.yml publicerar). Uppdateringen görs av
  `packaging/upgrade-driver`: C#-appens uppdateringsknapp utan fönster – `SelfUpdate`:s anrop på Velopacks
  `UpdateManager` (samma paket och version som apparna, läses ur `Codestead.UI.csproj`) med den installerade appens
  körbara fil som "den körande processen" (Velopacks `IProcessImpl`), så att installationens egen `UpdateNix`/`Update.exe`
  tillämpar uppdateringen och startar om appen (med `--smoke-test`). Sedan kontrolleras att installationen (samma
  AppImage-fil, `current\`, avinstallationsposten, genvägen) är TypeScript-bygget och startar, att användardatan är
  orörd och att TypeScript-appen läser den (normalt startad skriver den samma XP och utmärkelser i `profile.json` och
  den nya versionen i `whatsnew.json`); därefter TS → TS: bygget packat om som nästa version och tillämpat med
  TypeScript-appens egen uppdateringskod (Velopacks Node-SDK i den installerade appen, körd av dess Electron som Node:
  `packaging/ts/update-from-feed.cjs`), och på Windows en tyst avinstallation. Därför ger `packaging/ts/products.py`
  byggena den version bytet skulle släppa dem som (en patch över den senaste releasen, som `plan.py`), och
  `ts-packaging.yml` laddar upp uppdateringskällorna (`ts-feed-linux-<id>`, `ts-feed-windows-<id>`). Provat lokalt
  (2026-11-18) med AppImage på Ubuntu 24.04: Codestead Linux 0.6.5 → 0.6.6 → 0.6.7, Codestead GP 0.2.5 → 0.2.6 → 0.2.7,
  hubben 0.2.4 → 0.2.5 → 0.2.6 (Fedora-målet och Windows bara i CI).
- **Provat lokalt (2026-11-18):** alla Linux-artefakter för de tre apparna; installationstesterna i docker – Codestead
  Linux på Ubuntu 24.04 och 22.04 (.deb), Fedora (.rpm), Arch (.pkg.tar.zst) och AppImage på Ubuntu 24.04, Fedora och
  Arch; GP och hubben på Ubuntu (.deb), Fedora (.rpm), Arch och som AppImage; `hub-e2e.sh` med TypeScript-hubben som
  installerar TypeScript-versionerna av Linux och GP, och med den släppta C#-hubben 0.2.4 som installerar
  TypeScript-Linux; som vanlig användare (med sandlådan) och som root; en AppImage som uppdaterar sig från 0.6.0 till
  0.6.1 med Velopack från en lokal källa. Windows-mappen och `vpk pack` för Windows provades bara korsvis från Linux.
- **Storlek** (Electron i stället för .NET; C#: de släppta versionerna):

  | | Linux tar.gz | AppImage | .deb | .rpm | .pkg.tar.zst |
  |---|---|---|---|---|---|
  | Codestead Linux, C# 0.6.5 | 63 MB | 68 MB | 65 MB | 68 MB | 62 MB |
  | Codestead Linux, TS | 126 MB | 132 MB | 128 MB | 132 MB | 123 MB |
  | Codestead GP, C# 0.2.5 | 82 MB | 87 MB | 84 MB | 87 MB | 69 MB |
  | Codestead GP, TS | 157 MB | 148 MB | 159 MB | 163 MB | 139 MB |
  | Codestead (hubben), C# 0.2.4 | 61 MB | 66 MB | 63 MB | 65 MB | 60 MB |
  | Codestead (hubben), TS | 124 MB | 130 MB | 127 MB | 130 MB | 122 MB |

  Windows (C#: Setup.exe 77/96/75 MB, zip 94/113/92 MB): Codestead Linux i TypeScript gav korsvis ≈ 162 MB Setup.exe.

## Fas 6: bytet
Gjort 2026-11-18 (grenen `ts-switch`, från `ts-migration`). Användarna får samma filer, namn, paket-id:n, kanaler,
uppdateringskälla (`<id>-latest`), katalog och signering som förut – bara appen i dem är ny.

- **Produkterna i `packaging/products.json`.** Namn, id, körbar fil (`Codestead.Linux`, `Codestead.GP`,
  `Codestead.Hub`), version (`majorMinor`: 0.6, 0.2, 0.2), appens mapp i `ts/apps` och den sista C#-releasen
  (`lastCSharpRelease`: 0.6.5, 0.2.5, 0.2.4) – förut i `build/Codestead.props`, `src/GP/Directory.Build.props` och
  C#-projektens `AssemblyName`, lästa med `dotnet msbuild`. `plan.py`, `releases_readme.py`, byggskripten och apparna
  (`@codestead/common`: `Products`, som `ProductInfo` och `HubInfo` använder) läser filen; inget behöver .NET.
  `paths`/`own`/`exclude` pekar på TypeScript-källorna (appen och dess paket är produktens egna, `ts/packages/common`,
  `learning` och `ui` delade; testerna räknas inte). Hubbens `exclude` är de delar av `ui` och `learning` som bara
  lärapparna använder; `ProductFilesTests` följer hubbens importer och kontrollerar att den aldrig använder dem.
- **release.yml bygger TypeScript-apparna.** `build-linux.sh <app> <id> "<namn>" <exe> <version>` och
  `build-windows.ps1 -App … -Executable …` paketerar alltid appen med `packaging/ts/package-app.mjs` (vägen med
  `dotnet publish` och C#:s `nfpm.yaml` är borta). Testjobben är TypeScript-testerna (typkontroll, Vitest och GP:s
  TaskTests i parallella jobb per kursdel); installationstesterna och hubbens end-to-end-test är desamma.
- **Uppgraderingsspärren.** `upgrade-linux` (AppImage på Ubuntu 24.04 och Fedora) och `upgrade-windows` (Setup.exe på
  Windows Server 2025 och 2022) i release.yml uppdaterar varje produkt som får en ny version från en användares
  installation av dess **sista C#-release** (hämtad från release-repot, C#-appens egen Velopack tillämpar
  uppdateringen, sedan TS → TS) – så att en gammal installation alltid kan uppdatera sig direkt till den nyaste
  versionen – och, när det finns en, från dess **föregående (TypeScript-)release** (ett Linux- och ett Windows-mål,
  utan TS → TS; dess egen uppdateringskod tillämpar uppdateringen). Så länge den föregående releasen är den sista
  C#-releasen hoppas det fallet över (`plan.py` listar fallen). `publish` väntar på båda jobben. `upgrade-driver` är
  kvar (det är C#-appens uppdateringsknapp), med Velopack 1.2.161 – de sista C#-releasernas – fast i sitt eget
  projekt; .NET installeras bara i jobben som kör den eller `vpk`.
- **CI.** `ci.yml` kör bara TypeScript: typkontroll och Vitest, GP:s TaskTests per kursdel och apparnas e2e-tester
  (Playwright, Xvfb). `ts-packaging.yml` och `packaging/ts/products.py` är borttagna: release.yml körd för hand utan
  "publish" bygger, installationstestar och uppgraderingstestar på samma sätt (också från en gren).
- **Ändringsloggarna** har en post för 0.6.6, 0.2.6 och 0.2.5 på alla erbjudna språk: samma app med en ny motor,
  framstegen kvar, och det man kan märka (nedladdningen ungefär dubbelt så stor, systemets typsnitt i stället för det
  inbyggda Inter). Release-sidorna ber inte längre Fedora 45-användare installera OpenSSL 3 (det var för .NET).
- **C#-koden borttagen**: `src/Shared`, alla projekt, `.cs`/`.axaml`-filer och app-manifest i `src/Linux`, `src/GP`,
  `src/Hub`, `tests/`, `Codestead.sln`, `Directory.Build.props`, `global.json`, `build/Codestead.props` och
  `build/Codestead.App.props`. Datan som låg bredvid C#-koden ligger kvar på samma sökvägar (apparna läser den
  därifrån): UI-texterna (`src/Linux/Codestead.Content/i18n`, `src/GP/Codestead.GP.Course/i18n`,
  `src/Hub/Codestead.Hub/i18n`), skalets texter och världar (`src/Linux/Codestead.Shell/i18n`, `world`), GPU:ns
  API-symboler och glyfer (`src/GP/Codestead.GP.Gpu/symbols`, `Fonts`) och ikonerna i `Assets/`.
  `src/GP/tools/RenderResults` blev `ts/packages/gp-gpu/test/RenderResults.test.ts` (körs bara med
  `CODESTEAD_RENDER_RESULTS`); `src/GP/verify` använde inte C#-koden och är kvar.
- **Testerna.** Alla C#-tester hade redan TypeScript-motsvarigheter; de som jämförde med C#-källorna (temats färger,
  accentfärgerna, simulatorns meddelanden) kontrollerar nu TypeScript-sidan. `CodeLayoutTests` regler (en typ per fil,
  högst 800 rader) gällde C#-koden och följde inte med; dess kontroll att varje app anropar Velopack först finns i
  `SelfUpdateTests`.
