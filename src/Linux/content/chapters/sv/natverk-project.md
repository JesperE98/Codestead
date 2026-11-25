# Projekt: Webbplatsen ligger nere!

Fredag, 16.47. Telefonen ringer. Det är chefen, andfådd:
– Webbplatsen ligger nere! Kunderna ser inte våra öppettider, och samma kund
har redan ringt tre gånger!

Företagets webbplats är den lilla webbservern `myserver` på port 8080 – på
*din* dator. Ja, verkligen. Någon lade den där "tillfälligt" för flera år
sedan, och sedan dess har ingen vågat flytta den.

Är det nätverket? Webbservern? Eller chefens laptop? Ta reda på det inifrån och
ut, skriv ner allt i en incidentlogg – och se till att det blir enklare nästa
gång. Allt du behöver finns i *Nätverk*; utmaningen är att sätta ihop bitarna
själv.

## Uppdraget

1. **Börja loggen.** Skapa mappen `~/{{incidentDir}}` med incidentloggen
   `{{incidentLog}}`, och skriv in datorns IP-adress och gatewayens adress i den.
2. **Vägen ut.** Visa att nätet fungerar hela vägen ut på internet,
   namnuppslagning inräknad: lägg till en ping med tre paket till ett namn på
   internet i loggen.
3. **Lyssnar någon?** Ta reda på om något lyssnar på port 8080. Om inget gör
   det, starta webbservern och kontrollera igen.
4. **Svarar webbplatsen?** Lägg till svarshuvudena från startsidan,
   `http://localhost:8080`, i loggen. Statuskoden ska vara 200.
5. **En nyckel till servern.** Nästa gång vill du in på servern `server.lan`
   utan lösenord. Skapa ett nyckelpar och lägg den publika nyckeln på servern.
6. **Säkerhetskopiera.** Kopiera hela mappen `~/{{incidentDir}}` till din
   hemkatalog på servern, så att loggen finns kvar även om din egen dator ger
   upp.
7. **Läs på distans.** Visa loggen som ligger på servern med `ssh` – utan att
   någon frågar efter ett lösenord.

Delmålen i listan bredvid kontrolleras automatiskt när du kör dina kommandon.

## Tips på vägen

- `>` skapar (eller skriver över) en fil och `>>` lägger till i slutet: börja
  loggen med `>` och håll dig sedan till `>>`.
- Arbeta inifrån och ut: adress, väg, router, internet och sist ett namn. Utan
  `-c` fortsätter `ping` tills du stoppar den.
- `ss -tulpn` visar portarna som lyssnar. Kolumnen *Process* är tom för
  processer som andra användare äger – det är porten som räknas här.
- I Ubuntu är `curl` inte förinstallerat: `sudo apt update` och
  `sudo apt install curl`. `-I` hämtar bara huvudena.
- Det korta namnet `srv` från `~/.ssh/config` fungerar överallt – liksom
  `{{user}}@server.lan` och `{{user}}@192.168.1.10`.
- `rsync -av KÄLLA/ srv:MÅL/` – snedstrecket efter källan betyder "det som
  finns i katalogen".
- Frågar `ssh` fortfarande efter lösenord? Då ligger nyckeln inte på servern än.

## Vill du göra mer?

När delmålen är klara kan du fortsätta. Stäng av nätverkskortet med
`sudo ip link set enp0s3 down`, se var stegen inifrån och ut tar stopp, och slå
på det igen med `up`. Hämta webbplatsens sida `/about.html` med `curl`. Lägg
till en rad i loggen och kör samma `rsync -av` igen – bara ändringen skickas.
Och ring tillbaka till chefen. (Ryktet säger att laptopen stod i flygplansläge.)
