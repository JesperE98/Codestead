# Användare och grupper

Linux har från början varit byggt för att många ska kunna använda samma dator
samtidigt. Varje fil har en ägare och varje program körs som en viss
användare – därför är det en av administratörens viktigaste uppgifter att
skapa, ändra och ta bort konton. I det här kapitlet skapar du användaren
`kim`, ger kontot ett lösenord och sudo-rätt, och lär dig var allt sparas.

## Användare och UID

Du vet redan hur du tar reda på vem du är:

```sh
whoami
id
```

`id` visar att du inte bara har ett namn utan också ett nummer: `uid=1000`.
Det är **UID** (*user ID*), och det är numret – inte namnet – som kärnan
håller reda på. Namnet finns bara för att vi människor ska slippa komma ihåg
siffror. Några viktiga nummer:

| UID | Vem |
|---|---|
| `0` | **root**, administratören. Den som har UID 0 får göra allt. |
| `1`–`999` | **Systemanvändare** för tjänster och program |
| `1000` och uppåt | **Vanliga användare** – människor. Den första får 1000. |

## Användarlistan – `/etc/passwd`

Alla användare står i textfilen `/etc/passwd`, en rad per användare:

```sh
cat /etc/passwd
```

Varje rad har sju fält som skiljs åt av kolon. Titta på din egen rad:

```sh
grep elev /etc/passwd
```

```text
elev:x:1000:1000:Elev,,,:/home/elev:/bin/bash
 1   2  3    4      5        6          7
```

| Fält | Betyder |
|---|---|
| 1 | Användarnamnet |
| 2 | `x` – lösenordet ligger i `/etc/shadow` (se nedan) |
| 3 | UID |
| 4 | GID – numret på användarens **primära grupp** |
| 5 | Kommentar, oftast det fullständiga namnet |
| 6 | Hemkatalogen |
| 7 | Skalet som startas när användaren loggar in |

Kommandot `getent` gör samma uppslag. Skillnaden är att det också hittar
användare som inte står i filen, till exempel på en skola eller ett företag
där kontona finns på en central server:

```sh
getent passwd elev
```

### Systemanvändare

De flesta raderna i `/etc/passwd` är inte människor. Tjänster som webbservern
och loggsystemet körs som egna användare med så få rättigheter som möjligt –
blir de hackade kommer angriparen inte åt dina filer. De har skalet
`nologin`, så det går inte att logga in som dem:

:::debian
I Debian och Ubuntu heter webbserverns användare `www-data`:

```sh
grep www-data /etc/passwd
```
:::

:::arch
I Arch heter webbserverns användare `http`:

```sh
grep http /etc/passwd
```
:::

:::redhat
I Fedora finns till exempel `dbus`, som kör systemets meddelandebuss:

```sh
grep dbus /etc/passwd
```
:::

Med `awk` från kapitlet om textbearbetning kan du lista alla med UID 1000
eller mer – de vanliga användarna:

```sh
awk -F: '$3 >= 1000 {print $1}' /etc/passwd
```

`nobody` (UID 65534) kommer också med. Det är en specialanvändare som äger
"ingenting" och används när ett program ska ha så lite rättigheter som möjligt.

## Grupper och GID

En **grupp** är ett sätt att ge flera användare samma rättigheter, till
exempel till en gemensam projektkatalog. Grupperna står i `/etc/group`:

```sh
cat /etc/group
```

```text
sudo:x:27:elev
 1   2  3   4
```

Fälten är gruppnamnet, `x`, gruppens nummer (**GID**) och en
kommaseparerad lista med medlemmar.

Varje användare har **en primär grupp** (GID-fältet i `/etc/passwd`) och kan
dessutom vara med i hur många **extra grupper** som helst. Nya filer som du
skapar får din primära grupp. I de flesta distributioner får varje användare
en egen primär grupp med samma namn – `elev` är med i gruppen `elev`.

```sh
groups
id
```

## Lösenorden – `/etc/shadow`

Lägg märke till `x` i fält 2 i `/etc/passwd`. Förr låg lösenordet (krypterat)
just där. Problemet är att `/etc/passwd` **måste** kunna läsas av alla – det
är därifrån `ls -l` hämtar ägarnas namn. Då kunde vem som helst kopiera de
krypterade lösenorden och försöka knäcka dem i lugn och ro. Därför flyttades
de till `/etc/shadow`, som bara root kan läsa:

