# Utveckling (internt)

Den här filen är för dig som äger projektet. Den följer inte med i appen.

## Kom igång

Kräver [.NET 10 SDK](https://dotnet.microsoft.com/download). Inget annat.

```bash
dotnet build
```

```bash
dotnet test
```

```bash
dotnet run --project src/Linux/Codestead.Linux
```

Inställningar och terminaler sparas i `%APPDATA%\Codestead\codestead-linux` (Windows) respektive
`~/.config/Codestead/codestead-linux` (Linux). Med miljövariabeln `CODESTEAD_DATA_DIR` kan du välja
en annan mapp, t.ex. för att börja om från noll.

`dotnet run --project src/Linux/Codestead.Linux -- --smoke-test` startar fönstret, går igenom alla kapitel
på alla språk, löser en uppgift och avslutar med `SMOKE OK`. Det är samma test som körs efter varje
installation i release-flödet.

## Ikoner

Varje produkt har en egen ikon i `build/icons/<id>.svg` (hubben: ett hus med en prompt, Codestead Linux:
en terminal). PNG- och ICO-filerna bredvid används av appen, paketen och installationsprogrammen, och
hubben visar verktygens ikoner från `src/Hub/Codestead.Hub/Assets/tools/<id>.png`. Ändrar du en SVG:

```bash
rsvg-convert -w 1024 -h 1024 build/icons/codestead-linux.svg -o build/icons/codestead-linux.png
```

och gör om ICO-filen (16–256 px) och kopiorna under `Assets/`.

## Namn och version

Produktnamn, id:n och versioner finns **bara** i `build/Codestead.props`. Byt namn där. Ett nytt verktyg lägger
sina egna i `src/<Verktyg>/Directory.Build.props` (som Codestead GP:s `src/GP/Directory.Build.props`, som först
importerar repots `Directory.Build.props`): `build/Codestead.props` hör till alla produkters filer i
`packaging/products.json`, så en rad där för det nya verktyget skulle ge Codestead Linux och hubben nya versioner
utan något nytt i dem.

Versionerna anges bara som `major.minor` (`CodesteadLinuxVersion` = `0.6`, `CodesteadHubVersion` = `0.2`).
Patchnumret sätts av release-flödet när du **släpper en version för hand** (se "Bygga installationsfilerna"):
varje produkt som ändrats sedan sin senaste release får nästa nummer (0.6.0, 0.6.1, 0.6.2 …). En merge till
`main` släpper ingenting, så flera PR:er samlas i samma release. Vilka filer som hör till en produkt står i `packaging/products.json`:
`paths` (mönster som `build/icons/codestead-hub.*` går bra) minus `exclude`. En produkt får bara en ny
version när någon av dess filer har ändrats. Hubben undantar de delar av det delade `src/Shared/Codestead.UI`
som bara Codestead Linux använder (lektionskontrollerna); ett test i `tests/Hub/Codestead.Hub.Tests`
säger till om hubben börjar använda något av dem. Skript som bara styr flödet (`plan.py`,
installationstesterna …) hör inte till någon produkt. För nästa större version ändrar du `0.6` till
`0.7`. Lokala byggen får versionen `x.y.0`.

## Hubbens bakgrundsläge

Hubben kan ligga i systemfältet (`HubTray`): när ett verktyg öppnas (inställning, på som standard), när
stängknappen trycks (av som standard) och när den startar med datorn (`Autostart` i `Codestead.Hub.Core`:
`HKCU\…\Run` på Windows, `~/.config/autostart/codestead-hub.desktop` på Linux, startar med `--background`).
Saknas systemfält (`TraySupport`: på Linux krävs en StatusNotifierItem-värd, t.ex. GNOME med AppIndicator)
minimeras hubben i stället, så den aldrig försvinner. Bara en hubb kör per användare (`SingleInstance`): en andra
start visar den första. Med "Installera verktygsuppdateringar automatiskt" installerar hubben nya versioner efter
varje koll i katalogen, aldrig medan verktyget körs. Snabbtestet (`--smoke-test`) hoppar över allt detta.

## Språk

Alla appar har samma språk, i `build/languages.json` (kod, namn, skrivriktning och `offered`). Listan läses
av Codestead Linux (`LanguagesLib`), hubben (`HubStrings`), release-flödet (`packaging/plan.py`) och testerna.

- **Erbjudna språk** (`"offered": true`) visas i menyerna, och deras texter, kapitel och ändringslogg krävs av
  testerna. I dag: engelska (standard), svenska, spanska, tyska, franska, kinesiska och japanska.
- **Parkerade språk** (`"offered": false`: portugisiska, ryska, arabiska, hindi) finns inte i menyerna och
  krävs inte, men filerna ligger kvar. En sparad parkerad språkkod blir engelska. För att ta tillbaka ett språk:
  låt någon med språket som modersmål granska texterna, fyll på det som saknas och sätt `"offered": true`.
- Stödet för höger-till-vänster (arabiska) finns kvar i koden och testas fortfarande.

## Ändringslogg ("Vad är nytt")

Vad som ändrats i varje version står i `src/Linux/changelog.json` och `src/Hub/changelog.json`,
nyast först:

```json
[
  {
    "version": "0.5.5",
    "date": "2026-11-03",
    "changes": { "en": ["What changed, one short line each."], "sv": ["Vad som ändrats, en kort rad var."] }
  }
]
```

- **Det finns en post för nästa version** (senaste releasen + 1 i patchnumret). Den första PR:en efter en
  release skapar den; **varje följande PR fyller på samma post** med sina rader, tills versionen släpps. Uppdatera
  `date` till dagens datum när du lägger till rader. Posten ska finnas på alla språk med lika många rader på
  varje språk. `packaging/plan.py` stoppar både PR-bygget och releasen om posten saknas eller är ofullständig,
  och testet `WhatsNewTests` kontrollerar filerna.
- Skriv för användaren, inte för utvecklaren: vad man märker, inte vilka filer som ändrats.
- **Codestead Linux** bäddar in sin fil och visar nyheterna första gången den startar efter en uppdatering
  (och från inställningarna). Vilken version som visats sparas i `whatsnew.json` i appens datamapp.
- **Hubben** visar sina egna nyheter på samma sätt. När release-flödet skriver katalogen tar det med de tio
  senaste posterna för varje verktyg (`packaging/catalog.py --changelog-file`). Hubben visar dem när den
  uppdaterat ett verktyg och skriver då in versionen i verktygets `whatsnew.json`, så att verktyget inte
  visar samma nyheter igen. Varje verktyg har också knappen "Vad är nytt".

## Färgsystemet

Färgerna har fasta betydelser i båda apparna (och i kommande verktyg). De finns som nycklar i
`src/Shared/Codestead.UI/Themes/Codestead.axaml`, i både ljust och mörkt tema:

| Nyckel | Betydelse | Används till |
| --- | --- | --- |
| `CsAccent`, `CsAccentSoft`, `CsOnAccent` | appens egen färg | primärknappar, valt kapitel, fokus – aldrig "rätt/klart" |
| `CsSuccess`, `CsSuccessSoft` | klart, rätt, godkänt (grönt) | bockar, framstegsmätare, rätt svar, "kapitlet klart" |
| `CsWarning`, `CsWarningSoft` | ledtråd, varning (bärnsten) | ledtrådar, "texten finns inte på ditt språk", katalogproblem |
| `CsDanger`, `CsDangerSoft` | fel, underkänt, farligt (rött) | fel svar, underkänt prov, radera-knappar |
| `CsInfo`, `CsInfoSoft`, `CsLink` | information, länkar (blått) | länkar, nedladdningsmätare |
| `CsReward`, `CsRewardSoft`, `CsRewardStrong` | belöningar (guld) | XP, nivåer, utmärkelser, dagar i rad |

- **Accentfärgen är appens varumärke**: `src/Shared/Codestead.UI/Themes/Brand.cs` har en färg per app (Linux
  blågrön, hubben indigo) och appens `App.axaml.cs` lägger in den med `Brand.<App>.ApplyTo(Resources)`.
  Ett nytt verktyg lägger till en egen `Brand`.
- `CsWarnBg`/`CsWarnBorder` finns kvar för äldre kod; använd `CsWarningSoft`/`CsWarning` i ny kod.
- `ThemeTests` kontrollerar att alla nycklar finns i båda teman och att text går att läsa (kontrast minst 4,5:1
  mot bakgrunderna och mot den egna "Soft"-färgen, och för knapptext på accentfärgen). Byt en färg → kör testet.
- Emoji visas i färg genom att fönstrets typsnitt (`CsUiFont`) har emoji-typsnitt som reserv.

## Spelifiering (XP, nivåer, utmärkelser)

Motorn är gemensam för alla verktyg och vet inget om Linux: `src/Shared/Codestead.Learning/` (`GameRules`,
`GameState`, `XpRules`, `Levels`, `CommonAchievements`), testad mot en påhittad kurs i
`tests/Shared/Codestead.Learning.Tests`. Ett verktyg beskriver sin kurs med en `CourseOutline` (delar, lektioner,
vilka delar som har prov) och skapar `new GameRules(outline, utmärkelser)`. Codestead Linux gör det i
`src/Linux/Codestead.Content/Game/LinuxGame.cs`, med sina egna utmärkelser i `AchievementsLib.cs` och kommandoanalysen
i `CommandInfo.cs` (en `CommandFacts` som också räknar pipes, sudo, loopar …); Linux-kursens tester finns i
`tests/Linux/Codestead.Content.Tests/GameTests.cs`. Vyerna (topprad, notiser, firande, galleri, profilrad) finns i
`src/Shared/Codestead.UI/Controls/Game/` och tar färdigöversatta texter, så att samma vyer fungerar i alla verktyg och
i hubben. Codestead Linux kopplar ihop dem i `src/Linux/Codestead.Linux/MainWindow.Game.cs`.

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
- **Profil till hubben**: verktyget skriver `profile.json` (`ToolProfile`, `src/Shared/Codestead.UI/Controls/Game/Profile/ToolProfile.cs`)
  i sin datamapp när något märkbart ändras och vid start. Filen innehåller alla texter på alla språk, så hubben
  kan visa nivå, dagar i rad och galleriet utan verktygets texter. Ett nytt verktyg skriver samma fil.

## Projektstruktur

Varje app har en egen mapp under `src/` (och samma under `tests/`); det som flera appar använder ligger i
`src/Shared/`. En app äger allt i sin mapp: projekten, kapiteltexterna, ändringsloggen, beskrivningen som
hubben visar och texten på release-sidan. `packaging/products.json` pekar på mappen (`"dir"`).

```text
build/Codestead.props            Namn, id:n och version för alla produkter
src/
├── Shared/                      Gemensamt för alla appar (beror aldrig på Linux-simulatorn)
│   ├── Codestead.Common/        Ren .NET: språklistan (build/languages.json), översättning med platshållare,
│   │                            JSON-inställningar, produktinfo (namn, id, version)
│   ├── Codestead.Learning/      Lärmotorn utan UI: kursens disposition, XP, nivåer, dagar i rad, utmärkelser,
│   │                            LearningState (det som sparas i state.json)
│   ├── Codestead.Learning.UI/   Lärfönstret alla verktyg delar (LearningWindow, en fil per del: Layout, Sidebar,
│   │                            Lesson, Exam, Tasks, Workbench, Settings, Updates, Game, SmokeTest) och
│   │                            LearningTool – det verktyget ger fönstret
│   └── Codestead.UI/            Avalonia-delar: tema och färgsystem, markdown-vy, dialoger, kontrollfrågor
│                                (med en ISandbox som verktyget ger), spelvyer, lagring, "Vad är nytt",
│                                självuppdatering, och appskalet i App/ (start, inställningar, nyheter, snabbtest)
├── Linux/                       Codestead Linux
│   ├── Codestead.Linux/         Appen: LinuxTool (Linux-kursen och terminalen i lärfönstret), Program, App
│   ├── Codestead.Terminal/      Terminalen (TerminalView, ANSI-färger) och ShellSandbox för kontrollfrågorna
│   ├── Codestead.Content/       Linux-kursen: kapitel och uppgifter (Chapters/, ChapterDefinitions.cs, Checks.cs), Linux-spelet
│   │                            (Game/), språk, UI-texter (i18n/ui/*.json)
│   ├── Codestead.Shell/         Den simulerade terminalen (bash, zsh, fish, apt, pacman, dnf, git ...)
│   │   ├── Shell/               Kör kommandorader: pipes, omdirigering, sudo, skript, jobb (en partiell fil per del)
│   │   ├── Parser/              Bash-parser: Lexer, Parser och syntaxträdet (Ast/, en nod per fil)
│   │   ├── Vfs/                 Virtuellt filsystem med ägare och rwx-rättigheter
│   │   ├── InitfsLib.cs         Startfilerna för varje distribution
│   │   ├── World.cs, world/     Elevens dator på elevens språk (namn, ord, övningsfiler)
│   │   ├── Packages/            Paketdatabasen (olika paketnamn per familj)
│   │   ├── ShellI18n.cs, i18n/  Simulatorns egna tips och help-sammanfattningar
│   │   └── Commands/<Grupp>/    Alla kommandon, en mapp per grupp och en fil per kommando (Users/UsersCmd.Useradd.cs …)
│   ├── content/
│   │   ├── chapters/<språk>/    Kapiteltexterna (markdown), ett språk per katalog
│   │   └── i18n/<språk>/        Översatta titlar och uppgiftstexter
│   ├── changelog.json           "Vad är nytt" (nyast först)
│   ├── description.json         Beskrivningen i hubben, per språk
│   └── release-notes.md         Texten på release-sidan
└── Hub/                         Hubben "Codestead"
    ├── Codestead.Hub/           Appen (Avalonia), texter i i18n/<språk>.json
    ├── Codestead.Hub.Core/      Logik utan UI: signerad katalog, nedladdning, installation, uppdatering
    └── changelog.json, description.json, release-notes.md
tests/
├── Shared/Codestead.Learning.Tests/ Lärmotorn mot en påhittad kurs (utan Linux)
├── Shared/Codestead.UI.Tests/   UI (headless): kontroller, tema och kontrast, spelvyer, ändringsloggar
├── Linux/Codestead.Shell.Tests/ Simulatorn
├── Linux/Codestead.Terminal.Tests/ Terminalen och sandlådan med den riktiga simulatorn
├── Linux/Codestead.Content.Tests/ Alla uppgifter i alla distros och språk, spelmotorn, UI-texter
└── Hub/Codestead.Hub.Tests/     Katalog, signatur, installation, hubbens texter
packaging/                       Byggskript, installationstester, products.json (vilka produkter som byggs),
                                 catalog.py (hubbens katalog) och hub-e2e.sh (hubben installerar Codestead Linux)
```

En ny app (t.ex. C++) får en egen mapp `src/Cpp/` och `tests/Cpp/`, en post i `packaging/products.json` och
sina id:n och versioner i `src/Cpp/Directory.Build.props` – se "Så gör du ett nytt verktyg" nedan.

## Så gör du ett nytt verktyg

Allt som inte handlar om Linux finns i `src/Shared/` och används av Codestead Linux i dag. Ett nytt verktyg, t.ex.
**Codestead C++**, behöver bara det som är unikt för ämnet:

1. **Mappar och produkt**: `src/Cpp/Codestead.Cpp/` (appen), gärna `src/Cpp/Codestead.Cpp.Course/` (kursen),
   `src/Cpp/changelog.json`, `description.json`, `release-notes.md`, ikoner i `build/icons/codestead-cpp.*`,
   id/namn/version i `src/Cpp/Directory.Build.props` och en post med `"dir": "src/Cpp"` i `packaging/products.json`.
2. **Appen**: `Program.cs` anropar `AppHost.Run<App>(args, product)`; `App.axaml.cs` lägger in en egen `Brand`
   (accentfärg) och öppnar `new LearningWindow(new CppTool(), smokeTest)`.
3. **`CppTool : LearningTool`** (jämför `src/Linux/Codestead.Linux/LinuxTool*.cs`):
   - kursen: kapitel (`CourseChapter`), titlar, texter per språk, källor, uppgifter som `TaskInfo` (text, ledtråd,
     lösning) och deras nycklar;
   - spelet: `new GameRules(outline, utmärkelser)` med `CommonAchievements` plus egna, och en `CommandFacts`-klass
     om verktyget vill räkna egna saker (t.ex. kompileringar);
   - varianter om ämnet har sådana (t.ex. kompilatorer: gcc/clang) – annars en enda;
   - arbetsytan: kontrollen under uppgifterna (t.ex. en kodruta och en körknapp), som säger till efter varje körning
     (`OnRan`) och avgör vilka uppgifter som löstes (`Evaluate`);
   - en `ISandbox` för kontrollfrågornas "prova själv".
4. **Texter**: verktygets UI-texter med samma nycklar som Codestead Linux använder för fönstret (se
   `src/Linux/Codestead.Content/i18n/ui/en.json`) och de egna, på alla erbjudna språk.
5. **Tester**: kursens uppgifter ska gå att lösa med sina lösningar (som `ChaptersTests` för Linux), och
   `CodeLayoutTests`/`ProductFilesTests` gäller även den nya mappen.

Hubben behöver ingen ändring: den läser verktygets `profile.json` och katalogen.

## Codestead GP (grafikprogrammering)

Codestead GP (`src/GP/`, grenen `GraphicsProgramming`) är byggt som ett nytt verktyg enligt avsnittet ovan. Eleven
väljer **grafik-API** högst upp – OpenGL 3.3, Vulkan eller DirectX 12 – och det är verktygets *variant*: varje kapitel,
uppgift och projekt följer valet. Kursen följer learnopengl.com kapitel för kapitel; OpenGL-koden härmar
learnopengl.com, Vulkan-koden vulkan-tutorial.com och DirectX 12-koden Microsofts D3D12HelloWorld-exempel.

```text
src/GP/
├── Codestead.GP/          Appen: GpTool (kursen i lärfönstret), Workbench/ProjectView (editor, flikar, Bygg & kör,
│                          utdata och förhandsvisning), NoSandbox (lektionerna har bara quiz-frågor)
├── Codestead.GP.Course/   Kursen: GpCourse (delar och kapitel i ordning, startprojekt, uppgifter), Edits
│                          (edits.txt), CourseText (texter per språk och API), Checks/ (uppgifternas kontroller),
│                          Game/ (utmärkelser), UI-texter i i18n/ui/<språk>.json
├── Codestead.GP.Gpu/      Den simulerade GPU:n (utan UI):
│   ├── Build/             Kompileringssteget: klamrar, okända API-namn med "did you mean" (symbols/*.txt från de
│   │                      riktiga headerfilerna), shaders som inte går att tolka
│   ├── Shading/           En tolk för den del av GLSL och HLSL som kursen använder (lexer, parser, körning)
│   ├── Readers/           Läser vad programmet gör: GlReader följer main() anrop för anrop som en drivrutin,
│   │                      VulkanReader och D3D12Reader läser programmen så som tutorials skriver dem
│   ├── Scene/             Resultatet: fönster, renderingsloop, rensningsfärg, ritanrop, meddelanden (SimNote)
│   └── Raster/            Mjukvaru-rasterisering med perspektivkorrekt interpolering, culling och djuptest
├── content/
│   ├── chapters/<språk>/  Kapiteltexterna (markdown); engelska är källan, svenska krävs, andra språk faller
│   │                      tillbaka på engelska
│   ├── i18n/<språk>/      Titel och uppgiftstexter per kapitel (en sträng, eller en per API)
│   ├── references/        Källor per kapitel (fältet "api" för en källa som bara gäller ett API)
│   └── projects/<api>/<kapitel>/  start/ (projektet eleven börjar med), solution/, edits.txt, tasks.md
└── verify/                verify.sh och apply_edits.py (se nedan)
```

**Ett kapitel** består av texten (alla API:er i samma fil), uppgiftstexterna och ett projekt per API:

- I texten skrivs det som bara gäller ett API i block: `:::opengl` … `:::`, `:::vulkan` …, `:::d3d12` … eller flera
  på en gång (`:::vulkan d3d12`). Platshållare: `{{api}}`, `{{apiFull}}`, `{{shaderLanguage}}`. Använd bara
  ` ```quiz `-frågor. **Varje API ska få lika många frågor i samma ordning** (fönstret räknar frågorna i texten för
  det valda API:t); en API-specifik fråga skrivs därför som en fråga i vart och ett av de tre blocken.
  `ContentTests` kontrollerar det, och att svenskan har samma frågor.
- `edits.txt` är uppgifterna för ett API, i ordning: varje uppgift är en eller flera kodändringar (`find` → `replace`)
  från `start/`. När eleven klickar på lösningen läggs ändringen in i projektet. Alla ändringar efter varandra ska ge
  exakt `solution/` (`apply_edits.py` och `TaskTests` kontrollerar det).
- Kontrollerna finns i `Codestead.GP.Course/Checks/TaskChecks.<Kapitel>.cs`, per uppgifts-id. Kontrollera helst
  **resultatet** (pixlar i den simulerade bilden, rensningsfärgen) så att samma kontroll gäller alla API:er; annars
  koden (`c.Has(...)`, mellanslag i mönstret matchar valfritt blanksteg). Betyder samma id olika saker i olika API:er,
  använd `PerApi(opengl: …, vulkan: …, d3d12: …)`. `TaskTests` kräver att varje uppgift löses av sin lösning och
  **inte** redan är löst före.
- Lägg till kapitlet i `GpCourse.LessonList` (ordningen där är kursens ordning) och dess kontroller i `TaskChecks.cs`.

**Koden ska vara korrekt.** `src/GP/verify/verify.sh <mappar>` kompilerar projekten med de riktiga verktygen:
OpenGL och Vulkan med g++ (GLAD genereras med `pip install glad`), DirectX 12 med MinGW-w64 mot Microsofts
DirectX-Headers och DirectXMath, shaders med glslangValidator. OpenGL- och Vulkan-programmen **körs** dessutom under
Xvfb med Mesa (llvmpipe/lavapipe) och Khronos valideringslager – ett enda valideringsfel underkänner – och en
skärmbild sparas. Skriptets kommentar listar paketen som behövs (Ubuntu 24.04). Kör det på `start/` och `solution/`
för varje kapitel du ändrar, och `apply_edits.py` på kapitlet.

**Simulatorn är inte en riktig GPU.** Den förstår kursens kod och de vanliga misstagen (glömd `glClear`, avstängt
vertexattribut, ingen pipeline bunden, saknade barriärer …) och säger till med meddelanden som `sim.<nyckel>` i
UI-texterna. Kod utanför det den förstår ger en förhandsvisning som kan skilja sig från en riktig körning. Nya kapitel
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
     ett kommando med samma utskrift som första raden ger på en ny dator (`ISandbox.OutputOf`). Prov
     visar också terminalen, eftersom de har `try`-frågor.
     Ett kapitel utan kontrollfrågor låses upp med knappen "Jag har läst kapitlet".
   - **Källor**: `src/Linux/content/references/mitt-kapitel.json` med
     `[{ "title": ..., "url": "https://...", "publisher": ... }]`. Bara officiella webbplatser
     (listan finns i [verification/README.md](verification/README.md)); testerna säger nej till andra.
   - **Sammanfattning och prov** för ett huvudkapitel: `<huvudkapitel>-summary.md` och
     `<huvudkapitel>-exam.md` (t.ex. `grunder-exam.md`). De läggs till sist i huvudkapitlet av sig själva.
     Provet består av kontrollfrågor (minst 10), öppnas när alla sub-kapitel är klara och kräver 80 %.
2. Lägg till kapitlet med uppgifter i en egen fil, `src/Linux/Codestead.Content/Chapters/<huvudkapitel>/<id>.cs`,
   och anropa det i listan i `ChapterDefinitions.cs` (ordningen där är kursens ordning). Varje uppgift har
   en `Check` som körs efter varje kommando och en `Solution` (lista med kommandon).
3. Kör `dotnet test`. Testerna kör alla lösningar i alla distributioner och kontrollerar att
   varje kapitel finns på alla språk, och att kontrollfrågorna är likadana på alla språk.

Behövs ett nytt kommando lägger du det i `src/Linux/Codestead.Shell/Commands/`. Ska det installeras med
pakethanteraren lägger du också till ett paket i `Packages/PackagesLib.Catalog.cs`.

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
- `en.json` är källan: alla språk har samma nycklar (testerna i `WorldTests.cs` kontrollerar det).
- Kapiteltexter, uppgiftstexter, lösningar och kontroller skriver namnen som platshållare: `{{documents}}`,
  `{{user}}`. I kapitlens kontroller fyller hjälpfunktionerna i `Checks.cs` (`Node`, `Re(c, …)`, `Env`, `W(c)`) i dem.
- Det program skriver (loggar, konfigurationsfiler, systemfiler) är engelska på alla språk, som på en
  riktig dator. `$LANG` följer språket, och `sort` sorterar därefter.
- När eleven byter språk översätts terminalen på plats (`WorldMigration.Translate`): övningsfilerna och
  användaren byter namn, och orörda filer får det nya språkets text. Elevens egna filer och git-repon
  lämnas som de är.
- Testerna löser alla uppgifter med varje språks dator och kör kontrollfrågorna (`predict`, `try`) i
  simulatorn på varje språk.

Med miljövariabeln `CODESTEAD_WORLD_DIR` läses world-filer från en katalog i stället för de inbyggda,
så att en översättning kan provas utan att bygga om.

## Simulatorns egna texter

Tips, anmärkningar och välkomsttexten som simulatorn skriver i terminalen finns i
`src/Linux/Codestead.Shell/i18n/<språk>.json` (`messages`), och anropas med en nyckel:
`sh.Msg("pkg.aptListsEmpty")` eller `Dim(sh, "users.noPasswordSet", ("user", name))`. Engelska
(`en.json`) är källan; lägg till nyckeln i filerna för alla erbjudna språk med samma `{platshållare}`. Utskrifter som
härmar riktiga program (`ls: cannot access ...`) och manualsidor översätts inte.

Sammanfattningarna som `help` visar (`summaries`) skrivs i koden (`Summary` på svenska,
`SummaryEn` på engelska) och förs över till `sv.json` och `en.json` med
`CODESTEAD_UPDATE_SHELL_I18N=1 dotnet test --project tests/Linux/Codestead.Shell.Tests`. Översätt sedan
ändringen i de andra språken. Testerna i `ShellI18nTests.cs` kontrollerar nycklar, platshållare och
att inget har glömts.

## Simulatorns filsystem, cron och servern

- **Länkar** (`Vfs/`): en symbolisk länk är en nod med `Type = "link"` och sökvägen i `Content`.
  `VFS.Lookup` följer länkar (högst 40, sedan `ELOOP`); `Lookup(..., follow: false)` och
  `TryLookupLink` ger själva länken, som `lstat`. Kommandon som arbetar med namnet (rm, mv, rmdir,
  ls -l, find, tar) använder den varianten. En hård länk är samma nod i flera kataloger, med
  `Nlink` och ett gemensamt `Ino`; när en sparad terminal läses in fogar `JoinHardLinks` ihop dem
  igen. `VfsLib.CloneNode` (cp) ger alltid nya filer utan inodnummer.
- **umask** finns på `VFS` och sparas med terminalen. `WriteFile` och `Mkdir` använder den.
- **cron** (`Commands/Cron/`): användarnas crontab ligger i `/var/spool/cron/crontabs`
  (Debian/Ubuntu) eller `/var/spool/cron`. `CronCmd.Tick` körs före varje kommandorad och kör de
  jobb vars minut har passerat sedan förra gången (högst en timme bakåt), men bara medan tjänsten
  cron/crond/cronie är igång. Tiden räknas inte medan appen är stängd, precis som en avstängd dator.
  Systemets egna jobb (`run-parts`) loggas men körs inte.
- **Servern** `192.168.1.10` (`SshCmd.ServerFor`) är en egen Debian-terminal i minnet. ssh, scp och
  rsync kör mot den, och `~/.ssh/config` (`Host`, `HostName`, `User`, `Port`) läses på samma sätt
  som av OpenSSH. Serverns filer sparas inte när appen stängs.

## Bygga installationsfilerna

Allt byggs av GitHub Actions (`.github/workflows/release.yml`), för varje produkt i
`packaging/products.json` (Codestead Linux och hubben):

1. Slå ihop PR:erna till `main`. Det släpper ingenting: pull requests och merges till `main` planerar (och
   kontrollerar ändringsloggen), testar och bygger.
2. **Släpp en version:** Actions → **Release** → **Run workflow**, välj `main` och kryssa i **publish**.
   Flödet (`packaging/plan.py`) räknar ut nästa patchversion för varje produkt som ändrats sedan dess
   senaste release. Två körningar för hand väntar på varandra, så samma version kan inte tas två gånger.

Flödet bygger alla produkter och installerar och startar dem på rena system (Windows Server 2022/2025,
Ubuntu 22.04/24.04, Fedora, Arch Linux, CachyOS). Hubben får dessutom installera och starta Codestead
Linux från en signerad katalog. Därefter publiceras de ändrade produkterna i det offentliga repot
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
publicera – så provar du en PR på riktiga system. Installationstesterna körs bara i körningar för hand. Byggena laddas upp som artefakter (ungefär 1,6 GB per körning, sparas en dag)
och skulle annars fylla repots lagringsutrymme för artefakter.

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

### Lokalt

Linux (kräver [nfpm](https://nfpm.goreleaser.com) och `dotnet tool install -g vpk`):

```bash
packaging/build-linux.sh src/Linux/Codestead.Linux/Codestead.Linux.csproj codestead-linux "Codestead Linux" 0.4.0
```

## Historik

Fram till version 0.3.0 var appen skriven i TypeScript/React/Electron. Den portades rad för rad
till C#; TypeScript-koden och reglerna för porteringen (`docs/PORTING.md`) finns kvar i git-historiken
(commit `a0bbdda`). Kommentarer som "Port of src/shell/..." i koden pekar dit.
