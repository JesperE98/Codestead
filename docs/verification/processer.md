# Faktagranskning: processer (Processes and jobs)

Status: **ogranskad**

Källtext: `content/linux/chapters/en/processer.md` (inklusive kontrollfrågorna).

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| En process har minne, öppna filer och en användare den körs som | | ogranskad | |
| Varje process har ett PID och en förälder (PPID) som startade den | | ogranskad | |
| Process nummer 1 är `init`, i nästan alla distributioner `systemd` | | ogranskad | |
| `ps` utan flaggor visar processerna i den egna terminalen | | ogranskad | |
| `ps aux` visar alla processer på datorn | | ogranskad | |
| Kolumnerna `USER`, `PID`, `%CPU`, `%MEM`, `STAT`, `COMMAND` och deras betydelse | | ogranskad | |
| `STAT`: `R` kör, `S` sover, `s` sessionsledare | | ogranskad | |
| `ps aux --sort=-%cpu` sorterar efter CPU-användning, högst först | | ogranskad | |
| `ps -ef` visar förälderns PID i en egen kolumn | | ogranskad | |
| `pgrep` ger PID för en process med känt namn; `-l` visar namnet | | ogranskad | |
| `top` sorterar efter processoranvändning och uppdateras varje sekund | | ogranskad | |
| `top` visar load average, antal processer och minne överst | | ogranskad | |
| `top` avslutas med `q` | | ogranskad | |
| `htop` har färger, kan styras med musen och måste oftast installeras | | ogranskad | |
| `kill` skickar en signal; standard är `SIGTERM` (15) | | ogranskad | |
| `SIGKILL` (9) tvingar processen att sluta direkt utan att spara eller städa | | ogranskad | |
| `pkill` matchar ett mönster, `killall` ett exakt namn | | ogranskad | |
| Signaler får bara skickas till egna processer; andras kräver `sudo` | | ogranskad | |
| `&` sist på raden kör kommandot i bakgrunden | | ogranskad | |
| Skalet svarar med jobbnummer och PID, t.ex. `[1] 4200` | | ogranskad | |
| `jobs`, `fg %1`, `bg %1`, `kill %1` och deras betydelse | | ogranskad | |
| `Ctrl+C` avbryter, `Ctrl+Z` pausar programmet i förgrunden | | ogranskad | |
| `$!` innehåller PID för det senaste bakgrundsjobbet | | ogranskad | |
| Skalet meddelar när ett jobb är klart (`[1]+  Done ...`) | | ogranskad | |
| `uptime` visar drifttid och belastning de senaste 1, 5 och 15 minuterna | | ogranskad | |
| `free -h` visar minnesanvändning | | ogranskad | |
| Linux använder ledigt minne som filcache; kolumnen *available* är den att titta på | | ogranskad | |
| På Ubuntu kommer verktygen från paketet procps och `killall` från psmisc | | ogranskad | |
| Vissa distributioner har andra paketnamn (tidigare text: `procps-ng` i Arch och Fedora) | | ogranskad | |