```sh
ls -l /etc/passwd /etc/shadow
sudo cat /etc/shadow
```

```text
kim:$y$j9T$Tm9...$Kx2...:20756:0:99999:7:::
```

Fält 2 är inte själva lösenordet utan en **hash** – ett "fingeravtryck" som
inte går att räkna baklänges. När du loggar in räknas hashen ut för det du
skrev och jämförs med den sparade. `$y$` betyder att metoden *yescrypt*
används. Står det `!` eller `*` i stället finns inget lösenord, eller så är
kontot **låst**. Resten av fälten handlar om när lösenordet senast byttes och
när det går ut. Dem visar `chage` i klartext:

```sh
chage -l elev
```

## Skapa en användare – `useradd`

Att skapa användare kräver root. Det vanligaste kommandot finns i alla
distributioner:

```sh
sudo useradd -m -s /bin/bash kim
```

| Flagga | Betyder |
|---|---|
| `-m` | Skapa hemkatalogen `/home/kim` |
| `-s /bin/bash` | Skalet användaren får |
| `-c "Kim Svensson"` | Kommentaren (fullständigt namn) |
| `-G grupp1,grupp2` | Extra grupper redan från början |

`useradd` letar upp nästa lediga UID från 1000 och uppåt – `kim` blir 1001.
Gränserna står i `/etc/login.defs`. Det skapas också en grupp `kim`, och
filerna i `/etc/skel` (*skeleton*) kopieras till den nya hemkatalogen. Lägg
något där, så får alla nya användare det:

```sh
ls -a /etc/skel
```

Här skiljer sig distributionerna åt:

:::debian
I Debian och Ubuntu är `useradd` snålt: utan `-m` skapas **ingen**
hemkatalog, och utan `-s` blir skalet `/bin/sh`. Därför finns det vänligare
skriptet `adduser`, som hör till Debian-familjen. Det skapar hemkatalog,
väljer bash och frågar efter lösenord och namn:

```sh
sudo adduser lisa
```

Svara på frågorna – du kan trycka Enter på de flesta. `adduser` kan också
lägga till en befintlig användare i en grupp: `sudo adduser lisa sudo`.
:::

:::arch
I Arch skapas ingen hemkatalog utan `-m`, och kommandot `adduser` finns inte
alls – prova:

```sh
adduser lisa
```

Arch-wikin rekommenderar att du gör allt på en gång:
`useradd -m -G wheel -s /bin/bash namn`.
:::

:::redhat
I Fedora skapas hemkatalogen även utan `-m` (inställningen `CREATE_HOME` i
`/etc/login.defs`), och skalet blir bash. `-m` skadar ändå inte, så vänj dig
vid att skriva det – då fungerar samma kommando överallt.
:::

`useradd`, `passwd` och de andra kommandona i kapitlet är alltid installerade.
Paketet heter `passwd` i Debian, `shadow` i Arch och `shadow-utils` i Fedora –
ännu ett exempel på att samma sak kan heta olika.

## Sätta lösenord – `passwd`

Ett nytt konto har inget lösenord (`!` i `/etc/shadow`) och går därför inte
att logga in på. Sätt ett med `passwd`:

```sh
sudo passwd kim
```

Du får skriva lösenordet två gånger. **Det du skriver syns inte** – inga
stjärnor, ingenting. Det är meningen: den som tittar över axeln ska inte ens
se hur långt lösenordet är. Skriv och tryck Enter.

`passwd` utan namn byter ditt eget lösenord. Bara root får byta lösenord åt
andra – prova utan sudo:

```sh
passwd root
```

## Grupper – `groupadd`, `usermod -aG` och `gpasswd`

Skapa en grupp och lägg till en medlem:

```sh
sudo groupadd utvecklare
sudo usermod -aG utvecklare kim
groups kim
```

`-aG` betyder *append to Groups*. **Glöm inte `-a`!** Med bara `-G` sätts
listan över extra grupper till exakt det du skriver – och användaren åker ut
ur alla andra grupper, till exempel sudo-gruppen. Ett vanligt sätt att låsa
ute sig själv.

`gpasswd` gör samma sak och kan också ta bort medlemmar:

```sh
sudo gpasswd -a kim utvecklare
sudo gpasswd -d kim utvecklare
```

På en riktig dator gäller ett nytt gruppmedlemskap först när användaren
loggar in nästa gång. Simulatorn är snällare – där gäller det direkt.

