# Nätverk

Nästan allt en Linuxdator gör handlar om att prata med andra datorer: hämta
uppdateringar, visa webbsidor, logga in på servrar. När något krånglar är det
terminalen som har de bästa verktygen för att ta reda på varför. I det här
kapitlet lär du dig hitta din egen adress, testa förbindelser, slå upp namn,
se vilka tjänster som körs, hämta saker från webben och logga in på en annan
dator med SSH.

Den simulerade datorn sitter i ett litet hemnätverk:

| Dator | Adress | Vad |
|---|---|---|
| Din dator ({{hostname}}) | `192.168.1.42` | Där du sitter nu |
| Routern (gatewayen) | `192.168.1.1` | Förbindelsen ut mot internet |
| Servern | `192.168.1.10` | En annan Linuxdator som du kan logga in på |

Bakom routern finns "internet" med bland annat `example.com`,
`linux.org` och `archlinux.org`.

## IP-adresser

Varje dator i ett nätverk har en **IP-adress**. En IPv4-adress är fyra tal
mellan 0 och 255, till exempel `192.168.1.42`. Adresser som börjar med
`192.168.`, `10.` eller `172.16.`–`172.31.` är **privata** – de används
bara inne i lokala nätverk och syns aldrig ute på internet.

Kommandot för att se datorns adresser är `ip` (från paketet *iproute2*).
`ip addr` kan förkortas till `ip a`:

```sh
ip a
```

Du ser två **gränssnitt** (nätverkskort):

- `lo` – *loopback*, ett låtsaskort som datorn använder för att prata med sig själv.
- `enp0s3` – det riktiga nätverkskortet. Förr hette korten `eth0`, och
  trådlösa kort heter ofta något i stil med `wlan0` eller `wlp2s0`.

Raden `inet 192.168.1.42/24` är din IPv4-adress. `link/ether` är kortets
**MAC-adress**, som är inbyggd i hårdvaran, och `state UP` betyder att
kortet är igång. Vill du ha en kortare översikt finns `-br` (*brief*), och
`hostname -I` visar bara adresserna:

```sh
ip -br a
hostname -I
```

Det äldre kommandot `ifconfig` (från paketet *net-tools*) ser du fortfarande
i många guider, men det är inte installerat från början i moderna
distributioner. `ip` gör allt det gjorde och mer.

## localhost – datorn själv

Adressen `127.0.0.1` har namnet **localhost** och betyder alltid "den här
datorn". Program på samma dator pratar ofta med varandra via localhost –
till exempel en webbserver du utvecklar och webbläsaren du testar den med.
Trafik till localhost lämnar aldrig datorn.

## Nätmask och gateway

`/24` efter adressen är **nätmasken**. Den säger att de första 24 bitarna
(de tre första talen, `192.168.1`) är nätverkets adress. Alla datorer vars
adress börjar med `192.168.1.` sitter alltså i samma lokala nät och kan nås
direkt. Allt annat skickas till **gatewayen** – routern – som skickar det
vidare ut på internet. Det ser du i routingtabellen:

```sh
ip route
```

```text
default via 192.168.1.1 dev enp0s3 proto dhcp src 192.168.1.42 metric 100
192.168.1.0/24 dev enp0s3 proto kernel scope link src 192.168.1.42 metric 100
```

Första raden, **default**, är standardvägen: "allt som inte står någon
annanstans skickas till 192.168.1.1". Andra raden säger att hela
`192.168.1.0/24` nås direkt via `enp0s3`. `proto dhcp` betyder att datorn
fick sina inställningar automatiskt från routern via **DHCP**.

## ping – går det att nå?

`ping` skickar små testpaket och mäter hur lång tid svaren tar. Med `-c`
(*count*) bestämmer du hur många paket – annars fortsätter ping tills du
trycker **Ctrl+C**:

```sh
ping -c 3 192.168.1.1
```

```text
64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.756 ms
...
3 packets transmitted, 3 received, 0% packet loss, time 2004ms
```

- `time=` är svarstiden. Inne i hemnätverket under en millisekund, ut till
  internet ofta 10–50 ms.
