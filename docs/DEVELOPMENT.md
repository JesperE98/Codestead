# Utveckling (internt)

Den här filen är för dig som äger projektet. Den följer inte med i appen.

## Kom igång

Kräver [Node.js 22](https://nodejs.org) och npm. Apparna är TypeScript/React/Electron i npm-workspacet `ts/`
(`ts/apps/linux`, `ts/apps/gp`, `ts/apps/hub` och paketen i `ts/packages/`).

```bash
cd ts
npm ci
npm run typecheck
npm test
```

`npm test` kör alla Vitest-tester utom Codestead GP:s TaskTests (se "Codestead GP" nedan). Starta en app:

```bash
cd ts/apps/linux        # eller ts/apps/gp, ts/apps/hub
npm run build
npm start               # som root (container): npx electron . --no-sandbox
```

Under utveckling: `npm run dev` (Vites dev-server med omladdning; se appens `package.json`).

Inställningar och terminaler sparas i `%APPDATA%\Codestead\codestead-linux` (Windows) respektive
`~/.config/Codestead/codestead-linux` (Linux). Med miljövariabeln `CODESTEAD_DATA_DIR` kan du välja
en annan mapp, t.ex. för att börja om från noll.

`npm run smoke-test` (efter `build`) startar fönstret, går igenom alla kapitel på alla språk, löser en uppgift och
avslutar med `SMOKE OK`. Det är samma test som körs efter varje installation i release-flödet (`--smoke-test`).

`npm run test:e2e` i en app bygger den och kör det riktiga fönstret med Playwrights `_electron` (Playwright är inget
beroende i workspacet: `npm install -g playwright` och `NODE_PATH="$(npm root -g)"`; utan skärm startar testet en
egen Xvfb). CI kör dem i jobbet `e2e`.

## Ikoner

Varje produkt har en egen ikon i `build/icons/<id>.svg` (hubben: ett hus med en prompt, Codestead Linux:
en terminal). PNG- och ICO-filerna bredvid används av appen, paketen och installationsprogrammen, och
hubben visar verktygens ikoner från `src/Hub/Codestead.Hub/Assets/tools/<id>.png` (apparnas egna kopior ligger i
`src/<App>/Codestead.<App>/Assets/icon.png`). Ändrar du en SVG:

```bash
rsvg-convert -w 1024 -h 1024 build/icons/codestead-linux.svg -o build/icons/codestead-linux.png
```

och gör om ICO-filen (16–256 px) och kopiorna under `Assets/`.

## Namn och version

Produktnamn, id:n, körbara filer och versioner finns **bara** i `packaging/products.json`. Byt namn där. Varje
produkt har `id`, `name`, `title` (release-titeln), `summary`, `majorMinor`, `exe` (den körbara filen, t.ex.
`Codestead.Linux`: paketen, installationerna och hubbens katalog pekar på den), `app` (appen i `ts/apps/`), `dir`
(produktens mapp) och `lastCSharpRelease` (den sista versionen som var C#; uppgraderingstestet startar därifrån, och
från produktens föregående release).
Release-flödet (`plan.py`), byggskripten och apparna (`@codestead/common`: `Products`) läser filen.

Versionerna anges bara som `major.minor` (`"majorMinor": "0.6"` för Codestead Linux, `"0.2"` för GP och hubben).
Patchnumret sätts av release-flödet när du **släpper en version för hand** (se "Bygga installationsfilerna"):
varje produkt som ändrats sedan sin senaste release får nästa nummer (0.6.0, 0.6.1, 0.6.2 …). En merge till
`main` släpper ingenting, så flera PR:er samlas i samma release. Vilka filer som hör till en produkt står i samma fil:
`paths` (mönster som `build/icons/codestead-hub.*` går bra) minus `exclude`. En produkt får bara en ny
version när någon av dess filer har ändrats. Testerna (`test/`, `e2e/`) räknas inte. Hubben undantar de delar av de
delade paketen `ts/packages/ui` och `ts/packages/learning` som bara lärapparna använder (lärfönstret,
lektionskontrollerna, spelmotorn); `ts/apps/hub/test/ProductFilesTests.test.ts` följer hubbens importer och säger
till om hubben börjar använda något av dem. Skript som bara styr flödet (`plan.py`, installationstesterna …) hör inte
till någon produkt. För nästa större version ändrar du `0.6` till `0.7`. Lokala byggen får versionen `x.y.0`.

## Hubbens bakgrundsläge

Hubben kan ligga i systemfältet (`HubTray`): när ett verktyg öppnas (inställning, på som standard), när
stängknappen trycks (av som standard) och när den startar med datorn (`Autostart` i `ts/apps/hub/src/core`:
`HKCU\…\Run` på Windows, `~/.config/autostart/codestead-hub.desktop` på Linux, startar med `--background`).
Saknas systemfält (`TraySupport`: på Linux krävs en StatusNotifierItem-värd, t.ex. GNOME med AppIndicator)
minimeras hubben i stället, så den aldrig försvinner. Bara en hubb kör per användare (`SingleInstance`): en andra
start visar den första. Med "Installera verktygsuppdateringar automatiskt" installerar hubben nya versioner efter
varje koll i katalogen, aldrig medan verktyget körs. Snabbtestet (`--smoke-test`) hoppar över allt detta.

## Språk

Alla appar har samma språk, i `build/languages.json` (kod, namn, skrivriktning och `offered`). Listan läses
av apparna (`@codestead/common`: `Languages`), release-flödet (`packaging/plan.py`, `packaging/ts/package-app.mjs`:
Chromiums språkfiler) och testerna.

- **Erbjudna språk** (`"offered": true`) visas i menyerna, och deras texter, kapitel och ändringslogg krävs av
  testerna. I dag: engelska (standard), svenska, spanska, tyska, franska, kinesiska och japanska.
- **Parkerade språk** (`"offered": false`: portugisiska, ryska, arabiska, hindi) finns inte i menyerna och
  krävs inte, men filerna ligger kvar. En sparad parkerad språkkod blir engelska. För att ta tillbaka ett språk:
  låt någon med språket som modersmål granska texterna, fyll på det som saknas och sätt `"offered": true`.
- Stödet för höger-till-vänster (arabiska) finns kvar i koden och testas fortfarande.

## Ändringslogg ("Vad är nytt")

Vad som ändrats i varje version står i `src/Linux/changelog.json`, `src/GP/changelog.json` och
`src/Hub/changelog.json`, nyast först:

```json
[
  {
    "version": "0.5.5",
    "date": "2026-11-03",
    "changes": { "en": ["What changed, one short line each."], "sv": ["Vad som ändrats, en kort rad var."] }
  }
]
```

- **Det finns en post för nästa version** (senaste releasen + 1 i patchnumret) när produktens egna filer har
  ändrats. Har bara delad kod ändrats bestämmer posten om produkten släpps (se "Bygga installationsfilerna"). Den första PR:en efter en
  release skapar den; **varje följande PR fyller på samma post** med sina rader, tills versionen släpps. Uppdatera
  `date` till dagens datum när du lägger till rader. Posten ska finnas på alla språk med lika många rader på
  varje språk. `packaging/plan.py` stoppar både PR-bygget och releasen om posten saknas eller är ofullständig,
  och testet `WhatsNewTests` (`ts/packages/ui/test`) kontrollerar filerna.
- Skriv för användaren, inte för utvecklaren: vad man märker, inte vilka filer som ändrats.
- **Apparna** bygger in sin fil och visar nyheterna första gången den startar efter en uppdatering
  (och från inställningarna). Vilken version som visats sparas i `whatsnew.json` i appens datamapp.
- **Hubben** visar sina egna nyheter på samma sätt. När release-flödet skriver katalogen tar det med de tio
  senaste posterna för varje verktyg (`packaging/catalog.py --changelog-file`). Hubben visar dem när den
  uppdaterat ett verktyg och skriver då in versionen i verktygets `whatsnew.json`, så att verktyget inte
  visar samma nyheter igen. Varje verktyg har också knappen "Vad är nytt".

## Färgsystemet

Färgerna har fasta betydelser i alla appar (och i kommande verktyg). De finns som CSS-variabler i
`ts/packages/ui/src/Themes/codestead.css`, i både ljust och mörkt tema:

| Variabel | Betydelse | Används till |
| --- | --- | --- |
| `--cs-accent`, `--cs-accent-soft`, `--cs-on-accent` | appens egen färg | primärknappar, valt kapitel, fokus – aldrig "rätt/klart" |
| `--cs-success`, `--cs-success-soft` | klart, rätt, godkänt (grönt) | bockar, framstegsmätare, rätt svar, "kapitlet klart" |
| `--cs-warning`, `--cs-warning-soft` | ledtråd, varning (bärnsten) | ledtrådar, "texten finns inte på ditt språk", katalogproblem |
| `--cs-danger`, `--cs-danger-soft` | fel, underkänt, farligt (rött) | fel svar, underkänt prov, radera-knappar |
| `--cs-info`, `--cs-info-soft`, `--cs-link` | information, länkar (blått) | länkar, nedladdningsmätare |
| `--cs-reward`, `--cs-reward-soft`, `--cs-reward-strong` | belöningar (guld) | XP, nivåer, utmärkelser, dagar i rad |

- **Accentfärgen är appens varumärke**: `ts/packages/ui/src/Themes/Brand.ts` har en färg per app (Linux
  blågrön, hubben indigo, GP sin egen) och appen lägger in den med `Brand.<App>.applyTo()` när den startar
  (`ts/apps/<app>/src/main.tsx`/`App.tsx`). Ett nytt verktyg lägger till en egen `Brand`.
- `ThemeTests` kontrollerar att alla färger finns i båda teman och att text går att läsa (kontrast minst 4,5:1
  mot bakgrunderna och mot den egna "soft"-färgen, och för knapptext på accentfärgen). Byt en färg → kör testet.
- Emoji visas i färg genom att fönstrets typsnitt (`--cs-ui-font`) har emoji-typsnitt som reserv. Texten visas med
  Inter, som följer med apparna (`@fontsource-variable/inter`, importerat överst i `codestead.css`, OFL-1.1), så den ser
  likadan ut på alla datorer. Tecken Inter saknar (kinesiska, japanska) tas från systemets typsnitt.

## Spelifiering (XP, nivåer, utmärkelser)

Motorn är gemensam för alla verktyg och vet inget om Linux: `ts/packages/learning/src/Game/` (`GameRules`,
`GameState`, `XpRules`, `Levels`, `CommonAchievements`), testad mot en påhittad kurs i `ts/packages/learning/test`.
Ett verktyg beskriver sin kurs med en `CourseOutline` (delar, lektioner, vilka delar som har prov) och skapar
`new GameRules(outline, utmärkelser)`. Codestead Linux gör det i `ts/packages/linux-content/src/Game/LinuxGame.ts`,
med sina egna utmärkelser i `AchievementsLib.ts` och kommandoanalysen i `CommandInfo.ts` (en `CommandFacts` som också
räknar pipes, sudo, loopar …); Linux-kursens tester finns i `ts/packages/linux-content/test/GameTests.test.ts`.
Codestead GP har sina i `ts/packages/gp-course/src/Game/`. Vyerna (topprad, notiser, firande, galleri, profilrad)
finns i `ts/packages/ui/src/Controls/Game/` och tar färdigöversatta texter, så att samma vyer fungerar i alla
verktyg och i hubben; lärfönstret kopplar ihop dem (`ts/packages/ui/src/Learning/LearningWindow.Game.tsx`).
- **XP räknas fram** ur det som är gjort (`XpRules.Total`), så inget kan ges två gånger: uppgift 10, utan
  ledtråd/lösning +5, fråga i texten 2, kapitel 25, del 50, godkänt prov 100, 100 % +50. Kapitel, delar och
  prov som en gång räknats ligger kvar i `GameState` även om de senare "försvinner" (t.ex. vid byte av distro).
- **Nivåer** 1–10 med trösklar i `Levels.Thresholds`; titlarna är UI-texterna `level.1` … `level.10`. Testet
  ser till att hela kursen alltid räcker till högsta nivån.
- **Dagar i rad**: en lokal kalenderdag räknas när man löser en uppgift eller svarar rätt på en fråga. En
  missad dag startar om räkningen, men inget dras av.
- **Ny utmärkelse**: lägg till en rad i verktygets lista (Linux: `AchievementsLib.All`; allmänna finns färdiga i
  `CommonAchievements`) (id, emoji, kategori, villkor och gärna en
  räknare för "x / y"), texterna `ach.<id>.title` och `ach.<id>.desc` på alla erbjudna språk, och ett "vittne" i
  `GameTests.Witnesses` (testet kräver ett för varje utmärkelse). Kategori `Hidden` = dold: titeln visas som
  "???" tills den hittats och skrivs inte heller till profilfilen. Använd emoji från Unicode 11 eller äldre.
- **Kommandon** analyseras med skalets parser (`CommandInfo`): namn (även genom sudo, time, xargs …), pipes,
  omdirigeringar, loopar, skript och man-sidor.
- **Gamla sparningar**: `GameRules.Sync` körs vid start och ger tyst XP och utmärkelser för tidigare
  framsteg; användaren får en notis om det en gång.
- **Profil till hubben**: verktyget skriver `profile.json` (`ToolProfile`, `ts/packages/ui/src/Controls/Game/Profile/ToolProfile.ts`)
  i sin datamapp när något märkbart ändras och vid start. Filen innehåller alla texter på alla språk, så hubben
  kan visa nivå, dagar i rad och galleriet utan verktygets texter. Ett nytt verktyg skriver samma fil.

## Projektstruktur

Koden är npm-workspacet `ts/`: en app per mapp i `ts/apps/`, det som en app ensam använder i egna paket och det som
flera appar använder i `ts/packages/common`, `learning` och `ui`. Varje produkt har dessutom en mapp under `src/` med
det som inte är kod: kapiteltexterna, ändringsloggen, beskrivningen som hubben visar, texten på release-sidan och
UI-texterna. `packaging/products.json` pekar på båda (`"app"`, `"dir"`).

```text
packaging/products.json          Namn, id:n, körbara filer och version för alla produkter
build/                           Ikoner, languages.json, katalogens publika nyckel
ts/
├── packages/
│   ├── common/                  Språklistan (build/languages.json), översättning med platshållare, produkterna
│   ├── learning/                Lärmotorn utan UI: kursens disposition, XP, nivåer, dagar i rad, utmärkelser,
│   │                            LearningState (det som sparas i state.json)
│   ├── ui/                      React: tema och färgsystem, markdown-vy, dialoger, kontrollfrågor (med en ISandbox
│   │                            som verktyget ger), spelvyer, lagring, "Vad är nytt", självuppdatering (Velopack,
│   │                            src/electron/) och lärfönstret alla verktyg delar (src/Learning/: LearningWindow,
│   │                            LearningTool – det verktyget ger fönstret)
│   ├── linux-shell/             Den simulerade terminalen (bash, zsh, fish, apt, pacman, dnf, git ...)
│   │   └── src/                 Shell/ (kommandorader: pipes, omdirigering, sudo, skript, jobb), Parser/ (bash-parsern),
│   │                            Vfs/ (filsystemet med ägare och rwx), InitfsLib.ts (startfilerna per distribution),
│   │                            World.ts (elevens dator på elevens språk), Packages/ (paketdatabasen), ShellI18n.ts,
│   │                            Commands/<Grupp>/ (alla kommandon, en mapp per grupp)
│   ├── linux-content/           Linux-kursen: kapitel och uppgifter (Chapters/, ChapterDefinitions.ts, Checks.ts),
│   │                            Linux-spelet (Game/), språk, UI-texterna
│   ├── gp-gpu/                  Codestead GP:s simulerade GPU (se "Codestead GP")
│   ├── gp-course/               Codestead GP:s kurs
│   └── pipeline-viz/            Render Pipeline Visualizers scener i GP:s kapitel (se "Scener ur visualiseraren")
└── apps/
    ├── linux/                   Codestead Linux: Electron (electron/: main, preload, lagring) och appens React-del
    │                            (src/: LinuxTool – Linux-kursen och terminalen i lärfönstret –, terminalvyn)
    ├── gp/                      Codestead GP (src/: GpTool, YourProject/; electron/: kursens arbetstråd)
    └── hub/                     Hubben "Codestead" (src/core/: katalog, signatur, nedladdning, installation)
src/
├── Linux/
│   ├── content/
│   │   ├── chapters/<språk>/    Kapiteltexterna (markdown), ett språk per katalog
│   │   └── i18n/<språk>/        Översatta titlar och uppgiftstexter
│   ├── Codestead.Content/i18n/ui/   Appens UI-texter
│   ├── Codestead.Shell/         Simulatorns texter (i18n/) och elevens dator på varje språk (world/)
│   ├── Codestead.Linux/Assets/  Appens ikon
│   ├── changelog.json           "Vad är nytt" (nyast först)
│   ├── description.json         Beskrivningen i hubben, per språk
│   └── release-notes.md         Texten på release-sidan
├── GP/                          Codestead GP (se nedan), samma filer
└── Hub/                         Hubben: Codestead.Hub/i18n/ (texterna), Codestead.Hub/Assets/ (ikonerna),
                                 changelog.json, description.json, release-notes.md
packaging/                       Byggskript, installations- och uppgraderingstester, products.json (vilka produkter
                                 som byggs), plan.py (release-planen), catalog.py (hubbens katalog), hub-e2e.sh
                                 (hubben installerar Codestead Linux), ts/package-app.mjs (appens mapp)
```

Mappnamnen under `src/` (`Codestead.Shell`, `Codestead.Content` …) kommer från C#-projekten som datan en gång låg
bredvid; apparna läser filerna på de sökvägarna. Varje paket har sina tester i `test/` bredvid `src/`.

En ny app (t.ex. C++) får en egen app `ts/apps/cpp/`, gärna ett paket för kursen, en mapp `src/Cpp/` och en post i
`packaging/products.json` – se "Så gör du ett nytt verktyg" nedan.

## Så gör du ett nytt verktyg

Allt som inte handlar om Linux finns i de delade paketen och används av Codestead Linux och Codestead GP i dag. Ett
nytt verktyg, t.ex. **Codestead C++**, behöver bara det som är unikt för ämnet:

1. **Mappar och produkt**: `ts/apps/cpp/` (appen, som `ts/apps/gp`: `electron/main.ts` med `runVelopackHooks()`
   först, preload, `src/`), gärna `ts/packages/cpp-course/` (kursen), `src/Cpp/changelog.json`, `description.json`,
   `release-notes.md`, ikoner i `build/icons/codestead-cpp.*` och en post i `packaging/products.json` med id, namn,
   körbar fil, `majorMinor`, `"app": "ts/apps/cpp"` och `"dir": "src/Cpp"` (utan `lastCSharpRelease`: den har ingen
   C#-version; uppgraderingstestet startar då från dess föregående release, när den har en).
2. **Appen**: `ProductInfo` med `Products.meta("cpp", …)`; `App.tsx` lägger in en egen `Brand` (accentfärg) och
   öppnar lärfönstret med verktyget (`LearningWindow` från `@codestead/ui`).
3. **Verktyget implementerar `LearningTool`** (`ts/packages/ui/src/Learning/LearningTool.ts`; jämför
   `ts/apps/linux/src/LinuxTool.tsx` och `ts/apps/gp/src/GpTool.tsx`):
   - kursen: kapitel (`CourseChapter`), titlar, texter per språk, källor, uppgifter (text, ledtråd, lösning) och
     deras nycklar;
   - spelet: `new GameRules(outline, utmärkelser)` med `CommonAchievements` plus egna, och en `CommandFacts` om
     verktyget vill räkna egna saker (t.ex. kompileringar);
   - varianter om ämnet har sådana (t.ex. kompilatorer: gcc/clang) – annars en enda;
   - arbetsytan: kontrollen under uppgifterna (t.ex. en kodruta och en körknapp), som säger till efter varje körning
     och avgör vilka uppgifter som löstes;
   - en `ISandbox` för kontrollfrågornas "prova själv".
4. **Texter**: verktygets UI-texter med samma nycklar som Codestead Linux använder för fönstret (se
   `src/Linux/Codestead.Content/i18n/ui/en.json`) och de egna, på alla erbjudna språk.
5. **Tester**: kursens uppgifter ska gå att lösa med sina lösningar (som `ChaptersTests` för Linux), en
   `--smoke-test` för installationstesterna, och `ProductFilesTests`/`SelfUpdateTests` gäller även den nya appen.

Hubben behöver ingen ändring: den läser verktygets `profile.json` och katalogen.

## Codestead GP (grafikprogrammering)

Codestead GP (`ts/apps/gp`, `ts/packages/gp-course`, `ts/packages/gp-gpu` och `src/GP/`) är byggt som ett nytt
verktyg enligt avsnittet ovan. Eleven
väljer **grafik-API** högst upp – OpenGL 3.3, Vulkan eller DirectX 12 – och det är verktygets *variant*: varje kapitel,
uppgift och projekt följer valet. Kursen följer learnopengl.com kapitel för kapitel; OpenGL-koden härmar
learnopengl.com, Vulkan-koden vulkan-tutorial.com och DirectX 12-koden Microsofts D3D12HelloWorld-exempel.

```text
ts/apps/gp/                Appen: GpTool (kursen i lärfönstret), YourProject/ (panelen "Your project", huvudfilen per
                           kapitel och API i mainfiles.json, bilden av förväntat resultat), electron/ (kursens arbete
                           – kontrollen, bilderna, filerna – i en arbetstråd i main-processen)
ts/packages/gp-course/     Kursen: GpCourse (delar och kapitel i ordning, startprojekt, uppgifter), Edits
                           (edits.txt), CourseText (texter per språk och API), Checks/ (uppgifternas kontroller),
                           Ide/ (elevens kod: ProjectReader, ProjectChecker, StartFiles, ExpectedResult), Game/
                           (utmärkelser)
ts/packages/gp-gpu/        Den simulerade GPU:n (utan UI):
├── Build/                 Kompileringssteget: klamrar, okända API-namn med "did you mean" (src/GP/Codestead.GP.Gpu/
│                          symbols/*.txt från de riktiga headerfilerna), shaders som inte går att tolka
├── Shading/               En tolk för den del av GLSL och HLSL som kursen använder (lexer, parser, körning)
├── Readers/               Läser vad programmet gör: GlReader följer main() anrop för anrop som en drivrutin,
│                          VulkanReader och D3D12Reader läser programmen så som tutorials skriver dem
├── Scene/                 Resultatet: fönster, renderingsloop, rensningsfärg, ritanrop, meddelanden (SimNote)
└── Raster/                Mjukvaru-rasterisering med perspektivkorrekt interpolering, culling och djuptest
src/GP/
├── content/
│   ├── chapters/<språk>/  Kapiteltexterna (markdown); engelska är källan, svenska krävs, andra språk faller
│   │                      tillbaka på engelska
│   ├── i18n/<språk>/      Titel och uppgiftstexter per kapitel (en sträng, eller en per API)
│   ├── references/        Källor per kapitel (fältet "api" för en källa som bara gäller ett API)
│   └── projects/<api>/<kapitel>/  start/ (projektet eleven börjar med), solution/, edits.txt, tasks.md
├── Codestead.GP.Course/i18n/ui/   UI-texterna
├── Codestead.GP.Gpu/      symbols/ (API-namnen) och Fonts/ (glyferna simulatorn ritar text med)
└── verify/                verify.sh och apply_edits.py (se nedan)
```

**Ett kapitel** består av texten (alla API:er i samma fil), uppgiftstexterna och ett projekt per API:

- I texten skrivs det som bara gäller ett API i block: `:::opengl` … `:::`, `:::vulkan` …, `:::d3d12` … eller flera
  på en gång (`:::vulkan d3d12`). Platshållare: `{{api}}`, `{{apiFull}}`, `{{shaderLanguage}}`. Använd bara
  ` ```quiz `-frågor. **Varje API ska få lika många frågor i samma ordning** (fönstret räknar frågorna i texten för
  det valda API:t); en API-specifik fråga skrivs därför som en fråga i vart och ett av de tre blocken.
  `ContentTests` kontrollerar det, och att svenskan har samma frågor.
- `edits.txt` är uppgifterna för ett API, i ordning: varje uppgift är en eller flera kodändringar (`find` → `replace`)
  från `start/`. När eleven klickar på lösningen kopieras koden till urklipp, för att klistras in i IDE:n. Alla ändringar efter varandra ska ge
  exakt `solution/` (`apply_edits.py` och `TaskTests` kontrollerar det).
- Kontrollerna finns i `ts/packages/gp-course/src/Checks/TaskChecks.<Kapitel>.ts`, per uppgifts-id. Kontrollera helst
  **resultatet** (pixlar i den simulerade bilden, rensningsfärgen) så att samma kontroll gäller alla API:er; annars
  koden (`c.has(...)`, mellanslag i mönstret matchar valfritt blanksteg). Betyder samma id olika saker i olika
  API:er, använd `perApi({ opengl: …, vulkan: …, d3d12: … })`. `TaskTests` kräver att varje uppgift löses av sin lösning och
  **inte** redan är löst före.
- Lägg till kapitlet i `lessonList` i `ts/packages/gp-course/src/GpCourse.ts` (ordningen där är kursens ordning) och
  dess kontroller i `Checks/`.
- `TaskTests` tar ungefär en timme på en kärna, så `npm test` hoppar över dem; CI kör dem i parallella jobb per
  kursdel (`gp-tasks` i `.github/workflows/ci.yml` och `release.yml`, med `CODESTEAD_GP_PARTS`). **En ny kursdel ska
  in i matrisen i båda arbetsflödena** (`CiTests` kontrollerar det). Lokalt, i `ts/`:
  `CODESTEAD_GP_PARTS=pbr npx vitest run packages/gp-course/test/TaskTests.test.ts`.

**Koden ska vara korrekt.** `src/GP/verify/verify.sh <mappar>` kompilerar projekten med de riktiga verktygen:
OpenGL och Vulkan med g++ (GLAD genereras med `pip install glad`), DirectX 12 med MinGW-w64 mot Microsofts
DirectX-Headers och DirectXMath, shaders med glslangValidator. OpenGL- och Vulkan-programmen **körs** dessutom under
Xvfb med Mesa (llvmpipe/lavapipe) och Khronos valideringslager – ett enda valideringsfel underkänner – och en
skärmbild sparas. Skriptets kommentar listar paketen som behövs (Ubuntu 24.04). Kör det på `start/` och `solution/`
för varje kapitel du ändrar, och `apply_edits.py` på kapitlet.

**Eleven skriver, bygger och kör koden i sin egen IDE** (Visual Studio, CLion, Rider, VS Code), med vilken
mappstruktur hen vill; appen har ingen editor, ingen Bygg & kör-knapp, ingen förhandsvisning och bevakar ingen mapp.
Panelen **Your project** (`ts/apps/gp/src/YourProject/ProjectPanel.tsx`) har knapparna *Check my code*, *Change file…* och *Save start
files…*, varje uppgifts läge under uppgiften (låst, inte klar, kontrolleras, inte än – med kontrollens meddelanden –,
klar) med knappen **Mark as done**, och bilden av **förväntat resultat**: kursens lösning fram till uppgiften
(`ExpectedResult`), ritad av simulatorn i bakgrunden.

- **Mark as done**: eleven bockar själv i uppgiften. Den lämnas till fönstret som en avslutad "körning" (raden
  `mark-done`) som bara löser den uppgiften; den räknas inte i statistiken (`Analyze` ger inga fakta för den).
- **Check my code**: första gången väljer eleven kapitlets huvudfil (vilket namn som helst, var som helst; sparas per
  kapitel och API i `mainfiles.json` i appens datamapp, och en mapp från den tidigare appens `folders.json` används
  tills dess). `ProjectReader.ReadFrom` läser huvudfilen och kapitlets övriga filer (efter sökväg eller namn) i
  huvudfilens mapp och mappar under den, annars i mappen ovanför (`src/main.cpp` med `shaders/` bredvid `src/`);
  bygg- och IDE-mappar (`build*`, `cmake-build-*`, `out`, `.vs`, `.idea`, `.vscode`, `x64`, `Debug`, `Release`, `bin`,
  `obj`, `.git`) och bibliotek som GLAD, GLM och stb läses inte. Finns den valda huvudfilen inte längre räknas den som
  saknad – en annan `main.cpp` i närheten används inte. `ProjectChecker` kör kapitlets kontroller i ordning på
  simulatorns bygge, i bakgrunden. Resultatet lämnas till fönstret som ett avslutat "bygge": uppgifter, XP och
  utmärkelser räknas som förut, och låsta uppgifter bockas av när de låses upp.
- **Save start files…** kopierar kapitlets startfiler till en mapp eleven väljer (frågar innan filer med annat innehåll
  skrivs över) och gör dess huvudfil till den som kontrolleras.
- Snabbtestet sparar första lektionens startfiler och lösning i en tillfällig mapp med en egen struktur (huvudfilen
  flyttad till `src/<kapitel>.cpp`), väljer huvudfilen, kör *Check my code* och kräver att uppgiften bockas av.

**Övningar.** Efter kapitlets steg (learnopengls genomgång, `edits.txt`) kan ett kapitel ha övningar:
`projects/<api>/<kapitel>/exercises.txt` i samma format, med id som börjar på `ex-`. Varje övning är en egen ändring av
kapitlets färdiga program (`GpCourse.SolutionProject`), inte av en annan övning. Texterna ligger bland uppgifterna i
`i18n/<språk>/<kapitel>.json`, kontrollerna i `Checks/TaskChecks.Exercises*.ts` (en övning utan kontroll bockar eleven
i själv). Panelen visar stegen under "Follow along" och övningarna under "Exercises" (`TaskInfo.Section`).
`TaskTests` kräver att varje övning byggs rent och att en övning med kontroll inte
godkänns av kapitlets program men av sin lösning; `CODESTEAD_GP_CHAPTERS=a,b` kör testerna för några kapitel.

**Bilder i kapitlen.** Ett stycke som bara är en bild, `![alt](images/namn.webp "bildtext")`, visas av textvyn
(`AnimatedImage` i `ts/packages/ui`: PNG, JPEG, WebP och animerad GIF/WebP; bildrutor på en sekund eller mer är ett bildspel som tonar
över; ett klick pausar). Bilderna ligger i `src/GP/content/images/` – `sv/`/`en/` för bilder med text i, annars
gemensamma – och bäddas in; `PictureTests` kräver att varje bild finns och används. `ts/packages/gp-gpu/test/RenderResults.test.ts`
(körs bara med `CODESTEAD_RENDER_RESULTS=<mapp>`) + `images/make_results.py` renderar varje kapitels resultat med
simulatorn till `images/results/<kapitel>.webp`.

**Scener ur visualiseraren.** [Render Pipeline Visualizer](https://github.com/jesper-e98/RenderpipelineVisualizer)s
slides visas levande i kapitlen: eleven stegar fram och tillbaka genom en slides steg (knappar, prickar, ← → Home End när
scenen har fokus), spelar ett steg igen, byter modell (triangel, kub, tekanna …) och läge (verklig data/koncept) och kan
visa API:ts kod för steget – i det API eleven valt, på svenska eller engelska (andra språk får engelska; knapparnas texter
är `viz.*` i UI-texterna) och i fönstrets ljusa eller mörka tema, och de följer med när något av dem ändras.

- **I texten** är en scen en bild vars källa är `viz:<scen>`, ensam i sitt stycke, med alt-text och bildtext som en bild:
  `![Vertexattribut](viz:input-layout "Vertexattribut: en stride stegar …")`. Scenens namn finns i
  `ts/packages/pipeline-viz/src/Scenes.ts`: vilken slide, vilka av dess steg (`first`–`last`) och vilken modell och vilket
  läge som passar kapitlet; `viz:buffers?model=teapot&mode=concept` väljer något annat i ett enskilt kapitel. En ny scen
  får en rad i `Scenes.ts` och en stillbild (nedan). `PictureTests` kräver att varje `viz:`-scen finns och har sin bild.
- **Stillbilden** `images/[sv|en/]viz-<scen>.webp` visas där scenen inte kan köra: utan WebGL 2 (t.ex. en dator utan
  grafikdrivrutin – Chromium ritar inte WebGL i mjukvara som standard), när scenen inte startar eller när WebGL-kontexten
  försvinner. Den räknas som använd av scenen. `images/visualizer/` fångar bilderna ur visualiseraren (`capture.js` med
  Playwright, `steps.txt`, `make_pictures.py`: bild → slidens steg); ta om dem när slidesen ändras.
- **Prestanda**: paketet `ts/packages/pipeline-viz` och three.js laddas först när en scen närmar sig skärmen (en egen chunk,
  `mount-*.js`, ungefär 1,3 MB, och visualiserarens worker). En scen kör bara nära skärmen, pausar (ritning och
  animationer) utom synhåll och stängs några sekunder efter att den lämnat närheten; högst två scener kör samtidigt
  (`SceneBudget`: varje scen har en egen WebGL-kontext, som ges tillbaka direkt när den stängs). Med
  `prefers-reduced-motion` spelas inga övergångar upp; stegen fungerar som vanligt.
- **Hur det är byggt** (`ts/packages/pipeline-viz/README.md`): `visualizer/` är visualiserarens kod (slides, mjukvarupipeline,
  vyer, modeller, worker, stilar – inte WebXR-labbet), typkontrollerad med visualiserarens egna inställningar (`npm run
  typecheck` kör båda); `engine/` kör en slide i en ruta (shadow root, egen renderare, ljust tema för stilarna och
  3D-materialen, `tween.ts` i stället för GSAP, vars licens inte är öppen); `src/` är React-delen (`PipelineScene`).
  GP lägger in scenerna med `pictureView` (`ts/apps/gp/src/VizScene.tsx`), som textvyns `pictureRenderer` anropar.
- **Uppdatera från visualiseraren**: `node scripts/sync-visualizer.mjs <visualiserarens klon>` i `ts/packages/pipeline-viz`
  kopierar koden på nytt (och ändrar bara importerna av GSAP och stilarna samt testernas sökvägar); skriv in commiten i
  paketets README, kör `npm run typecheck` och testerna och titta på scenerna i appen. Visualiserarens egna tester av den
  kopierade koden (`visualizer/tests/`) körs med `npm test`.
- **Testerna**: `ts/packages/pipeline-viz/test/` (stegen, `viz:`-källorna, budgeten, stilarnas ljusa version,
  tween-motorn, komponenten med en låtsasmotor i jsdom), `GpToolTests` (scenerna står där bilderna stod, stillbilderna
  utan WebGL) och e2e-testet (`ts/apps/gp/e2e`): med SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`)
  körs Hello Triangles scener, stegas och är aldrig fler än två; med `--disable-gpu --disable-software-rasterizer` visas
  stillbilderna.

**Simulatorn är inte en riktig GPU.** Den förstår kursens kod och de vanliga misstagen (glömd `glClear`, avstängt
vertexattribut, ingen pipeline bunden, saknade barriärer …) och säger till med meddelanden som `sim.<nyckel>` i
UI-texterna. Den är numera osynlig för eleven: den kontrollerar elevens kod och ritar förväntat resultat. Kod utanför
det den förstår kan ge en annan bild än en riktig körning. Nya kapitel
(texturer, transformationer, 3D) kräver att läsarna och tolken lär sig mer, t.ex. texturer och glm/DirectXMath-matriser.

## Skriva ett nytt kapitel (Codestead Linux)

1. Skriv `src/Linux/content/chapters/en/mitt-kapitel.md` (engelska är källspråket) och
   `src/Linux/content/i18n/en/mitt-kapitel.json`, och motsvarande filer för de andra tio språken.
   - Kodblock märkta ` ```sh ` blir klickbara – ett klick lägger in kommandot i terminalen.
   - Text som bara gäller en familj läggs i `:::debian` / `:::arch` / `:::redhat` … `:::`.
   - Platshållare: `{{distro}}`, `{{hostname}}`, `{{family}}`, `{{pm}}`, `{{adminGroup}}`, och elevens
     dator på elevens språk (se nedan), t.ex. `~/{{documents}}/{{fruits}}` eller `/home/{{user}}`.
   - **Kontrollfrågor** i texten låser upp uppgifterna. Terminalen syns alltid bredvid lektionen, men
     uppgifterna kontrolleras inte förrän alla kontrollfrågor är besvarade. Tre sorter:

     ````markdown
     ```quiz
     Which command shows the directory you are in?
     - [ ] ls
     - [x] pwd
     ---
     Explanation shown after the right answer (optional).
     ```

     ```predict
     $ echo $((2 + 3))
     5
     ```

     ```try
     pwd
     ```
     ````

     `quiz` med flera `[x]` kräver alla rätta svar. `predict` visar kommandot efter `$ ` och väntar sig
     resten som svar (testerna kör kommandot i simulatorn och kontrollerar svaret). Det finns inga
     miniterminaler: en `try`-fråga löses när eleven kör kommandot i den stora terminalen (ett klick på
     kommandot lägger in det där). Första raden är det kommando som visas, och alla rader godtas – liksom
     ett kommando med samma utskrift som första raden ger på en ny dator (`ISandbox.outputOf`). Prov
     visar också terminalen, eftersom de har `try`-frågor.
     Ett kapitel utan kontrollfrågor låses upp med knappen "Jag har läst kapitlet".
   - **Källor**: `src/Linux/content/references/mitt-kapitel.json` med
     `[{ "title": ..., "url": "https://...", "publisher": ... }]`. Bara officiella webbplatser
     (listan finns i [verification/README.md](verification/README.md)); testerna säger nej till andra.
   - **Sammanfattning och prov** för ett huvudkapitel: `<huvudkapitel>-summary.md` och
     `<huvudkapitel>-exam.md` (t.ex. `grunder-exam.md`). De läggs till sist i huvudkapitlet av sig själva.
     Provet består av kontrollfrågor (minst 10), öppnas när alla sub-kapitel är klara och kräver 80 %.
2. Lägg till kapitlet med uppgifter i en egen fil, `ts/packages/linux-content/src/Chapters/<huvudkapitel>/<id>.ts`,
   och lägg till det i listan i `ChapterDefinitions.ts` (ordningen där är kursens ordning). Varje uppgift har
   en kontroll som körs efter varje kommando och en lösning (lista med kommandon).
3. Kör `npm test` i `ts/`. Testerna kör alla lösningar i alla distributioner och kontrollerar att
   varje kapitel finns på alla språk, och att kontrollfrågorna är likadana på alla språk.

Behövs ett nytt kommando lägger du det i `ts/packages/linux-shell/src/Commands/`. Ska det installeras med
pakethanteraren lägger du också till ett paket i `ts/packages/linux-shell/src/Packages/PackagesLib.Catalog.ts`.

## Elevens dator på elevens språk

Den simulerade datorns användare, övningsfiler och mappar (och vad som står i filerna) finns på varje
språk i `src/Linux/Codestead.Shell/world/<språk>.json`:

```json
{
  "locale": "en_US.UTF-8",
  "names": { "user": "student", "documents": "documents", "fruits": "fruits.txt" },
  "words": { "helloWorld": "Hello world", "siteTitle": "My website" },
  "files": { "fruits": "apple\nbanana\n…" }
}
```

- `names` är det eleven skriver (användare, filer, mappar, grupper, variabler). De är ASCII; språk med
  annan skrift (ru, zh, ja, ar, hi) använder de engelska namnen.
- `words` är korta texter på språket, `files` innehållet i övningsfilerna.
- `en.json` är källan: alla språk har samma nycklar (`ts/packages/linux-shell/test/WorldTests.test.ts` kontrollerar det).
- Kapiteltexter, uppgiftstexter, lösningar och kontroller skriver namnen som platshållare: `{{documents}}`,
  `{{user}}`. I kapitlens kontroller fyller hjälpfunktionerna i `ts/packages/linux-content/src/Checks.ts` (`node`,
  `re(c, …)`, `w(c)` …) i dem.
- Det program skriver (loggar, konfigurationsfiler, systemfiler) är engelska på alla språk, som på en
  riktig dator. `$LANG` följer språket, och `sort` sorterar därefter.
- När eleven byter språk översätts terminalen på plats (`WorldMigration`): övningsfilerna och
  användaren byter namn, och orörda filer får det nya språkets text. Elevens egna filer och git-repon
  lämnas som de är.
- Testerna löser alla uppgifter med varje språks dator och kör kontrollfrågorna (`predict`, `try`) i
  simulatorn på varje språk.

Med miljövariabeln `CODESTEAD_WORLD_DIR` läses world-filer från en katalog i stället för de inbyggda,
så att en översättning kan provas utan att bygga om.

## Simulatorns egna texter

Tips, anmärkningar och välkomsttexten som simulatorn skriver i terminalen finns i
`src/Linux/Codestead.Shell/i18n/<språk>.json` (`messages`) och anropas med en nyckel i
`ts/packages/linux-shell` (`ShellI18n`). Engelska (`en.json`) är källan; lägg till nyckeln i filerna för alla
erbjudna språk med samma `{platshållare}`. Utskrifter som härmar riktiga program (`ls: cannot access ...`) och
manualsidor översätts inte.

Sammanfattningarna som `help` visar (`summaries`) skrivs i koden (kommandots `summary` på svenska och `summaryEn` på
engelska) och förs över till `sv.json` och `en.json` med
`CODESTEAD_UPDATE_SHELL_I18N=1 npx vitest run packages/linux-shell` (i `ts/`). Översätt sedan ändringen i de andra
språken. `ShellI18nTests` kontrollerar nycklar, platshållare och att inget har glömts.

## Simulatorns filsystem, cron och servern

- **Länkar** (`ts/packages/linux-shell/src/Vfs/`): en symbolisk länk är en nod av typen `"link"` med sökvägen
  som innehåll. `vfs.lookup` följer länkar (högst 40, sedan `ELOOP`); varianten utan att följa och
  `tryLookupLink` ger själva länken, som `lstat`. Kommandon som arbetar med namnet (rm, mv, rmdir,
  ls -l, find, tar) använder den varianten. En hård länk är samma nod i flera kataloger, med
  länkantal och ett gemensamt inodnummer; när en sparad terminal läses in fogas de ihop
  igen. `VfsLib.cloneNode` (cp) ger alltid nya filer utan inodnummer.
- **umask** finns på filsystemet och sparas med terminalen. Att skriva filer och skapa mappar använder den.
- **cron** (`Commands/Cron/`): användarnas crontab ligger i `/var/spool/cron/crontabs`
  (Debian/Ubuntu) eller `/var/spool/cron`. Cron-kommandots tick körs före varje kommandorad och kör de
  jobb vars minut har passerat sedan förra gången (högst en timme bakåt), men bara medan tjänsten
  cron/crond/cronie är igång. Tiden räknas inte medan appen är stängd, precis som en avstängd dator.
  Systemets egna jobb (`run-parts`) loggas men körs inte.
- **Servern** `192.168.1.10` (`serverFor` i `Commands/Ssh/`) är en egen Debian-terminal i minnet. ssh, scp och
  rsync kör mot den, och `~/.ssh/config` (`Host`, `HostName`, `User`, `Port`) läses på samma sätt
  som av OpenSSH. Serverns filer sparas inte när appen stängs.

## Bygga installationsfilerna

Allt byggs av GitHub Actions (`.github/workflows/release.yml`), för varje produkt i
`packaging/products.json` (Codestead Linux, Codestead GP och hubben), från dess TypeScript-app
(`packaging/build-linux.sh` och `build-windows.ps1`: `packaging/ts/package-app.mjs` bygger appen och gör Electrons
app-mapp, sedan tar nfpm och `vpk` fram paketen):

1. Slå ihop PR:erna till `main`. Det släpper ingenting: pull requests och merges till `main` planerar (och
   kontrollerar ändringsloggen), testar och bygger.
2. **Släpp en version:** Actions → **Release** → **Run workflow**, välj `main` och kryssa i **publish**.
   Flödet (`packaging/plan.py`) räknar ut nästa patchversion för varje produkt som ändrats sedan dess
   senaste release. Två körningar för hand väntar på varandra, så samma version kan inte tas två gånger.
   - **Produktens egna filer** (`own` i `products.json`: dess mapp, dess app och paket i `ts/`, ikonen, för hubben
     även katalognyckeln)
     ändrade: en ny version, och ändringsloggen måste ha en post för den.
   - **Bara delade filer** ändrade (resten av `paths`: `ts/packages/common`, `learning`, `ui`, workspacets
     paketfiler, bygg- och paketeringsfilerna): en ny version **bara om ändringsloggen redan har en post för den**. Utan post väntar ändringen till produktens
     nästa release. Så slipper Codestead Linux en release med "inget ändras" när den delade koden ändras för
     GP:s skull – och en delad buggfix som Linux märker får en rad i `src/Linux/changelog.json` och släpps.

Flödet bygger alla produkter och installerar och startar dem på rena system (Windows Server 2022/2025,
Ubuntu 22.04/24.04, Fedora, Arch Linux, CachyOS). Hubben får dessutom installera och starta Codestead
Linux från en signerad katalog. **Uppgraderingsspärren** (`upgrade-linux`, `upgrade-windows`): varje produkt som får
en ny version uppdateras till bygget från en användares installation av dess sista C#-release (`lastCSharpRelease`,
hämtad från release-repot; C#-appens egen Velopack tillämpar uppdateringen, sedan uppdaterar bygget sig en gång
till, TS → TS) och, när det finns en, av dess föregående release – AppImage på Ubuntu och Fedora, Setup.exe på
Windows Server, med kontroll av att användarens data och framsteg finns kvar (`packaging/upgrade-test.sh`,
`upgrade-test-windows.ps1`; C#-appens uppdateringsknapp är `packaging/upgrade-driver`, det enda .NET-projektet).
Därefter publiceras de ändrade produkterna i det offentliga repot
`JesperE98/codestead-releases` – men bara när båda secrets nedan finns (annars en varning, inget fel):

| Release | Innehåll |
|---|---|
| `<id>-v<version>` (t.ex. `codestead-linux-v0.5.0`) | Alla filer för versionen och `SHA256SUMS.txt` |
| `<id>-latest` | Samma filer utan version i namnet (länkarna i README) och Velopacks uppdateringsflöde |
| `catalog` | `catalog.json` och `catalog.json.sig`: listan som hubben läser |

Release-titlarna kommer från `title` i `packaging/products.json` ("Codestead Linux 0.5.1",
"Codestead hub 0.1.1"), eftersom alla produkter delar repot. Efter varje publicering skriver flödet om
README:n i `codestead-releases` med `packaging/releases_readme.py` (på engelska: innehållsförteckning,
kom igång med hubben, en del per produkt med senaste version och nedladdningar, kontroll av filer, SmartScreen och
vad de olika releaserna är). Ändra den i skriptet, inte i repot; plan-jobbet provar skriptet på varje PR, och
skriptet stoppar om en länk i innehållsförteckningen saknar sin rubrik.

Utan **publish** (eller på en annan gren än `main`) bygger och installationstestar flödet utan att
publicera – så provar du en PR på riktiga system. Installations- och uppgraderingstesterna körs bara i körningar för
hand. Byggena laddas upp som artefakter (några GB per körning, sparas en dag) och skulle annars fylla repots
lagringsutrymme för artefakter.

GitHub har inga rena Windows 10/11-skrivbordsmaskiner, bara Windows Server. Gå därför igenom
[RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) på en riktig Windows 10/11-dator före en större release.

### Secrets i det här repot

- `RELEASES_TOKEN`: en fine-grained token med *Contents: read and write* på `codestead-releases`.
- `CATALOG_SIGNING_KEY`: den privata nyckeln som hubbens katalog signeras med.

### Signeringsnyckel för katalogen

Hubben litar bara på en katalog som är signerad med rätt nyckel (ECDSA P-256). Skapa nyckelparet en
gång, på din egen dator (Git Bash på Windows har `openssl`):

```bash
openssl ecparam -name prime256v1 -genkey -noout -out catalog-signing.pem
```

```bash
openssl ec -in catalog-signing.pem -pubout -out build/catalog-signing.pub.pem
```

1. Committa `build/catalog-signing.pub.pem` (den publika nyckeln byggs in i hubben).
2. Lägg hela innehållet i `catalog-signing.pem` som secret `CATALOG_SIGNING_KEY`
   (Settings → Secrets and variables → Actions).
3. Spara `catalog-signing.pem` säkert utanför repot, t.ex. i en lösenordshanterare. Committa den aldrig.

Release-flödet kontrollerar att nyckeln och den publika nyckeln hör ihop innan något publiceras.

#### Lokalt

Linux (kräver Node 22 och `npm ci` i `ts/`, [nfpm](https://nfpm.goreleaser.com), `mksquashfs` och
`dotnet tool install -g vpk --version 1.2.161`, som behöver .NET):

```bash
packaging/build-linux.sh ts/apps/linux codestead-linux "Codestead Linux" Codestead.Linux 0.6.0
```

Installationstestet i en ren container och uppgraderingstestet (från den sista C#-releasen; behöver docker, .NET för
`packaging/upgrade-driver` och `vpk`):

```bash
docker run --rm -v "$PWD/artifacts:/artifacts" -v "$PWD/packaging:/packaging:ro" ubuntu:24.04 \
  bash /packaging/install-test.sh codestead-linux Codestead.Linux deb
UPGRADE_FROM=0.6.5 packaging/upgrade-test.sh codestead-linux Codestead.Linux "Codestead Linux" src/Linux artifacts ubuntu:24.04
```

(Bygget måste då ha en högre version än 0.6.5, t.ex. 0.6.6.)

## Historik

Fram till version 0.3.0 var appen skriven i TypeScript/React/Electron. Den portades rad för rad
till C#; TypeScript-koden och reglerna för porteringen (`docs/PORTING.md`) finns kvar i git-historiken
(commit `a0bbdda`). I november 2026 flyttades allt tillbaka till TypeScript, med C#-koden och dess tester som grund
([TYPESCRIPT-MIGRATION.md](TYPESCRIPT-MIGRATION.md)): de sista C#-versionerna är Codestead Linux 0.6.5, Codestead GP
0.2.5 och hubben 0.2.4, och C#-koden finns kvar i git-historiken (t.ex. commit `a616425`). Kommentarer som
"Port of Codestead.Shell/…" eller "Port of tests/…" i koden pekar dit.
