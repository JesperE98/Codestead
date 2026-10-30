# Sammanfattning: Grunderna

Du har lärt dig kommandona som du kommer att använda varje dag, i alla
distributioner. Här är en snabb repetition inför provet.

## Navigera i filsystemet

Allt finns i ett enda träd som börjar i roten, `/`. Inställningar finns i
`/etc`, program i `/usr/bin`, loggar i `/var/log` och dina egna filer i din
hemkatalog, `~`. `pwd` visar var du står, `ls` listar vad som finns och `cd`
flyttar dig. En **absolut** sökväg börjar med `/`; en **relativ** sökväg utgår
från katalogen du står i. `..` är katalogen ovanför, och `cd` utan argument
tar dig hem.

## Filer och kataloger

`mkdir` skapar kataloger (`-p` skapar flera nivåer på en gång) och `touch`
skapar tomma filer. `cp` kopierar (`-r` för hela kataloger), `mv` både flyttar
och byter namn, och `rm` tar bort – på riktigt, det finns ingen papperskorg.
`rmdir` tar bara bort tomma kataloger; `rm -r` tar bort en katalog och allt i
den. Jokertecken som `*`, `?` och `[abc]` expanderas av skalet innan
kommandot körs, och namn med mellanslag behöver citattecken.

## Läsa och söka i text

`cat` skriver ut en fil och med `less` kan du bläddra i den. `head` och
`tail` visar början och slutet (`-n` väljer hur många rader, `tail -f` följer
en fil). `wc` räknar rader, ord och byte. `grep` visar raderna som matchar ett
mönster, `sort` sorterar rader och `uniq` tar bort upprepade rader som ligger
intill varandra. `man` visar manualen för ett kommando.

## Omdirigering och pipes

Varje program har tre strömmar: stdin, stdout och stderr. `>` skickar stdout
till en fil (och skriver över den), `>>` lägger till, `<` läser stdin från en
fil och `2>` omdirigerar felmeddelanden – till exempel till `/dev/null`. En
pipe `|` skickar utdata från ett kommando in i nästa, och `tee` sparar en
kopia på vägen. `;`, `&&` och `||` kör flera kommandon på en rad.

## Textbearbetning med sed, tr och awk

`tr` byter, tar bort (`-d`) eller pressar ihop (`-s`) enskilda tecken och
läser bara från stdin. `sed` redigerar rader: `s/gammalt/nytt/` byter ut (`g`
för alla träffar), adresser väljer rader, `d` tar bort och `-n` med `p` skriver
bara ut det du ber om. `sed -i` ändrar själva filen. `cut` plockar ut ett
fält, och `awk` arbetar med kolumner: `-F` väljer avgränsare, `$1` … `$NF` är
fälten, ett mönster före `{ }` väljer rader och `END { }` körs efter sista
raden.

## Kommandon och flaggor

| Kommando | Vad det gör | Flaggor och syntax från den här delen |
|---|---|---|
| `pwd` | Visar katalogen du står i | |
| `ls` | Listar innehållet i en katalog | `-l` långt format, `-a` även dolda filer |
| `cd` | Byter katalog | `..` upp, `~` hem, `-` senaste katalogen, inget argument = hem |
| `mkdir` | Skapar en katalog | `-p` flera nivåer på en gång |
| `touch` | Skapar en tom fil | |
| `cp` | Kopierar | `-r` hela kataloger |
| `mv` | Flyttar eller byter namn | |
| `rm` | Tar bort | `-r` kataloger med innehåll, `-f` inga frågor |
| `rmdir` | Tar bort en tom katalog | |
| `cat` | Skriver ut en fil | |
| `less` | Visar en fil sida för sida | `/ord` söker, `q` avslutar |
| `head` / `tail` | De första / sista raderna | `-n N` antal rader, `tail -f` följer |
| `wc` | Räknar rader, ord och byte | `-l` bara rader |
| `grep` | Visar matchande rader | `-i`, `-n`, `-v`, `-c`, `-r`, `-E` |
| `sort` | Sorterar rader | `-n` tal, `-r` omvänd ordning |
| `uniq` | Tar bort upprepade rader som ligger intill varandra | `-c` räknar dem |
| `man` | Visar manualsidan | |
| `tee` | Skickar indata vidare och sparar en kopia | |
| `tr` | Byter tecken | `-d` ta bort, `-s` pressa ihop |
| `sed` | Redigerar en ström av rader | `s/…/…/g`, `d`, `p`, `q`, `-n`, `-i`, `-E`, `-e` |
| `cut` | Plockar ut fält | `-d` avgränsare, `-f` fält |
| `awk` | Arbetar med kolumner | `-F` avgränsare, `$1`, `$NF`, `NF`, `NR`, `BEGIN`, `END` |

| Syntax | Betyder |
|---|---|
| `>` / `>>` | stdout till en fil (skriv över / lägg till) |
| `<` | stdin från en fil |
| `2>` | stderr till en fil, t.ex. `2> /dev/null` |
| `2>&1` | stderr samma väg som stdout |
| `\|` | Pipe: stdout från ett kommando in som stdin i nästa |
| `a ; b` | Kör a, sedan b |
| `a && b` | Kör b bara om a lyckades |
| `a \|\| b` | Kör b bara om a misslyckades |
| `*`, `?`, `[abc]` | Jokertecken för filnamn |