- `0% packet loss` – inga paket försvann. Förlorade paket tyder på ett
  dåligt nät (eller en dålig wifi-förbindelse).
- `Destination Host Unreachable` betyder att ingen dator har den adressen
  i det lokala nätet.

Prova också att pinga datorn själv och en dator ute på internet:

```sh
ping -c 2 localhost
ping -c 3 example.com
```

Obs! Många servrar och brandväggar svarar inte på ping med flit. Att ping
inte får svar betyder alltså inte alltid att datorn är nere.

## Namn och DNS

Människor kommer ihåg namn, datorer använder adresser. **DNS** (*Domain Name
System*) är internets telefonkatalog som översätter `example.com` till en
IP-adress. Vilken DNS-server datorn frågar står i `/etc/resolv.conf`:

```sh
cat /etc/resolv.conf
```

I Ubuntu och Fedora står det `127.0.0.53` – det är **systemd-resolved**, en
lokal mellanhand på din egen dator som i sin tur frågar routern. I Debian och
Arch står routern, `192.168.1.1`, där direkt.

För att fråga DNS själv används `dig`, `host` eller `nslookup`. De finns
inte från början, utan ingår i ett paket som heter olika saker i olika
distributioner:

:::debian
```sh
sudo apt update
sudo apt install dnsutils
```
:::

:::arch
```sh
sudo pacman -S bind
```

Paketet heter `bind` efter DNS-servern BIND, som verktygen kommer ifrån.
:::

:::redhat
```sh
sudo dnf install bind-utils
```
:::

`dig` visar hela svaret från DNS-servern. Det viktiga står under
`ANSWER SECTION`. Med `+short` får du bara adressen:

```sh
dig example.com
dig +short example.com
```

`host` och `nslookup` gör samma sak med kortare utskrift. `nslookup` finns
även i Windows och macOS. `host` kan också göra ett **omvänt uppslag** – från
adress till namn:

```sh
host example.com
nslookup archlinux.org
host 1.1.1.1
```

Du kan fråga en viss DNS-server med `@`, till exempel Cloudflares `1.1.1.1`
eller Googles `8.8.8.8`:

```sh
dig @8.8.8.8 +short debian.org
```

## /etc/hosts – datorns egen namnlista

Innan datorn frågar DNS tittar den i filen `/etc/hosts`. Där står bland
annat att `localhost` är `127.0.0.1`:

```sh
cat /etc/hosts
```

Servern i hemnätverket har adressen `192.168.1.10`, men namnet `server.lan`
finns inte i någon DNS:

```sh
ping -c 1 server.lan
```

Lösningen är att lägga till en rad i `/etc/hosts`. Filen ägs av root, så du
behöver `sudo`. Men se upp – det här fungerar **inte**:

```text
sudo echo '192.168.1.10 server.lan' >> /etc/hosts
bash: /etc/hosts: Permission denied
```

`sudo` gäller bara `echo`. Det är ditt eget skal (som du, inte root) som
öppnar filen för `>>`. Knepet är `tee -a`, som lägger till det den får
från pipen i slutet av en fil – och `tee` kan köras med sudo:

```sh
echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts
ping -c 3 server.lan
```

Nu fungerar namnet för alla program på datorn. Men `dig` frågar DNS direkt
och bryr sig inte om `/etc/hosts`, så den hittar fortfarande inget. Vill du
se vad *systemet* slår upp, använd `getent`:

```sh
dig +short server.lan
getent hosts server.lan
```

Ordningen (först filen, sedan DNS) bestäms av raden `hosts:` i
`/etc/nsswitch.conf`.

## Portar och tjänster

En IP-adress pekar ut en dator. En **port** (ett nummer mellan 1 och 65535)
pekar ut ett program på datorn – som en adress och ett lägenhetsnummer. Ett
program som väntar på anslutningar sägs **lyssna** på en port. Några
välkända:

