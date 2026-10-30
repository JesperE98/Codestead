# Utveckling (internt)

Den här filen är för dig som äger projektet. Den följer inte med i appen och
visas inte för användarna.

## Kom igång

Kräver [Node.js](https://nodejs.org) 20 eller senare.

```bash
npm install
```

```bash
npm run dev
```

Öppna sedan adressen som visas (normalt http://localhost:5173).

### Andra kommandon

| Kommando | Gör |
|---|---|
| `npm test` | Kör alla tester (skalet, pakethanterarna och alla kapiteluppgifter) |
| `npm run build` | Bygger webbversionen till `dist/` – kan läggas på vilken statisk webbserver som helst |
| `npm run app` | Bygger och startar skrivbordsappen (Electron) |
| `npm run app:dist` | Bygger installationsfiler för ditt operativsystem till `release/` |

### Bygga installationsfilerna själv

Skrivbordsappen är samma webbapp inpackad med [Electron](https://www.electronjs.org),
och [electron-builder](https://www.electron.build) skapar installationsfilerna:

| Operativsystem | Fil | Kommando |
|---|---|---|
| Windows | Installationsguide (`.exe`) där man väljer mapp och genvägar | `npm run app:dist:win` |
| macOS | `.dmg` för både Intel och Apple Silicon | `npm run app:dist:mac` |
| Linux | `.AppImage` som körs direkt | `npm run app:dist:linux` |

Filerna hamnar i `release/`. Varje operativsystem måste byggas på sig självt,
så det enklaste är att låta GitHub göra det:

1. Höj `version` i `package.json` (t.ex. 0.2.0 → 0.3.0).
2. Slå ihop ändringen till `main`.

Då bygger flödet `.github/workflows/release.yml` installationsfilerna för
Windows och Linux och lägger upp dem som release `v0.3.0`. (macOS är
avstängt i flödet, eftersom GitHub inte ger privata repon macOS-maskiner på
det här kontot.) Ikonen ligger i `build/icon.svg` (och `build/icon.png`).

## Projektstruktur

```text
src/
├── shell/                 Den simulerade terminalen
│   ├── shell.ts           Kör kommandorader: pipes, omdirigering, sudo, skript
│   ├── parser.ts          Tolkar kommandorader (citattecken, operatorer)
│   ├── vfs.ts             Virtuellt filsystem med ägare och rwx-rättigheter
│   ├── initfs.ts          Startfilerna för varje distribution
│   ├── distros.ts         Ubuntu, Debian, Arch och Fedora
│   ├── packages.ts        Paketdatabasen (med olika paketnamn per familj)
│   ├── procs.ts           Processer och jobb
│   ├── services.ts        systemd-tjänster och journalen
│   ├── disks.ts           Diskar, partitioner och monteringar
│   ├── users.ts           Användare, grupper och lösenord
│   ├── network.ts         Simulerat nätverk (värdar, DNS, webbsidor)
│   ├── fish.ts            fish-skalets syntax (zsh/fish-läget i shellmode.ts)
│   └── commands/          Alla kommandon: ls, grep, apt, pacman, dnf, git, ssh ...
├── content/
│   ├── chapters/<språk>/  Kapiteltexterna (markdown), ett språk per katalog
│   ├── i18n/<språk>/      Översatta titlar och uppgiftstexter (JSON)
│   ├── chapters.ts        Kapitlen och deras uppgifter
│   ├── progress.ts        Kontrollerar uppgifter efter varje kommando
│   └── render.ts          Markdown → HTML, med distro-block
├── i18n/                  Gränssnittets språk (11 st.)
├── components/            React-komponenter (meny, lektion, uppgifter, terminal)
└── App.tsx
electron/main.cjs          Skrivbordsappens startfil
```

## Skriva ett nytt kapitel

1. Skapa `src/content/chapters/sv/mitt-kapitel.md` (filnamnet är kapitlets id)
   och en engelsk version i `chapters/en/` plus `i18n/en/mitt-kapitel.json`.
   - Kodblock märkta ` ```sh ` blir klickbara – ett klick lägger in kommandot i terminalen.
   - Text som bara gäller en familj läggs i ett block:

     ```text
     :::debian
     Det här visas bara för Debian och Ubuntu.
     :::
     ```

     (även `:::arch` och `:::redhat`).
   - Platshållare: `{{distro}}`, `{{hostname}}`, `{{family}}`, `{{pm}}`, `{{adminGroup}}`.
2. Lägg till kapitlet i `CHAPTERS` i `src/content/chapters.ts` med uppgifter.
   Varje uppgift har en `check`-funktion som körs efter varje kommando, och en
   `solution` (lista med kommandon).
3. Övriga språk: lägg till `chapters/<språk>/mitt-kapitel.md` och
   `i18n/<språk>/mitt-kapitel.json`. Testerna kräver att alla 11 språk finns.
4. Kör `npm test`. Testet kör alla lösningar i alla distributioner och
   kontrollerar att varje uppgift faktiskt går att klara.

Behövs ett nytt kommando lägger du det i `src/shell/commands/`. Ska det
installeras med pakethanteraren lägger du också till ett paket i
`src/shell/packages.ts`.

## Språk och översättningar

- Gränssnittets texter: `src/i18n/ui.ts` (alla språk i en fil).
- Kapiteltexter: `src/content/chapters/<språk>/<kapitel-id>.md`.
- Översatta titlar och uppgiftstexter: `src/content/i18n/<språk>/<kapitel-id>.json`.
- Svenska är originalspråket (uppgiftstexterna står i `src/content/chapters.ts`).
  Saknas en översättning visas engelska och i sista hand svenska.
- Terminalens egna tipsrader och manualsidor finns på svenska och engelska
  (`sh.msg({ sv, en })`, `summaryEn`/`manEn` och `src/shell/commands/man-en.ts`).
