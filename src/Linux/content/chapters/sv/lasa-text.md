# Läsa och söka i text

Det mesta i Linux är text: inställningar, loggar, listor. Därför finns många
små verktyg för att läsa och söka i textfiler. I din hemkatalog finns
katalogen `{{documents}}` med filer att öva på, bland annat `{{fruits}}` (en lista
med frukter) och `server.log` (en logg från en påhittad webbserver).

## Visa en fil – `cat` och `less`

`cat` skriver ut hela filen:

```sh
cat {{documents}}/{{fruits}}
```

För långa filer är `less` bättre. Där bläddrar du med piltangenterna och
mellanslag, söker med `/ord` och avslutar med `q`.

Titta på fruktlistan – du behöver den till nästa fråga:

```try
cat {{documents}}/{{fruits}}
```

## Början och slutet – `head` och `tail`

`head` visar de första raderna och `tail` de sista. Standard är 10 rader, men
med `-n` väljer du själv:

```sh
head -n 5 {{documents}}/server.log
tail -n 3 {{documents}}/server.log
```

`tail -f` *följer* en fil och visar nya rader när de skrivs – perfekt för
loggar. Avsluta med **Ctrl+C**.

```predict
$ tail -n 1 {{documents}}/{{fruits}}
mango
---
`tail -n 1` visar bara den allra sista raden.
```

## Räkna – `wc`

`wc` (*word count*) räknar rader, ord och byte:

```sh
wc {{documents}}/{{fruits}}
```

Ofta vill man bara ha antalet rader: `wc -l`.

## Söka – `grep`

`grep` är ett av de mest användbara kommandona som finns. Det visar alla rader
som innehåller ett mönster:

```sh
grep INFO {{documents}}/server.log
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
grep -n WARN {{documents}}/server.log
```

Mönstret är ett *reguljärt uttryck*. Ett par exempel: `^` betyder radens
början och `$` radens slut, så `grep "^2026"` hittar rader som börjar med 2026.

```quiz
`server.log` har två rader med `WARN` och en rad med `warn` i små bokstäver.
Vad skriver `grep -c WARN {{documents}}/server.log` ut?
- [ ] 1
- [x] 2
- [ ] 3
---
`-c` räknar matchande rader, och utan `-i` är stora och små bokstäver olika.
`grep -ic WARN` skulle räkna alla tre.
```

```quiz
Vilket kommando visar alla rader i `server.log` som **inte** innehåller `INFO`?
- [ ] `grep -i INFO {{documents}}/server.log`
- [ ] `grep -c INFO {{documents}}/server.log`
- [x] `grep -v INFO {{documents}}/server.log`
```

## Sortera – `sort` och `uniq`

`sort` sorterar rader i bokstavsordning (`-n` för siffror, `-r` för omvänd
ordning). `uniq` tar bort rader som är likadana som raden *direkt ovanför* –
därför används den nästan alltid efter `sort`:

```sh
sort {{documents}}/{{fruits}}
```

```quiz
Varför används `uniq` nästan alltid efter `sort`?
- [ ] `uniq` fungerar bara på sorterade filer och misslyckas annars
- [x] `uniq` tar bara bort rader som är likadana som raden direkt ovanför, så likadana rader måste ligga intill varandra
- [ ] `sort` tar bort dubbletter och `uniq` lägger tillbaka dem
```

## Klippa ut fält – `cut`

I `{{documents}}` finns en tredje övningsfil, en CSV-fil med elevernas poäng:

```sh
cat ~/{{documents}}/{{grades}}
```

CSV betyder *comma-separated values* – kolumnerna skiljs åt av kommatecken,
och första raden är en rubrikrad.

När en fil består av fält med en avgränsare emellan kan `cut` plocka ut ett
fält. `-d` väljer avgränsaren (*delimiter*) och `-f` vilket fält som ska
behållas. Här är ämnena – fält 2 – i CSV-filen:

```sh
cut -d, -f2 ~/{{documents}}/{{grades}}
```

I `/etc/passwd` skiljs fälten åt av kolon och fält 1 är användarnamnet, så
`cut -d: -f1 /etc/passwd` listar alla användare.

## Manualen – `man`

Glömt vad en flagga gör? Varje kommando har en manualsida:

```sh
man grep
```
