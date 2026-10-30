# Faktagranskning: skal (Andra skal: zsh och fish)

Status: **ogranskad**

Texten är omskriven så att den gäller Ubuntu (terminalen utanför distro-delen) och har fått
kontrollfrågor. Inget påstående nedan är ännu kontrollerat mot en officiell källa. Raderna om
`chsh -l` på Arch och Fedora är borttagna ur texten eftersom kapitlet bara körs i Ubuntu.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Skalet tolkar `\|`, `>`, variabler, jokertecken och loopar; terminalen är bara fönstret | | ogranskad | 2026-10-30 |
| `ls`, `grep` och `cat` är separata program i `/usr/bin` och fungerar likadant i alla skal (kontrollfråga 1) | | ogranskad | 2026-10-30 |
| `sh` 1979 (Bourne shell), `bash` 1989, `zsh` 1990, `fish` 2005 | | ogranskad | 2026-10-30 |
| bash är standard i nästan alla Linuxdistributioner; zsh är standard på macOS | | ogranskad | 2026-10-30 |
| POSIX beskriver hur ett `sh`-skal ska bete sig; `dash` är `/bin/sh` på Debian och Ubuntu; `ash` på små system som Alpine | | ogranskad | 2026-10-30 |
| fish är medvetet inte POSIX-kompatibelt | | ogranskad | 2026-10-30 |
| `/etc/shells` listar skal som får användas som inloggningsskal | | ogranskad | 2026-10-30 |
| Inloggningsskalet är sista fältet i användarens rad i `/etc/passwd` och finns i `$SHELL` | | ogranskad | 2026-10-30 |
| På Ubuntu installeras zsh och fish med `sudo apt install zsh`/`fish`; paketen heter likadant i andra distributioner | | ogranskad | 2026-10-30 |
| zsh-paketet lägger till `/usr/bin/zsh` och `/bin/zsh` i `/etc/shells` | | ogranskad | 2026-10-30 |
| Första gången visar zsh *zsh-newuser-install* eftersom det inte finns någon konfigurationsfil; valen `q`, `0`, `1`, `2` | | ogranskad | 2026-10-30 |
| I zsh är `%` prompttecknet för vanliga användare och `#` för root; prompten blir `elev@ubuntu ~ %` (simulatorns värdnamn) | | ogranskad | 2026-10-30 |
| `$0` innehåller namnet på skalet man kör; `ps` visar att zsh körs inuti bash; `$SHELL` förblir inloggningsskalet | | ogranskad | 2026-10-30 |
| zsh förstår nästan all bash-syntax | | ogranskad | 2026-10-30 |
| I zsh betyder `**/` alla kataloger på alla nivåer; i bash fungerar `**` som `*` om man inte först kör `shopt -s globstar` (simulatorn saknar `shopt`) | | ogranskad | 2026-10-30 |
| Med `autocd` (del av de rekommenderade inställningarna) räcker katalognamnet för att byta katalog; `setopt`/`unsetopt` slår på och av | | ogranskad | 2026-10-30 |
| bash delar en ociterad variabel på mellanslag, zsh gör det inte; `setopt shwordsplit` ger bash-beteendet (kontrollfråga 2) | | ogranskad | 2026-10-30 |
| Med `-c` kör skalet ett enda kommando och avslutas; `zsh -c 'echo $0'` skriver `zsh` (ny mening, visad i simulatorn) | | ogranskad | 2026-10-30 |
| bash läser `~/.bashrc`, zsh läser `~/.zshrc` | | ogranskad | 2026-10-30 |
| Prompten i zsh sätts med `PROMPT` och `%`-koderna `%n`, `%m`, `%~`, `%1~`, `%#`, `%F{färg}` … `%f` | | ogranskad | 2026-10-30 |
| Oh My Zsh är en samling teman och tillägg som installeras med ett skript från projektets webbplats och ställs in i `~/.zshrc` | | ogranskad | 2026-10-30 |
| `exit` lämnar zsh; variabler, alias och katalogbyten från zsh försvinner | | ogranskad | 2026-10-30 |
| fish har färger, tabbkomplettering och *autosuggestions* som accepteras med högerpil | | ogranskad | 2026-10-30 |
| fish-prompten blir `elev@ubuntu ~>` och förkortar alla kataloger utom den sista till en bokstav (`~/d/projekt>`) | | ogranskad | 2026-10-30 |
| fish-syntaxen i tabellen (`set`, `set -x`, `set -e`, `(pwd)`, `$status`, `$argv`, `if …; end`, `for …; end`, `function`, `math`) | | ogranskad | 2026-10-30 |
| fish svarar `fish: Unsupported use of '='. In fish, please use 'set frukt äpple'.` på `frukt=äpple` | | ogranskad | 2026-10-30 |
| Alla variabler i fish är listor numrerade från 1; `count` räknar elementen (kontrollfråga 3) | | ogranskad | 2026-10-30 |
| Inom citattecken är parenteser vanlig text i fish | | ogranskad | 2026-10-30 |
| fish har `and`, `or` och `not`; från 3.0 förstår fish `&&` och `\|\|`, från 3.4 `$(...)`; `X=1`, `$?` och `$((...))` ger fortfarande fel | | ogranskad | 2026-10-30 |
| Alla block i fish avslutas med `end`; funktioner får argumenten i `$argv` | | ogranskad | 2026-10-30 |
| `math` klarar decimaler; `x` eller citerat `"17 * 23"` för multiplikation, ensamt `*` är ett jokertecken | | ogranskad | 2026-10-30 |
| fish läser `~/.config/fish/config.fish`; `fish_greeting` styr välkomsthälsningen; `set -U` gör en universell variabel som sparas i `~/.config/fish/fish_variables` | | ogranskad | 2026-10-30 |
| bash finns på praktiskt taget alla Linuxsystem, zsh och fish gör det inte | | ogranskad | 2026-10-30 |
| `#!`-raden avgör vilket skal som kör skriptet, oavsett vilket skal man sitter i (kontrollfråga 4) | | ogranskad | 2026-10-30 |
| Skript som måste fungera överallt skrivs med `#!/bin/sh` och bara POSIX-syntax | | ogranskad | 2026-10-30 |
| `chsh -s` byter inloggningsskal; skalet anges med full sökväg och måste stå i `/etc/shells`; `chsh` frågar efter lösenordet | | ogranskad | 2026-10-30 |
| Ändringen gäller från nästa inloggning; `$SHELL` i öppen terminal ändras inte (kontrollfråga 5) | | ogranskad | 2026-10-30 |
| root kan byta skal åt andra: `sudo chsh -s /usr/bin/fish kim` | | ogranskad | 2026-10-30 |
| Vanligt råd: behåll bash som inloggningsskal och låt terminalprogrammet starta fish | | ogranskad | 2026-10-30 |
