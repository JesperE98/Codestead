# Användare, rättigheter och sudo

Linux är byggt för att flera användare ska kunna dela på samma dator. Därför
har varje fil en ägare och regler för vem som får göra vad.

## Användare och grupper

Du är inloggad som användaren `{{user}}`. Varje användare tillhör en eller flera
**grupper**:

```sh
id
```

Den viktigaste användaren är **root** – administratören, som får göra allt.
Man loggar sällan in som root. I stället använder man `sudo` (se nedan).

## Läsa rättigheter

Kör `ls -l` och titta på första kolumnen:

```text
-rw-r--r-- 1 {{user}} {{user}}  174 Oct 29 13:55 {{notes}}
drwxr-xr-x 2 {{user}} {{user}} 4096 Oct 29 13:55 {{documents}}
```

Det första tecknet är typen: `-` för fil, `d` för katalog. Sedan kommer tre
grupper med tre tecken var:

```text
-   rw-     r--     r--
typ ägaren  gruppen övriga
```

| Tecken | För en fil | För en katalog |
|---|---|---|
| `r` (read) | Läsa innehållet | Lista innehållet |
| `w` (write) | Ändra innehållet | Skapa och ta bort filer i den |
| `x` (execute) | Köra filen som program | Gå in i katalogen med `cd` |

Därefter visas ägaren (`{{user}}`) och gruppen (`{{user}}`).

```quiz
En katalog har rättigheterna `drwxr-x---`. Vad får medlemmarna i dess grupp göra?
- [ ] Ingenting alls
- [x] Lista innehållet och gå in i den med `cd`, men inte skapa eller ta bort filer i den
- [ ] Allt som ägaren får göra
---
Gruppens rättigheter är `r-x`: `r` låter dig lista innehållet och `x` låter
dig gå in i katalogen. Utan `w` kan du inte skapa eller ta bort filer i den.
```

## Ändra rättigheter – `chmod`

Rättigheter kan anges med **siffror**. Varje grupp får en siffra som är summan
av r = 4, w = 2 och x = 1:

| Siffror | Rättigheter | Typiskt för |
|---|---|---|
| `755` | `rwxr-xr-x` | Program och kataloger |
| `644` | `rw-r--r--` | Vanliga filer |
| `600` | `rw-------` | Hemliga filer |

```sh
chmod 644 {{notes}}
```

Eller med **symboler**: `u` (ägaren), `g` (gruppen), `o` (övriga), `a` (alla),
följt av `+`, `-` eller `=` och rättigheterna:

```sh
chmod u+x skript.sh
chmod go-w fil.txt
```

```predict
$ touch plan.txt
$ chmod 600 plan.txt
$ chmod g+r plan.txt
$ ls -l plan.txt | awk '{print $1}'
-rw-r-----
```

## Skript

Ett **skript** är en textfil med kommandon. Första raden, `#!/bin/bash`, kallas
*shebang* och talar om vilket program som ska köra filen:

```sh
echo '#!/bin/bash' > datum.sh
echo 'echo "Idag är det:"; date' >> datum.sh
cat datum.sh
```

För att kunna köra skriptet som ett program måste det vara körbart:

```sh
chmod +x datum.sh
./datum.sh
```

`./` behövs eftersom katalogen du står i inte finns i `PATH`.

```quiz
Du har skrivit skriptet `test.sh` och kör `./test.sh`, men får
`Permission denied`. Vad saknas?
- [ ] Ett `sudo` framför
- [x] Rätten att köra – kör `chmod +x test.sh` först
- [ ] `./` – det ska vara `test.sh`
---
För att köra en fil som program behöver den rättigheten `x`. `./` är rätt:
utan det letar skalet bara i katalogerna i `PATH`.
```

## root och sudo

Vissa filer, som `/etc/shadow` där lösenorden finns, får bara root läsa.
Med `sudo` (*superuser do*) kör du ett enstaka kommando som root:

```sh
sudo whoami
```

Första gången frågar `sudo` efter **ditt eget** lösenord. Bara användare i
administratörsgruppen får använda sudo. I Ubuntu heter den gruppen **sudo** –
du ser den bland dina grupper när du kör `id`. Vissa andra distributioner
kallar gruppen `wheel` i stället; du läser mer om skillnaderna mellan
distributionerna i delen om distributioner.

Behöver du köra många kommandon som root kan du starta ett root-skal med
`sudo -i`. Prompten ändras då till `#`. Gå tillbaka med `exit`.

> **Tänk på!** Med sudo finns inga skyddsnät. Kör bara kommandon som du förstår.

```quiz
`sudo` frågar efter ett lösenord. Vems lösenord ska du skriva?
- [ ] roots lösenord
- [x] Ditt eget lösenord
- [ ] Inget lösenord – tryck bara Enter
---
`sudo` frågar efter **ditt eget** lösenord och släpper bara igenom dig om du
är med i administratörsgruppen.
```

### En vanlig fälla

```text
sudo echo "text" > /etc/fil     # fungerar INTE
```

Det är *ditt* skal – inte sudo – som öppnar filen för `>`. Använd i stället
`tee`, som körs med sudo:

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```

```quiz
Varför fungerar inte `sudo echo "text" > /etc/fil`?
- [ ] `echo` kan inte köras med sudo
- [x] Ditt eget skal öppnar filen för `>`, och det körs inte som root
- [ ] Filer i `/etc` kan aldrig ändras
---
sudo gäller bara kommandot (`echo`). Omdirigeringen sköts av ditt skal, som
körs som du. `tee` är programmet som skriver filen, så det är `tee` som
behöver sudo.
```
