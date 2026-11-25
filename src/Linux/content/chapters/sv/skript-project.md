# Projekt: Rapportroboten

Minns du dagen då servern krånglade? Chefen älskade din rapport – lite för mycket.
– Briljant. En sådan vill jag ha på skrivbordet varje morgon. Varje vardag. Före
sju. Du tänker inte gå upp klockan sex för att skriva `grep`-kommandon. Som tur är
behöver du inte det: nu kan du skriva skript. Dags att bygga en robot som gör
jobbet åt dig.

Roboten läser loggen `~/{{documents}}/server.log` och skriver en kort rapport: hur
många rader det finns av varje nivå och vilka fel som inträffade. Allt den behöver
finns i *Skript och automatisering* – utmaningen är att sätta ihop det själv.

## Uppdraget

1. **Bygg roboten.** Skapa skriptet `~/{{robotScript}}` med en shebang-rad och en
   rad som skriver ut en rubrik. Gör det körbart och kör det.
2. **Lär den att fråga efter loggen.** Roboten får loggfilen som första argument.
   Körs den utan argument ska den förklara hur den används och avsluta med en
   annan slutkod än 0.
3. **… och att klaga på filer som saknas.** Om filen i argumentet inte finns säger
   roboten det och avslutar med en annan slutkod än 0. Prova med ett filnamn som
   inte finns.
4. **Räkna nivåerna.** Körd på `~/{{documents}}/server.log` skriver roboten ut hur
   många rader loggen har av varje nivå, räknat med `awk`. Se upp: `WARN` och
   `warn` är samma nivå!
5. **Lista felen.** Under siffrorna listar rapporten alla fel med klockslag och
   meddelande – men **utan** datumet, som ändå är detsamma på alla rader. Ta bort
   det med `sed`.
6. **Anställ roboten.** Schemalägg den med cron: den körs på serverloggen klockan
   06.30 måndag till fredag, och utskriften läggs till i `~/{{robotLog}}`. Behåll
   dina gamla jobb.
7. **Generalrepetition.** Kör jobbets kommando för hand en gång, så att dagens
   rapport hamnar i `~/{{robotLog}}`, och titta på filen.

Delmålen i listan bredvid kontrolleras automatiskt när du kör dina kommandon.

## Tips på vägen

- Bygg roboten en bit i taget och kör den efter varje ändring. Enklast är att
  skriva hela skriptet igen med here-dokumentet – det ersätter den gamla
  versionen.
- Prova varje rad på kommandoraden först, med loggens sökväg i stället för
  `"$1"`. När den fungerar där flyttar du in den i skriptet.
- `echo $?` direkt efter roboten visar vilken slutkod den avslutade med.
- `awk`:s `toupper()` gör om `warn` till `WARN`, och `sort | uniq -c` räknar rader
  som är likadana.
- Varje rad i loggen börjar med datumet och ett mellanslag – `sed`:s `s`-kommando
  kan byta ut den biten mot ingenting.
- Jobben i cron körs inte i din terminal: använd hela sökvägar som
  `~/{{robotScript}}` och skicka utskriften till en fil. Med `>>` läggs varje
  morgons rapport till i slutet i stället för att skriva över gårdagens.

## Vill du göra mer?

När delmålen är klara kan roboten lära sig fler konster. Skriv in datumet i
rubriken med `$(date)`. Gör varje del av rapporten till en egen funktion. Låt
roboten ta flera loggar på en gång med `for file in "$@"`, eller räkna hur många
förfrågningar som fick svaret `404`. Och om appen är öppen klockan 06.30 en
vardag visar `journalctl -u cron` att roboten verkligen gick till jobbet.
