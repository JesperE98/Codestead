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

## Från en fil – `<`

`<` låter ett program läsa stdin från en fil:

```sh
wc -l < dokument/frukter.txt
```

## Felmeddelanden – `2>`

Felmeddelanden går till stderr och påverkas inte av `>`. Vill du ta hand om
dem skriver du strömmens nummer framför:

```sh
ls /finnsinte 2> fel.txt
```

Filen `/dev/null` är ett "svart hål" – allt som skrivs dit försvinner. Det är
praktiskt för att tysta fel. Med `2>&1` skickas stderr samma väg som stdout.

## Pipes – `|`

En **pipe** skickar stdout från ett kommando direkt in som stdin i nästa.
Det här är kärnan i Unix-filosofin: *gör en sak och gör den bra, och låt
programmen samarbeta*.

```sh
grep INFO dokument/server.log | wc -l
```

`grep` hittar raderna, `wc -l` räknar dem. Du kan koppla ihop hur många som
helst:

```sh
sort dokument/frukter.txt | uniq -c | sort -rn
```

Läs det steg för steg: sortera frukterna, räkna hur många av varje (`uniq -c`)
och sortera sedan numeriskt med flest först (`sort -rn`).

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
