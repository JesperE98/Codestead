# Shell-skript

Allt du skrivit i terminalen hittills kan du också spara i en fil och köra
igen och igen. En sådan fil kallas ett **skript**. Med skript automatiserar
du det tråkiga: säkerhetskopior, att döpa om hundra filer eller att kolla
loggar varje morgon. Bash är dessutom ett riktigt programspråk, med
variabler, villkor, loopar och funktioner.

## Ett första skript

Ett skript är en vanlig textfil. På riktiga datorer skriver man den i en
texteditor som `nano` eller `vim`. Ett annat sätt, som fungerar både här och
på servrar, är ett **here-dokument**: allt mellan `<< 'SLUT'` och raden
`SLUT` skickas in till kommandot.

Skriv första raden och tryck Enter. Prompten ändras till `> ` – skalet väntar
på resten. Skriv raderna en i taget och avsluta med `SLUT`:

```sh
cat > hej.sh << 'SLUT'
#!/bin/bash
echo "Hej från ett skript!"
echo "Idag är det $(date)"
SLUT
```

Första raden, `#!/bin/bash`, kallas *shebang* och talar om vilket program som
ska köra filen. Gör skriptet körbart och kör det:

```sh
chmod +x hej.sh
./hej.sh
```

Rader som börjar med `#` (förutom shebang-raden) är **kommentarer** som skalet
hoppar över. Använd dem för att förklara vad koden gör!

## Variabler

Du skapar en variabel med `namn=värde`. Det får **inte** finnas mellanslag
runt likhetstecknet – då tror skalet att `namn` är ett kommando.

```sh
stad=Göteborg
echo "Jag bor i $stad"
```

Sätt alltid variabler inom **dubbla citattecken** när du använder dem. Utan
citattecken delas värdet upp vid mellanslag, vilket ger konstiga fel när ett
filnamn innehåller mellanslag. Vill du skriva text direkt efter
variabelnamnet använder du klammerparenteser: `"${stad}s hamn"`.

## Kommandosubstitution – `$(...)`

`$(kommando)` byts ut mot det kommandot skriver ut. Så sparar du resultatet
av ett kommando i en variabel:

```sh
idag=$(date)
filer=$(ls ~ | wc -l)
echo "Det finns $filer saker i din hemkatalog"
```

## Räkna – `$(( ))`

Bash räknar med heltal inom `$(( ))`. Inne i parenteserna behövs inget `$`
framför variablerna:

```sh
a=7
echo $(( a * 6 ))
echo $(( 17 / 5 )) och resten $(( 17 % 5 ))
```

Vill du ändra en variabel skriver du `(( a++ ))` eller `(( a += 10 ))`.

## Argument

När du kör `./skript.sh ett två` kan skriptet läsa argumenten:

| Variabel | Innehåll |
|---|---|
| `$0` | Skriptets namn |
| `$1`, `$2` ... | Första, andra ... argumentet |
| `$#` | Antal argument |
| `"$@"` | Alla argument, vart och ett för sig |
| `$?` | Slutkoden från förra kommandot |

## Villkor – `if`

`if` kör ett kommando och tittar på dess **slutkod**: 0 betyder sant, allt
annat falskt. Oftast använder man kommandot `[` (som också heter `test`):

```sh
if [ -f ~/.bashrc ]; then echo "Filen finns"; else echo "Filen saknas"; fi
```

Mellanslagen innanför `[ ]` är obligatoriska! Skrivet över flera rader, som i
ett skript, ser det ut så här:

```text
if [ "$svar" = "ja" ]; then
    echo "Toppen!"
elif [ "$svar" = "nej" ]; then
    echo "Synd."
else
    echo "Svara ja eller nej."
fi
```

De vanligaste testen:

