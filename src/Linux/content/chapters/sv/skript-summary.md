# Sammanfattning: Skript och automatisering

I den här delen har du gjort om kommandon till egna program.

## Textbearbetning med sed och awk

`sed` redigerar rader: `s/gammalt/nytt/` byter ut (`g` för alla träffar), adresser väljer rader, `d` tar bort och `-n` med `p` skriver bara ut det du ber om. `sed -i` ändrar själva filen. `awk` arbetar med kolumner: `-F` väljer avgränsare, `$1` … `$NF` är fälten, ett mönster före `{ }` väljer rader och `END { }` körs efter sista raden.

## Shell-skript

Ett skript är en textfil med kommandon som börjar med shebang-raden
`#!/bin/bash`. Du kan skriva den med ett here-dokument (`cat > fil << '{{heredocEnd}}'`),
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

## Schemalagda jobb med cron

**cron** kör jobben i din **crontab** på bestämda tider. Varje rad har fem
tidsfält – minut, timme, dag i månaden, månad och veckodag – och sedan
kommandot; `*` betyder varje och `*/5` var femte. `crontab -l` visar jobben,
och `crontab -` installerar nya från indata – och ersätter alla gamla. Jobben
körs utan din terminals inställningar och med en kort `PATH`, så skicka deras
utdata till en fil. `journalctl -u cron` visar varje körning, och
`systemctl list-timers` visar systemd:s timers.

## Kommandon och syntax

| Syntax | Gör |
|---|---|
| `sed`: `s/…/…/g`, `d`, `p`, `q`, `-n`, `-i`, `-E`, `-e` | Redigerar en ström av rader |
| `awk`: `-F` avgränsare, `$1`, `$NF`, `NF`, `NR`, `BEGIN`, `END` | Arbetar med kolumner |
| `#!/bin/bash` | Shebang-raden: vilket program som kör skriptet |
| `cat > fil << '{{heredocEnd}}'` | Skriv rader till en fil fram till raden `{{heredocEnd}}` |
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
| `while read {{lineVar}}; do ...; done < fil` | Gå igenom en fil rad för rad |
| `break` · `continue` | Lämna loopen · gå till nästa varv |
| `case $x in mönster) ...;; *) ...;; esac` | Välj efter mönster |
| `namn() { ...; }` · `local` · `return` | En funktion · lokal variabel · avsluta funktionen |
| `read -p "Fråga " var` | Läs en rad från tangentbordet |
| `exit 1` | Avsluta skriptet med en slutkod |
| `set -euo pipefail` | Stoppa skriptet vid första felet |
| `crontab -l` · `crontab -r` | Visa · ta bort din crontab |
| `echo '* * * * * kommando' \| crontab -` | Installera en crontab från indata (ersätter den gamla) |
| `(crontab -l; echo 'RAD') \| crontab -` | Lägg till ett jobb och behåll de gamla |
| `MIN TIMME DAG MÅNAD VECKODAG kommando` | En crontab-rad, t.ex. `30 2 * * 1-5` |
| `systemctl list-timers` | Visa systemd:s timers |
