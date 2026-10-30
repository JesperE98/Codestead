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
dotnet run --project src/Codestead.Linux
```

Inställningar och terminaler sparas i `%APPDATA%\Codestead\codestead-linux` (Windows) respektive
`~/.config/Codestead/codestead-linux` (Linux). Med miljövariabeln `CODESTEAD_DATA_DIR` kan du välja
en annan mapp, t.ex. för att börja om från noll.

`dotnet run --project src/Codestead.Linux -- --smoke-test` startar fönstret, går igenom alla kapitel
på alla språk, löser en uppgift och avslutar med `SMOKE OK`. Det är samma test som körs efter varje
installation i release-flödet.

## Namn och version

Produktnamn, verktygs-id och version finns **bara** i `build/Codestead.props`. Byt namn där.

## Projektstruktur

```text
build/Codestead.props        Namn, id:n och version
content/linux/
├── chapters/<språk>/*.md    Kapiteltexterna (markdown), ett språk per katalog
└── i18n/<språk>/*.json      Översatta titlar och uppgiftstexter
src/
├── Codestead.Shell/         Den simulerade terminalen (bash, zsh, fish, apt, pacman, dnf, git ...)
│   ├── Shell.cs             Kör kommandorader: pipes, omdirigering, sudo, skript, jobb
│   ├── Parser.cs            Bash-parser (syntaxträd)
│   ├── Vfs.cs               Virtuellt filsystem med ägare och rwx-rättigheter
│   ├── Initfs.cs            Startfilerna för varje distribution
│   ├── Packages.cs          Paketdatabasen (olika paketnamn per familj)
│   ├── Services.cs, Disks.cs, Users.cs, Network.cs, Procs.cs, Fish.cs, Shellmode.cs
│   ├── Js.cs                Hjälpfunktioner med JavaScript-semantik (från porteringen)
│   └── Commands/            Alla kommandon: ls, grep, chmod, apt, pacman, dnf, git, ssh ...
├── Codestead.Content/       Kapitel, uppgifter och kontroller (ChapterDefinitions.cs), språk, UI-texter (i18n/ui/*.json)
├── Codestead.UI/            Delade Avalonia-delar för alla verktyg: tema, terminal, markdown-vy, dialoger, lagring
└── Codestead.Linux/         Själva appen (Avalonia)
tests/                       xUnit: Shell (simulatorn), Content (alla uppgifter i alla distros och språk), UI (headless)
packaging/                   Byggskript och installationstester för Windows och Linux
```

## Skriva ett nytt kapitel

1. Skriv `content/linux/chapters/en/mitt-kapitel.md` (engelska är källspråket) och
   `content/linux/i18n/en/mitt-kapitel.json`, och motsvarande filer för de andra tio språken.
   - Kodblock märkta ` ```sh ` blir klickbara – ett klick lägger in kommandot i terminalen.
   - Text som bara gäller en familj läggs i `:::debian` / `:::arch` / `:::redhat` … `:::`.
   - Platshållare: `{{distro}}`, `{{hostname}}`, `{{family}}`, `{{pm}}`, `{{adminGroup}}`.
2. Lägg till kapitlet med uppgifter i `src/Codestead.Content/ChapterDefinitions.cs`. Varje uppgift har
   en `Check` som körs efter varje kommando och en `Solution` (lista med kommandon).
3. Kör `dotnet test`. Testerna kör alla lösningar i alla distributioner och kontrollerar att
   varje kapitel finns på alla språk.

Behövs ett nytt kommando lägger du det i `src/Codestead.Shell/Commands/`. Ska det installeras med
pakethanteraren lägger du också till ett paket i `Packages.cs`.

## Bygga installationsfilerna

Allt byggs av GitHub Actions (`.github/workflows/release.yml`):

1. Höj `<Version>` i `build/Codestead.props` (t.ex. 0.4.0 → 0.5.0).
2. Slå ihop ändringen till `main`.

Flödet bygger, installerar och startar appen på rena system (Windows Server 2022/2025, Ubuntu
22.04/24.04, Fedora, Arch Linux, CachyOS) och publicerar sedan releasen i det offentliga repot
`jesper-e98/codestead-releases`. Det kräver secret `RELEASES_TOKEN` (en fine-grained token med
*Contents: read and write* på `codestead-releases`).

Flödet kan också startas för hand under Actions → **Release** → **Run workflow** (utan att publicera).

GitHub har inga rena Windows 10/11-skrivbordsmaskiner, bara Windows Server. Gå därför igenom
[RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) på en riktig Windows 10/11-dator före en större release.

Lokalt (Linux, kräver [nfpm](https://nfpm.goreleaser.com) och `dotnet tool install -g vpk`):

```bash
packaging/build-linux.sh src/Codestead.Linux/Codestead.Linux.csproj codestead-linux "Codestead Linux" 0.4.0
```

## Historik

Fram till version 0.3.0 var appen skriven i TypeScript/React/Electron. Den portades rad för rad
till C# (se [PORTING.md](PORTING.md)); TypeScript-koden finns kvar i git-historiken (commit `a0bbdda`).
