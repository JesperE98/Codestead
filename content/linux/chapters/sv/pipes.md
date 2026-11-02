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