Grupper används för delade kataloger. Gör gruppen ägare och ge den
skrivrätt med `chgrp` och `chmod`:

```sh
sudo mkdir /srv/projekt
sudo chgrp utvecklare /srv/projekt
sudo chmod 775 /srv/projekt
ls -ld /srv/projekt
```

## Ge sudo-rätt – `sudo` eller `wheel`

Vem som får använda `sudo` bestäms i `/etc/sudoers`:

```sh
sudo cat /etc/sudoers
```

Raden `%{{adminGroup}} ALL=(ALL:ALL) ALL` betyder att alla i gruppen
**{{adminGroup}}** får köra alla kommandon som root. Att ge någon sudo-rätt
är alltså bara att lägga till personen i rätt grupp – och gruppen heter
olika i olika familjer:

:::debian
I Debian och Ubuntu heter gruppen `sudo`:

```sh
sudo usermod -aG sudo kim
```
:::

:::arch
I Arch heter gruppen `wheel` – ett gammalt Unix-namn för "de som styr" (*big
wheel*):

```sh
sudo usermod -aG wheel kim
```
:::

:::redhat
I Fedora heter gruppen `wheel` – ett gammalt Unix-namn för "de som styr"
(*big wheel*):

```sh
sudo usermod -aG wheel kim
```
:::

Redigera aldrig `/etc/sudoers` direkt med en vanlig editor – ett skrivfel
kan göra att ingen längre kan använda sudo. Använd `visudo`, som kontrollerar
filen innan den sparas. Oftast räcker det med grupperna.

## Byta användare – `su` och `sudo -u`

Det finns två sätt att bli någon annan:

| Kommando | Vems lösenord? | Vad händer |
|---|---|---|
| `su - kim` | **kims** | Du loggar in som kim tills du skriver `exit` |
| `sudo -u kim kommando` | **ditt eget** (du måste ha sudo-rätt) | Ett enda kommando körs som kim |
| `sudo -iu kim` | ditt eget | Ett inloggningsskal som kim |

```sh
sudo -u kim whoami
```

Med `su` byter du på riktigt. Bindestrecket (`-`) gör det till en
inloggning: du hamnar i kims hemkatalog och får kims inställningar. Prompten
visar vem du är, och `exit` tar dig tillbaka:

```sh
su - kim
```

`su` utan namn betyder root. På Ubuntu har root inget lösenord, så `su -`
fungerar inte där – använd `sudo -i`.

## Låsa och ta bort konton

Ett konto som inte ska användas på ett tag kan **låsas**. `usermod -L` sätter
ett `!` framför hashen i `/etc/shadow`, så att inget lösenord längre stämmer.
`-U` låser upp:

```sh
sudo usermod -L kim
sudo passwd -S kim
sudo usermod -U kim
```

`passwd -S` visar status: `P` (har lösenord), `L` (låst) eller `NP` (inget
lösenord). Med `chage -E` kan ett konto sluta gälla ett visst datum – bra för
sommarjobbare och vikarier.

Innan du tar bort någon kan det vara bra att se vem som är inloggad och när
någon senast var det:

```sh
who
last
```

Sedan tar `userdel` bort användaren. Med `-r` försvinner också hemkatalogen
– utan `-r` ligger filerna kvar:

```sh
sudo useradd -m vikarie
sudo userdel -r vikarie
```

:::debian
I Debian-familjen finns också `deluser`, motsvarigheten till `adduser`:
`sudo deluser --remove-home vikarie`. `sudo deluser kim sudo` tar bort kim
ur gruppen sudo.
:::

`userdel` vägrar ta bort en användare som är inloggad – prova `sudo userdel
elev`.

## Sammanfattning

| Kommando | Gör |
|---|---|
| `id`, `groups` | Visa UID, GID och grupper |
| `useradd -m -s /bin/bash namn` | Skapa en användare |
| `passwd namn` | Sätta lösenord |
| `usermod -aG grupp namn` | Lägga till i en grupp |
| `groupadd grupp` | Skapa en grupp |
| `usermod -L` / `-U` | Låsa / låsa upp |
| `userdel -r namn` | Ta bort användaren och hemkatalogen |
| `su - namn`, `sudo -u namn` | Byta användare |
| `/etc/passwd`, `/etc/group`, `/etc/shadow` | Där allt sparas |