| Port | Tjänst |
|---|---|
| 22 | SSH – logga in på andra datorer |
| 53 | DNS |
| 80 | HTTP – webb |
| 443 | HTTPS – krypterad webb |
| 8080 | Ofta webbservrar under utveckling |

Portar under 1024 får bara root öppna. Vilka portar som lyssnar visar `ss`
(*socket statistics*):

```sh
ss -tulpn
```

Flaggorna brukar läras in som en ramsa: **t**cp, **u**dp, **l**yssnande,
**p**rocess, **n**umeriskt. `0.0.0.0:22` betyder att `sshd` lyssnar på port
22 på alla datorns adresser, och `[::]:22` är samma sak för IPv6. Kolumnen
*Process* är tom för processer som andra användare äger – med `sudo` ser du
alla:

```sh
sudo ss -tulpn
```

Om övningsservern `minserver` från kapitlet om processer körs, ser du den
här på port 8080. Det äldre kommandot `netstat -tulpn` (från *net-tools*) gör samma
sak.

## Hämta från webben: curl och wget

`curl` hämtar det som finns på en adress (en **URL**) och skriver ut det i
terminalen. Prova med minserver på din egen dator:

:::debian
I Debian och Ubuntu är `curl` inte förinstallerat (men `wget` är det):

```sh
sudo apt install curl
```
:::

```sh
curl http://localhost:8080
```

Får du `Couldn't connect to server`? Då lyssnar ingenting på porten – du
kanske stoppade minserver i kapitlet om processer. Starta den igen:

```sh
minserver
```

Med `-I` visar curl bara svarets **huvuden** (*headers*), där den första
raden är en **statuskod**:

```sh
curl -I https://example.com
```

| Kod | Betyder |
|---|---|
| 200 | OK |
| 301, 302 | Sidan har flyttat – se `Location:` |
| 403 | Förbjudet |
| 404 | Finns inte |
| 500 | Fel på servern |

Många webbplatser skickar vidare från `http://` till `https://`. Då får du
bara en kort "301 Moved Permanently". Med `-L` följer curl efter:

```sh
curl -I http://linux.org
curl -L http://linux.org
```

Eftersom curl skriver till terminalen går det utmärkt att skicka vidare i
en pipe. `-s` (*silent*) stänger av förloppsmätaren:

```sh
curl -s https://example.com | grep title
```

För att spara till en fil används `-o FIL` (eller `-O`, som tar filnamnet
från adressen):

```sh
cd ~
curl -o exempel.html https://example.com
```

`wget` är gjort för att ladda ner filer. Det sparar alltid till en fil,
visar ett förlopp och följer omdirigeringar av sig själv:

:::arch
I Arch är `wget` inte förinstallerat (men `curl` är det):

```sh
sudo pacman -S wget
```
:::

:::redhat
I Fedora är `wget` inte förinstallerat (men `curl` är det):

```sh
sudo dnf install wget
```
:::

```sh
wget https://example.com/cheatsheet.txt
cat cheatsheet.txt
```

Vill du välja filnamnet själv används stort `-O`: `wget -O fil.html URL`.

## SSH – logga in på en annan dator

**SSH** (*Secure Shell*) är det vanliga sättet att styra en Linuxdator på
distans, och allt som skickas är krypterat. Servern kör tjänsten `sshd` på
port 22, och du ansluter med klienten `ssh`:

:::arch
I Arch är ssh-klienten inte förinstallerad:

```sh
sudo pacman -S openssh
```
:::

```sh
ssh elev@server.lan hostname
```

`elev@server.lan` betyder "användaren elev på datorn server.lan". Kommandot
efter värden (`hostname`) körs på servern och svaret visas hos dig – det står
`server` och inte {{hostname}}.

Första gången du ansluter till en dator frågar ssh om du litar på den:

