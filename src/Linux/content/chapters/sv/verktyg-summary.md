# Sammanfattning: Fler verktyg

I den här delen träffade du två verktyg som du kommer att använda resten av
livet i terminalen: git, som håller reda på historiken för dina filer, och
andra skal än bash. Här är det du bör komma ihåg inför provet.

## Git i terminalen

**Git** är ett versionshanteringssystem: det sparar ögonblicksbilder av hela
projektet, kommer ihåg vem som ändrade vad och varför, och låter dig gå
tillbaka i tiden. I Ubuntu installerar du det med `sudo apt install git`;
andra distributioner använder sin egen pakethanterare.

- Före din första commit berättar du för git vem du är med
  `git config --global user.name` och `user.email`. `--global` betyder alla
  dina projekt; inställningarna hamnar i `~/.gitconfig`.
- `git init` gör en katalog till ett **repo**. Hela historiken ligger i den
  dolda katalogen `.git`.
- En ändring passerar tre platser: **arbetskatalogen** (filerna du ser),
  **indexet** (det som ska med i nästa commit) och **historiken** (alla
  commits). `git add` flyttar ändringar till indexet, `git commit` sparar
  indexet som en ny commit.
- `git commit -a` lägger till varje ändrad fil som git redan följer – men
  aldrig nya filer.
- `git diff` visar ändringar som ännu inte ligger i indexet; `git diff
  --staged` visar det som ligger i indexet.
- En **gren** är en etikett som pekar på en commit och flyttar med när nya
  commits görs. När du byter gren skriver git om arbetskatalogen.
- `git merge` för in en gren i den du står på. Om båda grenarna har ändrat
  samma rader får du en **konflikt**: rätta filen, kör `git add` på den och
  avsluta med `git commit`.
- `.gitignore` listar filer som git inte ska följa. Den gäller bara filer som
  git inte redan följer.
- Ett **fjärr-repo** (*remote*) är en kopia av repot någon annanstans, oftast
  med namnet `origin`. `git pull` hämtar och slår ihop, `git push` skickar
  dina commits.

| Kommando | Gör |
|---|---|
| `git config --global user.name "…"` | Berätta ditt namn för git (och `user.email`) |
| `git init` | Gör katalogen till ett repo |
| `git status` | Visa var varje ändring finns |
| `git add FIL` / `git add .` | Lägg ändringar i indexet |
| `git commit -m "…"` | Spara indexet som en ny commit |
| `git commit -am "…"` | Lägg till varje följd fil och committa i ett steg |
| `git diff` / `git diff --staged` | Visa ändringar som inte är committade |
| `git log --oneline --graph --all` | Visa historiken |
| `git restore FIL` | Kasta bort ändringar i en fil |
| `git restore --staged FIL` | Ta ut en fil ur indexet |
| `git switch -c GREN` / `git switch GREN` | Skapa en gren / byt gren |
| `git merge GREN` | Slå ihop en gren med den du står på |
| `git branch -d GREN` | Ta bort en gren som är ihopslagen |
| `git rm --cached FIL` | Sluta följa en fil men behåll den på disken |
| `git clone`, `git pull`, `git push` | Samarbeta via ett fjärr-repo |

## Andra skal: zsh och fish

**Skalet** läser det du skriver och startar andra program. Program som `ls`
och `grep` fungerar likadant i alla skal – det som skiljer är språket runt
dem: variabler, loopar, villkor och prompten.

- `/etc/shells` listar skalen som får vara inloggningsskal. Ditt
  inloggningsskal är det sista fältet på din rad i `/etc/passwd` och finns
  också i `$SHELL`. `$0` innehåller skalet som du kör just nu.
- **zsh** förstår nästan all bash-syntax och lägger till bekvämligheter: `**/`
  letar i alla underkataloger, och med `autocd` går du till en katalog genom
  att bara skriva dess namn. Inställningar slås på och av med `setopt` och
  `unsetopt`. Till skillnad från bash delar zsh inte upp variabler utan
  citattecken vid mellanslag.
- **fish** är lätt att använda från början men har **en egen syntax**: `set` i
  stället för `=`, `$status` i stället för `$?`, `math` i stället för
  `$((...))`, och varje block avslutas med `end`. Varje variabel är en lista,
  numrerad från 1.
- Ett skal som du startar körs **inuti** bash; `exit` tar dig tillbaka. Med
  `-c` kör ett skal ett enda kommando och avslutas.
- Skript skrivs ändå för bash (eller POSIX `sh`): `#!`-raden bestämmer vilket
  skal som kör ett skript, oavsett vilket skal du sitter i.
- `chsh -s` byter ditt inloggningsskal. Ändringen gäller från nästa
  inloggning.

| Kommando | Gör |
|---|---|
| `cat /etc/shells` | Lista skalen som får användas |
| `echo $0` / `ps` | Se vilket skal du kör just nu |
| `echo $SHELL` | Se ditt inloggningsskal |
| `zsh` / `fish` / `exit` | Starta ett annat skal / gå tillbaka |
| `zsh -c '…'` / `fish -c '…'` | Kör ett kommando i ett annat skal |
| `setopt autocd` / `unsetopt autocd` | Slå på / av en zsh-inställning |
| `set {{fruitVar}} {{fruitWord}}` / `set -e {{fruitVar}}` | Sätt / ta bort en variabel i fish |
| `set -x NAMN värde` | Sätt en miljövariabel i fish |
| `math 17 x 23` | Räkna i fish |
| `chsh -s /usr/bin/zsh` | Byt inloggningsskal |

Konfigurationsfilerna: `~/.bashrc` (bash), `~/.zshrc` (zsh) och
`~/.config/fish/config.fish` (fish).
