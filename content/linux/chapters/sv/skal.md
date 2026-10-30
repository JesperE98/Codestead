# Andra skal: zsh och fish

Hittills har du skrivit alla kommandon i **bash**. Men bash är bara ett av
flera skal – och många föredrar något annat. I det här kapitlet installerar
du två populära alternativ, **zsh** och **fish**, provar dem och ser vad som
skiljer dem från bash. Du får också veta varför skript ändå nästan alltid
skrivs för bash.

## Vad är ett skal, nu igen?

**Skalet** (*shell*) är programmet som läser det du skriver, tolkar det och
startar andra program. Det är skalet som förstår `|`, `>`, `$VARIABLER`,
jokertecken som `*.txt` och loopar. Terminalen är bara fönstret som skalet
körs i.

Program som `ls`, `grep` och `cat` är egna program i `/usr/bin` – de fungerar
likadant vilket skal du än använder. Det som skiljer skalen åt är **språket
runt omkring**: hur variabler sätts, hur loopar och villkor skrivs, hur
prompten ser ut och vilka bekvämligheter som finns.

```quiz
Du byter från bash till ett annat skal. Vilket av de här förblir exakt likadant?
- [ ] Hur du sätter en variabel
- [ ] Hur du skriver en loop
- [x] Vad `grep` gör med sina flaggor
- [ ] Hur prompten ser ut
---
`grep` är ett eget program i `/usr/bin`. Skalet startar det bara – det är
språket runt omkring som skiljer sig mellan skalen.
```

## Släktträdet: sh, bash, zsh och fish

| Skal | Kom | Kännetecken |
|---|---|---|
| `sh` | 1979 | Bourne-skalet. Dagens `sh` följer standarden **POSIX** och är minsta gemensamma nämnare. |
| `bash` | 1989 | *Bourne Again SHell*. Standard i nästan alla Linux-distributioner. |
| `zsh` | 1990 | I stort sett bash-kompatibelt, men med fler finesser. Standard i macOS. |
| `fish` | 2005 | *Friendly interactive shell*. Lätt att använda, men med **egen syntax**. |

**POSIX** är en standard som beskriver hur ett `sh`-skal ska fungera. Ett
skript som bara använder POSIX-saker fungerar i alla `sh`-kompatibla skal:
bash, zsh, `dash` (som är `/bin/sh` i Debian och Ubuntu) och `ash` (i små
system som Alpine). fish är medvetet **inte** POSIX-kompatibelt – det är det
som gör det enklare, men också annorlunda.

## Vilka skal finns installerade?

Filen `/etc/shells` listar skalen som får användas som inloggningsskal:

```sh
cat /etc/shells
```

Vilket skal du får när du loggar in står i sista fältet på din rad i
`/etc/passwd`, och finns också i variabeln `$SHELL`:

```sh
grep elev /etc/passwd
echo $SHELL
```

## zsh – bash med extra allt

### Installera zsh

I Ubuntu-terminalen installerar du zsh med apt:

```sh
sudo apt update
sudo apt install zsh
```

Andra distributioner använder sin egen pakethanterare, som du lärde dig i
delen om distributioner och paket. Paketet heter `zsh` där också.

Titta i `/etc/shells` igen – paketet har lagt till `/usr/bin/zsh` (och
`/bin/zsh`):

```sh
cat /etc/shells
```

### Starta zsh

Ett skal är ett program som alla andra, så du startar zsh genom att skriva
dess namn:

```sh
zsh
```

Första gången möts du av **zsh-newuser-install**, eftersom du inte har någon
konfigurationsfil för zsh ännu. Det är en meny som hjälper dig komma igång:

| Tangent | Gör |
|---|---|
| `q` | Avsluta utan att göra något (frågan kommer igen nästa gång) |
| `0` | Skapa en nästan tom `~/.zshrc` |
| `1` | Huvudmenyn med alla inställningar (finns inte i simulatorn) |
| `2` | Skapa `~/.zshrc` med rekommenderade inställningar |

Svara `2`. Prompten ändras till `elev@ubuntu ~ %` – i zsh är `%`
det vanliga tecknet för en vanlig användare (root får `#`, precis som i bash).

Vilket skal kör du nu? Variabeln `$0` innehåller namnet på skalet:

```sh
echo $0
ps
```

`ps` visar att zsh körs **inuti** bash: bash startade zsh som en ny process.
Lägg också märke till att `$SHELL` fortfarande är `/bin/bash` – den variabeln
talar om ditt *inloggningsskal*, inte vilket skal du råkar köra just nu.

