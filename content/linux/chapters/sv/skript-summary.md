# Sammanfattning: Skript och automatisering

I den här delen har du gjort om kommandon till egna program.

## Shell-skript

Ett skript är en textfil med kommandon som börjar med shebang-raden
`#!/bin/bash`. Du kan skriva den med ett here-dokument (`cat > fil << 'SLUT'`),
göra den körbar med `chmod +x` och köra den med `./`. Rader som börjar med `#`
är kommentarer.

Du skapar variabler med `namn=värde` – utan mellanslag – och använder dem inom
dubbla citattecken: `"$namn"`, eller `"${namn}_text"` när text följer direkt
efter. `$(kommando)` ersätts med det som kommandot skriver ut, och `$(( ))`
räknar med heltal. Ett skript läser sina argument från `$1`, `$2` …, `$#` och
`"$@"`.

`if` tittar på ett kommandos slutkod, oftast testkommandot `[ ]`. Tal jämförs
med `-eq`, `-lt` och deras släktingar; text med `=` och `!=`. `for` loopar
över en lista, `while` fortsätter så länge ett villkor är sant, och `while
read` går igenom en fil rad för rad. `case` väljer mellan mönster, funktioner
är namngivna kodbitar med egna `$1`, och `read` ber användaren om indata.
`exit 1` talar om för den som anropade skriptet att något gick fel.

## Kommandon och syntax

| Syntax | Gör |
|---|---|
| `#!/bin/bash` | Shebang-raden: vilket program som kör skriptet |
| `cat > fil << 'SLUT'` | Skriv rader till en fil fram till raden `SLUT` |
| `namn=värde` · `"$namn"` · `"${namn}"` | Skapa · använd en variabel |
| `$(kommando)` | Ersätts med det som kommandot skriver ut |
| `$(( a * 6 ))` · `(( a++ ))` | Räkna med heltal · ändra en variabel |
| `$0` · `$1` · `$#` · `"$@"` | Skriptets namn · första argumentet · antal argument · alla argument |
| `if [ ... ]; then ...; elif ...; else ...; fi` | Villkor |
| `-f` · `-d` · `-z` | Filen finns · katalogen finns · variabeln är tom |
| `=` · `!=` | Text lika · olika |
| `-eq` · `-ne` · `-lt` · `-le` · `-gt` · `-ge` | Jämför tal |
| `[[ $fil == *.txt ]]` | Bashs smartare test, med mönster |
| `for x in lista; do ...; done` | Loopa över en lista |
| `while [ ... ]; do ...; done` | Loopa så länge villkoret är sant |
| `while read rad; do ...; done < fil` | Gå igenom en fil rad för rad |
| `break` · `continue` | Lämna loopen · gå till nästa varv |
| `case $x in mönster) ...;; *) ...;; esac` | Välj efter mönster |
| `namn() { ...; }` · `local` · `return` | En funktion · lokal variabel · avsluta funktionen |
| `read -p "Fråga " var` | Läs en rad från tangentbordet |
| `exit 1` | Avsluta skriptet med en slutkod |
| `set -euo pipefail` | Stoppa skriptet vid första felet |
