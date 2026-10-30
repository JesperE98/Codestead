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

```bash
git tag v0.1.0
```

```bash
git push origin v0.1.0
```

Då bygger flödet `.github/workflows/release.yml` alla tre och lägger upp dem
som en ny release. Ikonen ligger i `build/icon.svg` (och `build/icon.png`).

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
│   └── commands/          Alla kommandon: ls, grep, chmod, apt, pacman, dnf ...
├── content/
│   ├── chapters/*.md      Kapiteltexterna (markdown)
│   ├── chapters.ts        Kapitlen och deras uppgifter
│   ├── progress.ts        Kontrollerar uppgifter efter varje kommando
│   └── render.ts          Markdown → HTML, med distro-block
├── components/            React-komponenter (meny, lektion, uppgifter, terminal)
└── App.tsx
electron/main.cjs          Skrivbordsappens startfil
```

## Skriva ett nytt kapitel

1. Skapa `src/content/chapters/10-mitt-kapitel.md`.
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
3. Kör `npm test`. Testet kör alla lösningar i alla distributioner och
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