| Test | Sant om |
|---|---|
| `-f FIL` | filen finns (och är en vanlig fil) |
| `-d KAT` | katalogen finns |
| `-z "$x"` | variabeln är tom |
| `"$a" = "$b"` | texterna är lika (`!=` olika) |
| `$a -eq $b` | talen är lika |
| `$a -lt $b` | mindre än (`-le`, `-gt`, `-ge`, `-ne`) |
| `! VILLKOR` | villkoret är *inte* sant |

Lägg märke till att tal jämförs med `-eq`, `-lt` och så vidare, medan `=` och
`<` jämför text. Bash har också `[[ ... ]]`, som är lite smartare: där kan du
skriva `&&` och `||` och jämföra mot mönster som `[[ $fil == *.txt ]]`.

För korta villkor räcker ofta `&&` och `||`:

```sh
[ -d ~/bilder ] && echo "Bildkatalogen finns"
```

## Loopar

En **for-loop** gör samma sak för varje sak i en lista:

```sh
for frukt in äpple banan kiwi; do echo "Jag gillar $frukt"; done
```

Listan kan komma från jokertecken eller ett kommando:

```sh
for fil in ~/dokument/*; do echo "Fil: $fil"; done
for i in $(seq 1 3); do echo "Varv $i"; done
```

En **while-loop** fortsätter så länge villkoret är sant:

```sh
i=1; while [ $i -le 3 ]; do echo $i; (( i++ )); done
```

Det vanligaste sättet att gå igenom en fil rad för rad är `while read`, med
filen inskickad med `<` efter `done`:

```sh
while read rad; do echo "> $rad"; done < ~/dokument/frukter.txt
```

`break` avbryter en loop och `continue` hoppar direkt till nästa varv.

> **Se upp för oändliga loopar!** En loop vars villkor aldrig blir falskt
> fortsätter för evigt. I en riktig terminal stoppar du den med **Ctrl+C**.
> Simulatorn avbryter själv efter 20 000 steg.

## Välja med `case`

När en variabel kan ha många olika värden är `case` tydligare än många `elif`:

```sh
fil=semester.jpg
case $fil in *.jpg|*.png) echo "En bild";; *.txt) echo "En textfil";; *) echo "Okänd typ";; esac
```

Varje alternativ avslutas med `;;` och `*)` fångar allt annat.

## Funktioner

En **funktion** är ett namngivet stycke kod som du kan anropa som ett eget
kommando. Den får argument på samma sätt som ett skript – `$1`, `$2` och `$#`:

```sh
halsa() { echo "Hej $1, välkommen!"; }
halsa Kim
```

Variabler som bara ska finnas inne i funktionen skapar du med `local`, och
`return` avslutar funktionen med en slutkod.

## Fråga användaren – `read`

`read` läser en rad från tangentbordet till en variabel:

```sh
read -p "Vad heter du? " namn; echo "Hej $namn!"
```

## Ett komplett exempel

Här är ett skript som använder det mesta från kapitlet. Det säkerhetskopierar
filerna man ger som argument:

```text
#!/bin/bash
# backup.sh – kopierar varje fil till fil.bak

if [ $# -eq 0 ]; then
    echo "Användning: $0 FIL..."
    exit 1
fi

for fil in "$@"; do
    if [ -f "$fil" ]; then
        cp "$fil" "$fil.bak"
        echo "Kopierade $fil"
    else
        echo "Hittar inte $fil" >&2
    fi
done
```

`exit 1` avslutar skriptet med slutkoden 1, så att den som anropar skriptet
ser att något gick fel.

## Tips för bra skript

- Börja med `#!/bin/bash` och skriv kommentarer.
- Sätt variabler inom citattecken: `"$fil"`, inte `$fil`.
- Många börjar sina skript med `set -euo pipefail`, så att skriptet avbryts
  vid första fel i stället för att fortsätta på måfå.
- Programmet **ShellCheck** hittar vanliga misstag i bash-skript – det finns
  att installera med pakethanteraren i alla stora distributioner.
