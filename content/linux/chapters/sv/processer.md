# Processer och jobb

Varje program som körs är en **process**. Just nu kör den simulerade datorn
ett tiotal: systemets tjänster, ditt skal – och något mer som du snart ska få
syn på. I det här kapitlet lär du dig se vad som körs, stoppa program som
krånglar och köra saker i bakgrunden.

## Vad är en process?

En process är ett program som körs, tillsammans med allt det behöver: minne,
öppna filer och vilken användare det körs som. Varje process har ett
**PID** (*process ID*) – ett nummer som identifierar den – och en förälder,
**PPID**, som startade den. Allt börjar med process nummer 1, `init` (i
nästan alla distributioner är det `systemd`), som startar resten.

## Mina processer – `ps`

`ps` (*process status*) utan flaggor visar processerna i din egen terminal:

```sh
ps
```

Du ser ditt skal, `bash`, och `ps` själv – som bara lever precis medan den
körs.

## Alla processer – `ps aux`

För att se allt som körs på datorn används oftast `ps aux`:

```sh
ps aux
```

| Kolumn | Betyder |
|---|---|
| `USER` | Användaren som processen körs som |
| `PID` | Processens id-nummer |
| `%CPU` / `%MEM` | Hur mycket processor och minne den använder |
| `STAT` | Tillstånd: `R` kör, `S` sover, `s` sessionsledare |
| `COMMAND` | Kommandot som startade processen |

Listan blir lång, så den kombineras ofta med `grep` eller `sort`:

```sh
ps aux | grep sshd
ps aux --sort=-%cpu | head -5
```

Varianten `ps -ef` visar samma processer men med förälderns PID i en egen
kolumn. Vill du bara ha PID för en process vars namn du vet finns `pgrep`:

```sh
pgrep -l sshd
```

## Live-vy – `top` och `htop`

`top` visar processerna sorterade efter hur mycket processor de använder och
uppdateras varje sekund – perfekt för att hitta det som gör datorn seg.
Överst ser du belastningen (*load average*), antal processer och minnet.

```sh
top
```

I en riktig terminal avslutar du `top` med `q`. Många föredrar `htop`, som har
färger och går att styra med musen, men det måste oftast installeras först.

## Stoppa processer – `kill`

Namnet är dramatiskt, men `kill` skickar egentligen en **signal** till en
process. Standardsignalen, `SIGTERM` (15), ber processen att avsluta sig
snyggt. Om den inte lyssnar kan du skicka `SIGKILL` (9), som tvingar den att
sluta direkt – men då hinner den inte spara eller städa upp.

```text
kill 1234        # be process 1234 avsluta (SIGTERM)
kill -9 1234     # tvinga den (SIGKILL) – sista utvägen
```

Vet du namnet men inte PID kan du använda `pkill` (matchar ett mönster) eller
`killall` (exakt namn):

```text
pkill firefox
killall firefox
```

Du får bara skicka signaler till dina **egna** processer. För processer som
tillhör root eller andra användare behövs `sudo`.

> **Hitta och stoppa!** Någon process på den här datorn använder nästan 100 %
> av processorn. Använd `top` eller `ps aux --sort=-%cpu` för att ta reda på
> vad den heter och vilket PID den har – och stoppa den sedan.

## Förgrund och bakgrund

När du kör ett kommando väntar skalet tills det är klart; det körs i
**förgrunden**. Sätter du `&` sist körs det i stället i **bakgrunden**, och du
får prompten tillbaka direkt:

```sh
sleep 300 &
```

Skalet svarar med jobbnumret inom hakparentes och processens PID, till
exempel `[1] 4200`. Program som startas från terminalen kallas **jobb**:

```sh
jobs
```

| Kommando | Gör |
|---|---|
| `jobs` | Lista jobben i den här terminalen |
| `fg %1` | Flytta jobb 1 till förgrunden |
| `bg %1` | Låt ett stoppat jobb fortsätta i bakgrunden |
| `kill %1` | Avsluta jobb 1 |
| `Ctrl+C` | Avbryt programmet i förgrunden |
| `Ctrl+Z` | Pausa programmet i förgrunden (fortsätt med `fg` eller `bg`) |

Variabeln `$!` innehåller PID för det senaste bakgrundsjobbet. När ett jobb
blir klart berättar skalet det, med en rad som `[1]+  Done   sleep 300`.

## Hur mår datorn?

Två små kommandon ger en snabb överblick:

```sh
uptime
free -h
```

`uptime` visar hur länge datorn varit igång och belastningen de senaste 1, 5
och 15 minuterna. `free -h` visar hur mycket minne som används. Lägg märke
till kolumnen *available*: Linux använder ledigt minne som cache för filer,
så *free* ser ofta lågt ut fast det finns gott om minne.

## Samma överallt

Processer fungerar likadant i alla distributioner. Verktygen kommer från
paketet **procps** (som heter `procps-ng` i Arch och Fedora) och `killall`
från **psmisc**. Det som skiljer är vilka tjänster som körs från början –
jämför gärna `ps aux` i {{distro}} med en annan distribution!
