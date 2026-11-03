# Sammanfattning: Systemet

I den här delen har du tittat på det som händer runt dina kommandon: skalets
minne, vem som får göra vad, vilka program som körs och hur filer packas
ihop.

## Variabler, PATH och alias

Du läser en variabel med `$NAMN` och skapar en med `NAMN=värde` – utan
mellanslag runt `=`. `export` gör den till en miljövariabel, som även program
du startar kan läsa. Inom dubbla citattecken byts variabler ut mot sitt
värde; inom enkla citattecken skrivs allt ut precis som det står. Skalet
letar efter kommandon i katalogerna i `PATH`, och `$?` innehåller slutkoden
från det senaste kommandot: `0` betyder att det gick bra. Alias och variabler
försvinner när du stänger terminalen, om du inte lägger dem i `~/.bashrc`.

## Användare, rättigheter och sudo

Varje fil har en ägare, en grupp och tre uppsättningar rättigheter – för
ägaren, gruppen och övriga. `r` = 4, `w` = 2 och `x` = 1, så `755` är
`rwxr-xr-x` och `600` är `rw-------`. Ett skript behöver rättigheten `x` och
körs med `./` eftersom katalogen du står i inte finns i `PATH`. `sudo` kör ett
enstaka kommando som root och frågar efter ditt eget lösenord. I Ubuntu får
användarna i gruppen `sudo` använda det.

## Länkar och filinformation

En fils innehåll och rättigheter finns i en **inod**, och namnen i en katalog
pekar på inoder. `ln -s` skapar en **symbolisk länk**, en liten fil med en
sökväg, som går sönder om målet försvinner; en relativ sökväg i den räknas från
länkens egen katalog. `ln` utan `-s` skapar en **hård länk**, ett namn till för
samma inod. `stat` visar allt om en fil, `file` berättar vad den innehåller
oavsett namn, och **umask** bestämmer rättigheterna för nya filer: med `022`
får de `644`, med `077` bara `600`.

## Processer och jobb

Varje program som körs är en process med ett PID och en förälder (PPID).
`ps aux` visar alla, och `top` visar dem live, sorterade efter
processoranvändning. `kill` skickar en signal: `SIGTERM` (15) som standard,
och `SIGKILL` (9) som sista utväg. Med `&` körs ett kommando i bakgrunden,
och med `jobs`, `fg` och `bg` hanterar du jobben i din terminal. `nohup` låter
ett kommando fortsätta efter att du loggat ut, och `watch` kör ett kommando om
och om igen.

## Arkiv och komprimering

`tar` samlar filer i ett arkiv och `gzip` gör en enda fil mindre –
tillsammans ger de en `.tar.gz`. Exakt en av `c`, `x` och `t` säger vad tar
ska göra, och efter `f` kommer arkivets namn. `zcat` läser en `.gz`-fil utan
att packa upp den, och `zip -r` / `unzip` hanterar zip-filer, som är lätta att
dela med Windows och macOS.

## Kommandon och flaggor

| Kommando | Gör |
|---|---|
| `echo $NAMN` | Visa värdet av en variabel |
| `export NAMN=värde` | Skapa en miljövariabel |
| `env` | Lista alla miljövariabler |
| `which ls` · `type cd` | Visa var ett program finns · vad ett namn är |
| `echo $?` | Visa slutkoden från förra kommandot |
| `alias ll='ls -la'` · `unalias ll` | Skapa · ta bort ett alias |
| `source ~/.bashrc` | Läs in `~/.bashrc` direkt |
| `id` · `groups` | Visa din användare och dina grupper |
| `ls -l` | Visa rättigheter, ägare och grupp |
| `chmod 644 fil` · `chmod u+x fil` | Ändra rättigheter med siffror · symboler |
| `sudo kommando` · `sudo -i` | Kör ett kommando som root · starta ett root-skal |
| `sudo tee -a fil` | Sist i en pipe: lägg till text i en fil som bara root får ändra |
| `ln -s mål namn` · `ln fil namn` | Skapa en symbolisk · hård länk |
| `readlink länk` · `realpath sökväg` | Vart en länk pekar · hela sökvägen utan länkar |
| `ls -li` | Visa inodnummer och antal länkar |
| `stat fil` · `stat -c '%a %U' fil` | Allt om en fil · bara det du ber om |
| `file fil` | Vad en fil innehåller |
| `umask` · `umask 077` | Visa · ställ in vilka rättigheter nya filer förlorar |
| `ps` · `ps aux` · `ps -ef` | Dina processer · alla processer · med förälderns PID |
| `ps aux --sort=-%cpu` | Alla processer, de tyngsta först |
| `pgrep -l namn` | Hitta PID för en process med namnet |
| `top` | En live-vy över processerna |
| `kill PID` · `kill -9 PID` | Be en process avsluta · tvinga den |
| `pkill mönster` · `killall namn` | Stoppa processer med namnet |
| `kommando &` | Kör ett kommando i bakgrunden |
| `jobs` · `fg %1` · `bg %1` · `kill %1` | Lista · förgrund · bakgrund · avsluta ett jobb |
| `nohup kommando &` | Fortsätt köra efter utloggning |
| `watch -n 5 kommando` | Kör ett kommando var femte sekund |
| `uptime` · `free -h` | Belastning · minne |
| `tar -czvf arkiv.tar.gz katalog` | Packa ihop och komprimera en katalog |
| `tar -tzvf arkiv.tar.gz` | Lista innehållet i ett arkiv |
| `tar -xzvf arkiv.tar.gz -C katalog` | Packa upp ett arkiv i en katalog |
| `gzip fil` · `gzip -k fil` · `gunzip fil.gz` | Komprimera · behåll originalet · packa upp |
| `zcat fil.gz` | Läs en komprimerad fil direkt |
| `zip -r arkiv.zip katalog` · `unzip arkiv.zip -d katalog` | Skapa · packa upp en zip-fil |
| `du -sh katalog` | Visa hur mycket plats något tar |
