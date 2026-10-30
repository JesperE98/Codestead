# Läsa och söka i text

Det mesta i Linux är text: inställningar, loggar, listor. Därför finns många
små verktyg för att läsa och söka i textfiler. I din hemkatalog finns
katalogen `dokument` med två filer att öva på: `frukter.txt` och `server.log`.

## Visa en fil – `cat` och `less`

`cat` skriver ut hela filen:

```sh
cat dokument/frukter.txt
```

För långa filer är `less` bättre. Där bläddrar du med piltangenterna och
mellanslag, söker med `/ord` och avslutar med `q`.

## Början och slutet – `head` och `tail`

`head` visar de första raderna och `tail` de sista. Standard är 10 rader, men
med `-n` väljer du själv:

```sh
head -n 5 dokument/server.log
tail -n 3 dokument/server.log
```

`tail -f` *följer* en fil och visar nya rader när de skrivs – perfekt för
loggar. Avsluta med **Ctrl+C**.

## Räkna – `wc`

`wc` (*word count*) räknar rader, ord och byte:

```sh
wc dokument/frukter.txt
```

Ofta vill man bara ha antalet rader: `wc -l`.

## Söka – `grep`

`grep` är ett av de mest användbara kommandona som finns. Det visar alla rader
som innehåller ett mönster:

```sh
grep INFO dokument/server.log
```

Några flaggor du kommer att använda ofta:

| Flagga | Betydelse |
|---|---|
| `-i` | Ignorera skillnad på stora och små bokstäver |
| `-n` | Visa radnummer |
| `-v` | Visa rader som *inte* matchar |
| `-c` | Räkna matchande rader |
| `-r` | Sök rekursivt i alla filer i en katalog |
| `-E` | Utökade mönster, t.ex. `"ERROR|WARN"` |

```sh
grep -n WARN dokument/server.log
```

Mönstret är ett *reguljärt uttryck*. Ett par exempel: `^` betyder radens
början och `$` radens slut, så `grep "^2026"` hittar rader som börjar med 2026.

## Sortera – `sort` och `uniq`

`sort` sorterar rader i bokstavsordning (`-n` för siffror, `-r` för omvänd
ordning). `uniq` tar bort rader som är likadana som raden *direkt ovanför* –
därför används den nästan alltid efter `sort`:

```sh
sort dokument/frukter.txt
```

## Manualen – `man`

Glömt vad en flagga gör? Varje kommando har en manualsida:

```sh
man grep
```