```text
The authenticity of host 'server.lan (192.168.1.10)' can't be established.
ED25519 key fingerprint is SHA256:q7Jx3MmP0yZk8VbW1sTn4dLr9HcE2uFgA6oYiKjN5Rw.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Skriv `yes` (hela ordet). Serverns **värdnyckel** sparas då i
`~/.ssh/known_hosts`. Om nyckeln senare ändras varnar ssh stort och tydligt –
det kan betyda att någon försöker utge sig för att vara servern.

Kommandot kan vara flera kommandon inom citattecken:

```sh
ssh elev@server.lan 'whoami; uptime; ls'
ssh elev@server.lan cat välkommen.txt
```

Utan kommando loggar ssh in och du får ett skal på den andra datorn, som du
lämnar med `exit`. Det stöds inte i simulatorn – där skriver du alltid
kommandot direkt efter värden.

### Nycklar i stället för lösenord

I stället för lösenord kan du logga in med ett **nyckelpar**. Den privata
nyckeln stannar hos dig, och den publika läggs på servern:

```sh
ssh-keygen
ssh-copy-id elev@server.lan
```

Tryck Enter på frågorna från `ssh-keygen` för att använda standardfilen
`~/.ssh/id_ed25519` utan lösenfras. `ssh-copy-id` lägger den publika
nyckeln (`id_ed25519.pub`) i `~/.ssh/authorized_keys` på servern. Efter
det frågar ssh inte efter lösenord längre. Visa aldrig den privata nyckeln
för någon!

Med `scp` och `rsync` kan du kopiera filer över SSH, och i filen
`~/.ssh/config` kan du ge servrar korta namn – men det får vänta till ett
senare kapitel.

## När nätet inte fungerar

"Internet funkar inte" kan bero på många saker. Gå igenom stegen i ordning,
inifrån och ut – det första steget som misslyckas visar var felet sitter:

| Steg | Kommando | Om det misslyckas |
|---|---|---|
| 1. Har jag en adress? | `ip a` | Kortet är nere (`state DOWN`) eller fick ingen adress |
| 2. Finns en väg ut? | `ip route` | Ingen `default`-rad – ingen gateway |
| 3. Når jag routern? | `ping -c 3 192.168.1.1` | Problem i det lokala nätet (kabel, wifi) |
| 4. Når jag internet? | `ping -c 3 1.1.1.1` | Problem hos routern eller leverantören |
| 5. Fungerar DNS? | `ping -c 3 example.com` | Namnuppslagen fungerar inte – kolla `/etc/resolv.conf` |

Steg 4 pingar en adress direkt, utan något namn. Om steg 4 fungerar men
inte steg 5 är det nästan alltid DNS som krånglar – det är ett av de
vanligaste felen.

Prova själv! Stäng av nätverkskortet, gå igenom stegen och sätt sedan på det
igen:

```sh
sudo ip link set enp0s3 down
ip a
ip route
ping -c 3 192.168.1.1
ping -c 3 example.com
sudo ip link set enp0s3 up
```

## Paketen

Nätverksverktygen ligger i olika paket – och heter, som vanligt, olika
saker i olika familjer:

| Verktyg | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| `ip`, `ss` | `iproute2` | `iproute2` | `iproute` |
| `ping` | `iputils-ping` | `iputils` | `iputils` |
| `dig`, `host`, `nslookup` | `dnsutils` | `bind` | `bind-utils` |
| `traceroute` | `traceroute` | `traceroute` | `traceroute` |
| `ssh`, `ssh-keygen` | `openssh-client` | `openssh` | `openssh-clients` |

`traceroute` visar varje router som paketen passerar på vägen. Installera det
och prova `traceroute example.com`!

## Sammanfattning

| Kommando | Gör |
|---|---|
| `ip a` | Visa IP-adresser |
| `ip route` | Visa routingtabellen och gatewayen |
| `ping -c 3 VÄRD` | Testa om en dator går att nå |
| `dig +short NAMN` | Slå upp ett namn i DNS |
| `getent hosts NAMN` | Slå upp som systemet gör (med `/etc/hosts`) |
| `ss -tulpn` | Visa lyssnande portar |
| `curl URL` | Hämta och visa |
| `curl -o FIL URL`, `wget URL` | Ladda ner till en fil |
| `ssh ANVÄNDARE@VÄRD KOMMANDO` | Kör ett kommando på en annan dator |
