# Sammanfattning: Nätverk

I den här delen hittade du runt i ett litet hemnätverk från terminalen: din
egen adress, vägen ut till internet, namn och DNS, portar, webben och andra
datorer över SSH.

## Nätverk

Varje dator i ett nätverk har en **IP-adress**, och adresser som börjar med
`192.168.`, `10.` eller `172.16.`–`172.31.` är **privata**. `ip a` visar
datorns gränssnitt och adresser – `lo` är loopback-kortet, och `127.0.0.1`
(**localhost**) betyder alltid datorn själv. **Nätmasken** (`/24`) säger vilka
adresser som finns i det lokala nätet; allt annat går via standardvägen till
**gatewayen**, som `ip route` visar. `ping` testar om en dator går att nå.

**DNS** översätter namn till adresser. Innan datorn frågar DNS tittar den i
`/etc/hosts`, och `getent hosts` visar vad systemet slår upp, medan `dig`
frågar DNS direkt. I Ubuntu pekar `/etc/resolv.conf` på `127.0.0.53`,
systemd-resolved, och `dig`, `host` och `nslookup` finns i paketet
`dnsutils`.

En **port** pekar ut ett program på en dator, och `ss -tulpn` visar vilka
portar som lyssnar. `curl` hämtar en URL och skriver ut den, `wget` laddar ner
till en fil – i Ubuntu är `wget` förinstallerat och `curl` installeras med
apt. Med **SSH** kör du kommandon på en annan dator, krypterat; första gången
bekräftar du serverns värdnyckel, och med ett nyckelpar behöver du inte längre
något lösenord.

När "internet inte fungerar", gå inifrån och ut: adress, väg, router, en
adress på internet och till sist ett namn. Om adresser fungerar men namn inte
gör det, är det DNS.

## Kommandon

| Kommando | Gör |
|---|---|
| `ip a`, `ip -br a`, `hostname -I` | Visa IP-adresser |
| `ip route` | Visa routingtabellen och gatewayen |
| `ping -c 3 VÄRD` | Testa om en dator går att nå |
| `sudo ip link set KORT down` / `up` | Stäng av / slå på ett nätverkskort |
| `cat /etc/resolv.conf` | Vilken DNS-server som tillfrågas |
| `dig +short NAMN`, `dig @SERVER NAMN` | Slå upp ett namn i DNS |
| `host NAMN`, `nslookup NAMN` | Slå upp ett namn (med `host` även från adress till namn) |
| `getent hosts NAMN` | Slå upp som systemet gör (med `/etc/hosts`) |
| `sudo tee -a /etc/hosts` | Lägg till det som kommer från en pipe sist i `/etc/hosts`, som root |
| `ss -tulpn` | Visa portar som lyssnar |
| `curl URL` | Hämta och visa |
| `curl -I URL`, `curl -L URL` | Bara rubrikerna, följ omdirigeringar |
| `curl -o FIL URL`, `wget URL`, `wget -O FIL URL` | Ladda ner till en fil |
| `ssh ANVÄNDARE@VÄRD KOMMANDO` | Kör ett kommando på en annan dator |
| `ssh-keygen`, `ssh-copy-id ANVÄNDARE@VÄRD` | Skapa ett nyckelpar och lägg den publika nyckeln på servern |
