# Användare, rättigheter och sudo

Linux är byggt för att flera användare ska kunna dela på samma dator. Därför
har varje fil en ägare och regler för vem som får göra vad.

## Användare och grupper

Du är inloggad som användaren `elev`. Varje användare tillhör en eller flera
**grupper**:

```sh
id
```

Den viktigaste användaren är **root** – administratören, som får göra allt.
Man loggar sällan in som root. I stället använder man `sudo` (se nedan).

## Läsa rättigheter

Kör `ls -l` och titta på första kolumnen:

```text
-rw-r--r-- 1 elev elev  174 Oct 29 13:55 anteckningar.txt
drwxr-xr-x 2 elev elev 4096 Oct 29 13:55 dokument
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

Därefter visas ägaren (`elev`) och gruppen (`elev`).

## Ändra rättigheter – `chmod`

Rättigheter kan anges med **siffror**. Varje grupp får en siffra som är summan
av r = 4, w = 2 och x = 1:

| Siffror | Rättigheter | Typiskt för |
|---|---|---|
| `755` | `rwxr-xr-x` | Program och kataloger |
| `644` | `rw-r--r--` | Vanliga filer |
| `600` | `rw-------` | Hemliga filer |

```sh
chmod 644 anteckningar.txt
```

Eller med **symboler**: `u` (ägaren), `g` (gruppen), `o` (övriga), `a` (alla),
följt av `+`, `-` eller `=` och rättigheterna:

```sh
chmod u+x skript.sh
chmod go-w fil.txt
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

## root och sudo

Vissa filer, som `/etc/shadow` där lösenorden finns, får bara root läsa.
Med `sudo` (*superuser do*) kör du ett enstaka kommando som root:

```sh
sudo whoami
```

Första gången frågar `sudo` efter **ditt eget** lösenord. Bara användare i
administratörsgruppen får använda sudo. I {{distro}} heter den gruppen
**{{adminGroup}}**:

:::debian
I Debian-familjen heter gruppen `sudo`.
:::

:::arch
I Arch-familjen heter gruppen `wheel` – ett gammalt Unix-namn för
"de som styr" (*big wheel*).
:::

:::redhat
I Red Hat-familjen heter gruppen `wheel` – ett gammalt Unix-namn för
"de som styr" (*big wheel*).
:::

Behöver du köra många kommandon som root kan du starta ett root-skal med
`sudo -i`. Prompten ändras då till `#`. Gå tillbaka med `exit`.

> **Tänk på!** Med sudo finns inga skyddsnät. Kör bara kommandon som du förstår.

### En vanlig fälla

```text
sudo echo "text" > /etc/fil     # fungerar INTE
```

Det är *ditt* skal – inte sudo – som öppnar filen för `>`. Använd i stället
`tee`, som körs med sudo:

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```