```sh
echo $SHELL
```

### Det mesta är som i bash

zsh förstår nästan all bash-syntax. Pipes, omdirigering, variabler, `if`,
`for` och funktioner fungerar som du är van vid:

```sh
for f in ~/dokument/*.txt; do wc -l $f; done
```

### Finess 1: `**` letar i alla underkataloger

I zsh betyder `**/` "alla kataloger, på alla nivåer". Så här listar du alla
`.txt`-filer i hemkatalogen och allt under den:

```sh
ls ~/**/*.txt
```

I bash fungerar `**` bara som en vanlig `*` – om du inte först slår på det med
`shopt -s globstar`.

### Finess 2: autocd

Med inställningen `autocd` (som finns i de rekommenderade inställningarna)
räcker det att skriva namnet på en katalog för att gå dit – utan `cd`:

```sh
dokument
..
```

Inställningar slås på och av med `setopt` och `unsetopt`:

```sh
setopt
unsetopt autocd
setopt autocd
```

### En skillnad att se upp med: variabler delas inte upp

I bash delas en ociterad variabel upp vid mellanslag. Det gör den inte i zsh:

```sh
filer="a.txt b.txt"
for f in $filer; do echo "[$f]"; done
```

bash skriver ut `[a.txt]` och `[b.txt]` – zsh skriver ut `[a.txt b.txt]`.
zsh:s sätt är oftast det man vill, men det betyder att ett bash-skript inte
alltid gör samma sak i zsh. (Med `setopt shwordsplit` beter sig zsh som bash.)

Du behöver inte starta ett skal för att prova ett enda kommando i det. Med
`-c` kör skalet kommandot och avslutas direkt – `zsh -c 'echo $0'` skriver ut
`zsh`, och du är fortfarande i bash efteråt.

Frågan nedan börjar i en ny terminal, så den installerar först zsh.
`> /dev/null 2>&1` slänger utskriften från den raden. Vad skriver det sista
kommandot ut?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y zsh > /dev/null 2>&1
$ zsh -c 'filer="x.txt y.txt z.txt"; for f in $filer; do echo "<$f>"; done'
<x.txt y.txt z.txt>
---
zsh delar inte upp variabeln vid mellanslag, så loopen körs en gång med hela
värdet. I bash skulle samma loop skriva ut tre rader: `<x.txt>`, `<y.txt>`
och `<z.txt>`.
```

### ~/.zshrc och prompten

bash läser `~/.bashrc` när det startar – zsh läser `~/.zshrc`. Titta i filen
som zsh-newuser-install skapade:

```sh
cat ~/.zshrc
```

Prompten bestäms av variabeln `PROMPT` och använder `%`-koder:

| Kod | Betyder |
|---|---|
| `%n` | Användarnamnet |
| `%m` | Datorns namn |
| `%~` | Hela katalogen (med `~` för hemkatalogen) |
| `%1~` | Bara sista delen av katalogen |
| `%#` | `%` för vanliga användare, `#` för root |
| `%F{green}` … `%f` | Färg (red, green, blue, yellow …) |

Prova:

```sh
PROMPT='%F{green}%n%f:%~ %# '
```

Ändringen gäller bara tills du lämnar zsh. Vill du ha den varje gång lägger
du raden i `~/.zshrc`.

### Oh My Zsh

Många zsh-användare installerar **Oh My Zsh**, en samling teman och
insticksprogram (*plugins*) – t.ex. för Git-information i prompten, bättre
tab-komplettering och förslag medan du skriver. Det installeras med ett skript
från projektets webbplats och styrs från `~/.zshrc`. Det finns inte i
simulatorn, men nu vet du vad folk menar när de pratar om det.

### Tillbaka till bash

zsh är en process som körs inuti bash. Avsluta den med `exit`, så är du
tillbaka i bash – där variabler, alias och katalogbyten från zsh inte finns
kvar:

```sh
exit
echo $0
```

## fish – the friendly interactive shell

fish vill vara lätt att använda direkt, utan konfiguration: färger,
tab-komplettering och **autosuggestions** – fish föreslår resten av kommandot
i grå text, baserat på din historik, och du tar förslaget med högerpil. (I
simulatorn syns inga förslag, men syntaxen fungerar.)

### Installera och starta fish

fish installeras med apt på samma sätt – i andra distributioner med deras
egen pakethanterare:

