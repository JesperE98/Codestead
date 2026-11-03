# Faktagranskning: system-exam (Exam: The system)

Status: **ogranskad**

Källtext: `src/Linux/content/chapters/en/system-exam.md`. Predict-svaren kontrolleras av testet
`PredictionsMatchTheSimulator`; här granskas att frågorna och svaren stämmer på ett riktigt system.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| `echo "$HOME" '$USER'` skriver `/home/elev $USER` (hemkatalogen i simulatorn) | | ogranskad | |
| `export` gör en variabel till miljövariabel som startade program kan läsa | | ogranskad | |
| `ls ~ > /dev/null` följt av `echo $?` skriver `0` | | ogranskad | |
| `rwxr-x---` = `750` | | ogranskad | |
| `chmod 755` följt av `chmod go-x` ger `-rwxr--r--` | | ogranskad | |
| På Ubuntu får medlemmar i gruppen `sudo` använda sudo | | ogranskad | |
| `sudo -i` startar ett root-skal med prompten `#` tills `exit` | | ogranskad | |
| `R` i `STAT` betyder att processen kör | | ogranskad | |
| `$!` innehåller PID för senaste bakgrundsjobbet | | ogranskad | |
| `kill` på en process som tillhör root ger `Operation not permitted`; `sudo kill` fungerar | | ogranskad | |
| `pkill` matchar ett mönster, `killall` kräver exakt namn | | ogranskad | |
| `tar -cvf dokument dokument.tar` har fel ordning; arkivnamnet ska komma direkt efter `f` | | ogranskad | |
| `gzip` följt av `gunzip` ger tillbaka originalfilen (`frukter.txt`) | | ogranskad | |
| `zcat fil.gz` skriver ut det okomprimerade innehållet och lämnar filen orörd; samma som `gzip -dc` | | ogranskad | |
| `du -sh` ger en summa (`-s`) i läsbar storlek (`-h`) | | ogranskad | |
| Provet kräver 80 % (enligt docs/DEVELOPMENT.md) | | ogranskad | |
