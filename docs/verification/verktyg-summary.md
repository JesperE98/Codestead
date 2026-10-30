# Faktagranskning: verktyg-summary (Sammanfattning: Fler verktyg)

Status: **ogranskad**

Sammanfattningen upprepar påståenden från [git](git.md) och [skal](skal.md); de granskas där.
Raderna nedan är påståendena i sammanfattningen.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Git sparar ögonblicksbilder av hela projektet och kommer ihåg vem som ändrade vad och varför | | ogranskad | 2026-10-30 |
| På Ubuntu installeras git med `sudo apt install git`; andra distributioner använder sin egen pakethanterare | | ogranskad | 2026-10-30 |
| `git config --global user.name/user.email` gäller alla projekt och hamnar i `~/.gitconfig` | | ogranskad | 2026-10-30 |
| `git init` gör katalogen till ett repo; historiken finns i den dolda katalogen `.git` | | ogranskad | 2026-10-30 |
| Arbetskatalog, index och historik; `git add` flyttar till indexet, `git commit` sparar indexet som en commit | | ogranskad | 2026-10-30 |
| `git commit -a` tar med ändrade filer som git redan följer men aldrig nya filer | | ogranskad | 2026-10-30 |
| `git diff` visar ändringar som inte ligger i indexet; `git diff --staged` det som ligger där | | ogranskad | 2026-10-30 |
| En gren är en etikett som pekar på en commit; vid grenbyte skriver git om arbetskatalogen | | ogranskad | 2026-10-30 |
| Konflikt: rätta filen, `git add` och avsluta med `git commit` | | ogranskad | 2026-10-30 |
| `.gitignore` gäller bara filer som git inte redan följer; `git rm --cached` slutar följa en fil men behåller den på disken | | ogranskad | 2026-10-30 |
| Fjärrepot heter oftast `origin`; `git pull` hämtar och slår ihop, `git push` skickar | | ogranskad | 2026-10-30 |
| `git restore --staged FIL` tar ut en fil ur indexet; `git branch -d` tar bort en sammanslagen gren | | ogranskad | 2026-10-30 |
| Program som `ls` och `grep` fungerar likadant i alla skal; språket runt dem skiljer sig | | ogranskad | 2026-10-30 |
| `/etc/shells`, `/etc/passwd`, `$SHELL` (inloggningsskal) och `$0` (skalet man kör) | | ogranskad | 2026-10-30 |
| zsh: nästan all bash-syntax, `**/`, `autocd`, `setopt`/`unsetopt`, delar inte ociterade variabler | | ogranskad | 2026-10-30 |
| fish: `set`, `$status`, `math`, block som slutar med `end`, listor numrerade från 1 | | ogranskad | 2026-10-30 |
| Ett startat skal körs inuti bash; `exit` går tillbaka; `-c` kör ett kommando och avslutar | | ogranskad | 2026-10-30 |
| `#!`-raden avgör vilket skal som kör ett skript | | ogranskad | 2026-10-30 |
| `chsh -s` byter inloggningsskal från nästa inloggning | | ogranskad | 2026-10-30 |
| Konfigurationsfilerna `~/.bashrc`, `~/.zshrc` och `~/.config/fish/config.fish` | | ogranskad | 2026-10-30 |