```sh
sudo apt update
sudo apt install fish
```

```sh
fish
```

fish hälsar dig välkommen och prompten blir `elev@ubuntu ~>`. Gå ner i
några kataloger och se hur fish förkortar sökvägen i prompten:

```sh
mkdir -p ~/dokument/projekt
cd ~/dokument/projekt
cd ~
```

I katalogen `~/dokument/projekt` visar prompten `~/d/projekt>` – varje
katalog utom den sista förkortas till en bokstav.

### fish har en egen syntax

Här skiljer sig fish mest från bash och zsh:

| Det här | bash och zsh | fish |
|---|---|---|
| Sätta en variabel | `frukt=äpple` | `set frukt äpple` |
| Miljövariabel | `export EDITOR=nano` | `set -x EDITOR nano` |
| Ta bort en variabel | `unset frukt` | `set -e frukt` |
| Kommandosubstitution | `$(pwd)` | `(pwd)` |
| Senaste felkoden | `$?` | `$status` |
| Skriptets argument | `$@`, `$1` | `$argv`, `$argv[1]` |
| Villkor | `if …; then …; fi` | `if …; …; end` |
| Loop | `for …; do …; done` | `for …; …; end` |
| Funktion | `hej() { …; }` | `function hej; …; end` |
| Räkna | `$((17 * 23))` | `math 17 x 23` |

### Variabler med set

Prova att sätta en variabel på bash-sättet:

```sh
frukt=äpple
```

fish vägrar och talar om hur det ska skrivas:

```text
fish: Unsupported use of '='. In fish, please use 'set frukt äpple'.
```

Så här gör man i fish:

```sh
set frukt äpple
echo $frukt
set -x EDITOR nano
set -e frukt
```

`-x` (*export*) gör variabeln till en miljövariabel som program du startar
kan se, och `-e` (*erase*) tar bort den.

I fish är alla variabler **listor**. Elementen numreras från 1:

```sh
set frukter äpple päron banan
echo $frukter[2]
count $frukter
```

