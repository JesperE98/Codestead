# Omdirigering och pipes

Det här kapitlet handlar om det som gör kommandoraden så kraftfull: att
*koppla ihop* små program.

## Tre strömmar

Varje program har tre standardströmmar:

| Nummer | Namn | Vad |
|---|---|---|
| 0 | stdin | Indata, normalt från tangentbordet |
| 1 | stdout | Vanlig utdata, normalt till skärmen |
| 2 | stderr | Felmeddelanden, också till skärmen |

Med *omdirigering* och *pipes* kan du skicka strömmarna någon annanstans.

## Till en fil – `>` och `>>`

`>` skickar stdout till en fil i stället för skärmen. Filen skapas om den inte
finns – och **skrivs över** om den finns!

```sh
echo "första raden" > test.txt
```

`>>` lägger i stället till i slutet av filen:

```sh
echo "andra raden" >> test.txt
cat test.txt
```

```predict
$ echo one > t.txt
$ echo two > t.txt
$ cat t.txt
two
---
Det andra `>` skrev över filen. Med `>>` hade den innehållit båda raderna.
```

## Från en fil – `<`

`{{fruits}}` har tio rader, en frukt per rad. Ger du `wc -l` ett filnamn skriver
det ut antalet rader följt av namnet – här för `{{grades}}`, som har nio rader:

```sh
wc -l {{documents}}/{{grades}}
```

```text
9 {{documents}}/{{grades}}
```

`<` låter ett program läsa stdin från en fil:

```sh
wc -l < {{documents}}/{{fruits}}
```

Nu ser `wc` aldrig filnamnet – det får bara texten på stdin – så det skriver
bara ut antalet.

```predict
$ wc -l {{documents}}/{{fruits}}
$ wc -l < {{documents}}/{{fruits}}
10 {{documents}}/{{fruits}}
10
---
Med ett filnamn som argument skriver `wc` ut namnet också. Med `<` får det
bara texten.
```

## Felmeddelanden – `2>`

Felmeddelanden går till stderr och påverkas inte av `>`. Vill du ta hand om
dem skriver du strömmens nummer framför:

```sh
ls /{{missing}} 2> fel.txt
```

```quiz
Du kör `ls /{{missing}} > fel.txt`. Var hamnar felmeddelandet?
- [ ] I `fel.txt`
- [x] På skärmen – `fel.txt` förblir tom
- [ ] Ingenstans, det försvinner
---
`>` omdirigerar bara stdout (ström 1). Felmeddelandet går till stderr
(ström 2), som fortfarande går till skärmen. Du hade behövt `2>`.
```

Filen `/dev/null` är ett "svart hål" – allt som skrivs dit försvinner. Det är
praktiskt för att tysta fel. Med `2>&1` skickas stderr samma väg som stdout.

## Pipes – `|`

En **pipe** skickar stdout från ett kommando direkt in som stdin i nästa.
Det här är kärnan i Unix-filosofin: *gör en sak och gör den bra, och låt
programmen samarbeta*.

```sh
grep INFO {{documents}}/server.log | wc -l
```

`grep` hittar raderna, `wc -l` räknar dem. Du kan koppla ihop hur många som
helst:

```sh
sort {{documents}}/{{fruits}} | uniq -c | sort -rn
```

Läs det steg för steg: sortera frukterna, räkna hur många av varje (`uniq -c`)
och sortera sedan numeriskt med flest först (`sort -rn`).

Hur många filer och kataloger finns det i `/etc`? Räkna dem med en pipe:

```try
ls /etc | wc -l
```

## Byta tecken – `tr`

`tr` (*translate*) byter varje tecken i den första mängden mot tecknet på samma
plats i den andra. `a-z` betyder alla bokstäver från a till z:

```sh
echo "hej från terminalen" | tr a-z A-Z
```

```text
HEJ FRåN TERMINALEN
```

Ser du å:et? `tr` arbetar med enskilda *byte*, och å, ä och ö ingår inte i
`a-z`.

`tr` läser **bara** från stdin, aldrig från filer. Vill du använda en fil
skickar du in den med `<` eller en pipe:

```sh
tr a-z A-Z < ~/{{documents}}/{{fruits}}
```

Med `-d` (*delete*) tar du bort tecken och med `-s` (*squeeze*) pressar du
ihop flera likadana tecken i rad till ett:

```sh
echo "070-123 45 67" | tr -d ' -'
echo "för     många      mellanslag" | tr -s ' '
```

```predict
$ echo "hello world" | tr -d o
hell wrld
---
`-d` tar bort varje `o`, var det än står.
```

I stället för intervall kan du skriva *klasser*, t.ex. `[:upper:]` (versaler),
`[:lower:]` (gemener), `[:digit:]` (siffror) och `[:space:]` (blanktecken):

```sh
echo "Rum 101, våning 3" | tr -d '[:digit:]'
```

## Från indata till argument – `xargs`

Vissa kommandon läser inte från en pipe alls – de vill ha namn som
**argument**: `rm`, `mkdir`, `touch`, och `wc` när den ska räkna i filer.
`xargs` överbryggar det: den läser orden i sin indata och sätter dem efter ett
kommando.

```sh
find {{documents}} -type f | xargs wc -l
```

Det är samma sak som att själv skriva alla filnamn efter `wc -l`. Med `-n 1`
kör `xargs` kommandot en gång för varje ord, och med `-I {}` en gång för varje
rad, där `{}` byts mot raden:

```sh
ls {{documents}} | xargs -I {} echo "Fil: {}"
```

```predict
$ printf 'a\nb\nc\n' | xargs echo
a b c
---
`xargs` samlade ihop de tre raderna och körde `echo a b c` – en gång.
```

## Både skärm och fil – `tee`

`tee` skickar indata vidare *och* sparar en kopia i en fil:

```sh
ls /etc | tee etc-lista.txt | wc -l
```

## Kedjor – `;`, `&&` och `||`

Flera kommandon kan stå på samma rad:

| Skrivsätt | Betyder |
|---|---|
| `a ; b` | Kör a, sedan b |
| `a && b` | Kör b bara om a lyckades |
| `a \|\| b` | Kör b bara om a misslyckades |

```sh
mkdir -p ny && cd ny
```

```predict
$ mkdir {{documents}} 2> /dev/null && echo created || echo failed
failed
---
`{{documents}}` finns redan, så `mkdir` misslyckas (felmeddelandet försvinner i
`/dev/null`). `echo created` hoppas över och `echo failed` körs.
```
