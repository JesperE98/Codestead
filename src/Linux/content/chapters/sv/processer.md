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

```quiz
Vad är en process PPID?
- [ ] Numret på processorn den körs på
- [x] PID för processen som startade den – dess förälder
- [ ] Dess prioritet
---
Varje process har en förälder. Följer du föräldrarna tillräckligt långt
hamnar du hos process nummer 1.
```

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

```try
pgrep -l sshd
---
`-l` visar namnet bredvid PID.
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

```quiz
Ett program har slutat svara. Vilket kommando ska du prova **först**?
- [x] `kill 1234` – det skickar `SIGTERM` och låter programmet avsluta snyggt
- [ ] `kill -9 1234` – det fungerar alltid bäst
- [ ] `sudo kill -9 1`
---
Börja med standardsignalen, `SIGTERM`. `SIGKILL` (`-9`) är sista utvägen,
eftersom programmet då inte hinner spara eller städa upp.
```

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

```quiz
Du har tryckt `Ctrl+Z` på ett program i förgrunden. Hur låter du det fortsätta
köras medan du behåller prompten?
- [ ] `fg %1`
- [x] `bg %1`
- [ ] `Ctrl+C`
---
`Ctrl+Z` pausar programmet. `bg` låter ett stoppat jobb fortsätta i
bakgrunden, medan `fg` skulle ta tillbaka det till förgrunden.
```

### Fortsätt efter utloggning – `nohup`

När du stänger terminalen eller ssh-anslutningen får programmen du startat
signalen **SIGHUP** (*hang up*) och avslutas – bakgrundsjobb också. `nohup`
gör att ett kommando struntar i den signalen:

```sh
nohup ./langt-jobb.sh &
```

Utdata som skulle ha visats i terminalen hamnar i stället i filen `nohup.out`:

```predict
$ nohup echo done
$ cat nohup.out
nohup: ignoring input and appending output to 'nohup.out'
done
```

För program som alltid ska köras är en **tjänst** bättre – dem möter du i
delen om systemadministration.

### Följ ett kommando – `watch`

`watch` kör ett kommando igen varannan sekund och visar resultatet på en ren
skärm – praktiskt för att se en fil växa eller en disk fyllas. Avsluta med
`Ctrl+C`. I simulatorn visas resultatet en gång.

```sh
watch -n 5 'ls -l /tmp'
```

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

```quiz
`free -h` visar lite *free* minne men mycket *available*. Vad betyder det?
- [ ] Datorn håller på att få slut på minne
- [x] Linux använder ledigt minne som cache för filer – titta på *available*
- [ ] En del av minnet är trasigt
```

## Samma överallt

Processer fungerar likadant i alla distributioner. I Ubuntu kommer verktygen
från paketet **procps** och `killall` från **psmisc**. En del distributioner
ger paketen lite andra namn, och vilka tjänster som körs från början skiljer
sig också – du får jämföra distributioner i delen om distributioner.
