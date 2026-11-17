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
- [ ] 2. Gemensam kärna och UI
- [ ] 3. Linux
- [ ] 4. GP
- [ ] 5. Hubben och paketering
- [ ] 6. Byte