`-c` fungerar i fish också. Vad skriver det sista kommandot ut?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'set frukter äpple päron banan; echo $frukter[3]'
banan
---
Elementen i en fish-lista numreras från 1, så `[3]` är det tredje och sista
elementet.
```

### Kommandosubstitution och $status

I fish skrivs kommandosubstitution med bara parenteser:

```sh
echo "Jag står i" (pwd)
```

Inom citattecken är parenteser vanlig text – därför står `(pwd)` utanför.
Felkoden från senaste kommandot heter `$status`:

```sh
false
echo $status
```

### and, or och not

fish har egna kommandon för att kedja ihop villkor:

```sh
test -f ~/.bashrc; and echo finns
test -f ~/saknas.txt; or echo saknas
```

Nyare versioner av fish (3.0 och senare) förstår också `&&` och `||`, och från
3.4 fungerar även `$(...)`. Men `X=1`, `$?` och `$((...))` fungerar fortfarande
inte – de ger fel som talar om fish-sättet.

### Block avslutas med end

I fish slutar alla block – `if`, `for`, `while`, `switch` och `function` – med
`end`. Det finns inget `then`, `do`, `done` eller `fi`:

```sh
for i in 1 2 3; echo $i; end
if test -f ~/.bashrc; echo finns; else; echo saknas; end
```

Du kan också skriva blocket på flera rader. Skalet väntar på `end` innan det
kör loopen:

```sh
for f in ~/dokument/*.txt
echo (basename $f)
end
```

Funktioner får sina argument i listan `$argv`:

```sh
function hej; echo "Hej $argv!"; end
hej Kim
```

### Räkna med math

fish har inget `$((...))`. I stället finns kommandot `math`, som också klarar
decimaltal:

```sh
math 17 x 23
math 10 / 4
```

Skriv `x` (eller `"17 * 23"` inom citattecken) för gånger – en ensam `*` är ett
jokertecken i fish, precis som i bash.

### Inställningar i fish

fish läser `~/.config/fish/config.fish` när det startar. Vill du slippa
välkomsttexten kan du tömma variabeln `fish_greeting`. Med `-U` blir
variabeln **universell**: den sparas i `~/.config/fish/fish_variables` och
gäller i alla fish-skal, även efter omstart.

```sh
cat ~/.config/fish/config.fish
set -U fish_greeting ""
```

Avsluta fish med `exit`:

```sh
exit
```

## Varför skript ändå skrivs för bash

Vilket skal du använder i terminalen är en smaksak. Men **skript** skrivs
nästan alltid för bash (eller för POSIX `sh`):

- bash finns installerat på i princip alla Linux-system – zsh och fish gör inte
  det.
- fish-syntaxen fungerar inte i bash, och tvärtom.
- Raden `#!` överst i skriptet bestämmer vilket skal som kör det – **oavsett**
  vilket skal du själv sitter i.

Prova att skriva ett bash-skript och köra det från fish:

```sh
cat > ~/hej.sh << 'SLUT'
#!/bin/bash
namn=Kim
echo "Hej $namn, jag körs av bash"
SLUT
chmod +x ~/hej.sh
fish
~/hej.sh
exit
```

Skriptet fungerar i fish, trots att `namn=Kim` är förbjudet där – för det är
bash som kör det. Därför är `#!/bin/bash` (eller `#!/usr/bin/env bash`) så
viktig. Ett skript som ska fungera överallt, även där bash saknas, skriver man
med `#!/bin/sh` och bara POSIX-syntax.

```quiz
Du sitter i fish och kör ett skript som börjar med `#!/bin/bash` och
innehåller raden `count=3`. Vad händer?
- [ ] fish vägrar, eftersom `count=3` inte är tillåtet i fish
- [x] Det fungerar – bash kör skriptet, vilket skal du än sitter i
- [ ] Det fungerar bara om du först byter inloggningsskal till bash med `chsh`
---
Raden `#!` bestämmer vilket skal som kör skriptet. fish startar det bara.
```

## Byta standardskal med chsh

Att skriva `zsh` varje gång du öppnar en terminal blir tjatigt. Med `chsh`
(*change shell*) byter du ditt **inloggningsskal** – det som står i
`/etc/passwd`:

```sh
chsh -s /usr/bin/zsh
grep elev /etc/passwd
```

- Skalet måste anges med hela sökvägen och finnas med i `/etc/shells`.
- `chsh` frågar efter ditt lösenord (simulatorn hoppar över det).
- Ändringen gäller från **nästa inloggning**. Terminalen du har öppen fortsätter
  med sitt gamla skal, och `$SHELL` ändras först när du loggat in igen.
- root kan byta skal åt andra: `sudo chsh -s /usr/bin/fish kim`.

Vill du tillbaka till bash gör du likadant:

```sh
chsh -s /bin/bash
```

Ett vanligt råd för fish är att behålla bash som inloggningsskal och i stället
låta terminalprogrammet starta fish – då fungerar allt som förväntar sig ett
POSIX-skal vid inloggningen som vanligt.

Frågan börjar i en ny terminal, installerar zsh och gör det till
inloggningsskal. Vad skriver det sista kommandot ut?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y zsh > /dev/null 2>&1
$ chsh -s /usr/bin/zsh > /dev/null 2>&1
$ echo $SHELL
/bin/bash
---
`chsh` ändrade din rad i `/etc/passwd`, men ändringen gäller från nästa
inloggning. Terminalen du har öppen behåller bash, och det gör `$SHELL` också.
```

## Vilket skal ska man välja?

- **bash** – standard överallt. Det du lär dig här fungerar på alla servrar
  du någonsin loggar in på. Skriv dina skript för bash.
- **zsh** – för dig som vill ha mer bekvämlighet men behålla bash-syntaxen.
  Med Oh My Zsh får du teman och plugins.
- **fish** – den bästa upplevelsen direkt ur lådan, men med annan syntax.
  Kommandon du kopierar från webben fungerar inte alltid.
- **sh/dash** – för skript som måste fungera överallt, och i små system.

## Sammanfattning

| Kommando | Gör |
|---|---|
| `cat /etc/shells` | Lista skalen som får användas |
| `echo $0` / `ps` | Se vilket skal du kör just nu |
| `echo $SHELL` | Se ditt inloggningsskal |
| `zsh` / `fish` / `exit` | Starta ett annat skal / gå tillbaka |
| `ls ~/**/*.txt` | Leta i alla underkataloger (zsh, fish) |
| `setopt autocd` | Slå på en zsh-inställning |
| `set frukt äpple` | Sätt en variabel i fish |
| `set -x NAMN värde` | Sätt en miljövariabel i fish |
| `chsh -s /usr/bin/zsh` | Byt inloggningsskal |

Konfigurationsfilerna: `~/.bashrc` (bash), `~/.zshrc` (zsh) och
`~/.config/fish/config.fish` (fish).
