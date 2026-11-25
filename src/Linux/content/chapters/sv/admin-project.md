# Projekt: Ny kollega på måndag

Fredag, halv fyra. Chefen lutar sig in genom dörren:
– Just det, {{newUser}} börjar i supportteamet på måndag. Kan du fixa allt?
Konto, teammapp, läsningen för första veckan. Och se till att intranätet
fungerar den här gången – förra nykomlingen satt hela första förmiddagen och
stirrade på *Couldn't connect to server*.

Allt du behöver finns i *Systemadministration* – användare och grupper, diskar
och tjänster – med lite hjälp från de tidigare delarna. Ingenting här är nytt;
utmaningen är att sätta ihop bitarna själv, så att måndagsmorgonen går utan
missöden.

## Uppdraget

1. **Ett konto.** Skapa användaren `{{newUser}}` med hemkatalog och `/bin/bash`
   som skal, och ge kontot ett lösenord.
2. **Teamet.** Skapa gruppen `{{teamGroup}}` och lägg till både `{{newUser}}` och
   dig själv i den. `{{newUser}}` får ingen sudo-rätt – inte än, den kommer efter
   provanställningen.
3. **Den gemensamma mappen.** Skapa `/srv/{{teamGroup}}`, som ägs av gruppen
   `{{teamGroup}}`. Gruppen får läsa, skriva och gå in i mappen; alla andra får
   ingenting alls.
4. **Provkör kontot.** Bli `{{newUser}}`, skapa en fil i den gemensamma mappen för
   att visa att rättigheterna fungerar, och gå tillbaka till ditt eget konto.
5. **Välkomstpaketet.** Läsningen för första veckan, `{{report}}`, ligger på
   USB-stickan (`/dev/sdb1`). Lägg en kopia i hemkatalogen hos `{{newUser}}` –
   ägd av `{{newUser}}`, inte av root – och avmontera stickan när du är klar.
6. **Intranätet.** Teamets intranät är tjänsten `myserver`. Se till att den kör
   nu **och** startar av sig själv varje gång datorn startar.
7. **Generalrepetition.** Starta om datorn och visa i journalen att intranätet
   startade av sig självt vid den här uppstarten.

Delmålen i listan bredvid kontrolleras automatiskt när du kör dina kommandon.

## Tips på vägen

- Nästan allt här ändrar systemet, så de flesta kommandona behöver `sudo`.
- `usermod -aG` – glöm inte `-a`, annars åker användaren ur alla andra grupper.
  `id {{newUser}}` visar vilka grupper ett konto är med i.
- `ls -ld` visar en katalogs ägare, grupp och rättigheter. Räkna rättigheterna
  oktalt: *rwx* är 7 och ingenting är 0.
- En fil som du kopierar med `sudo` ägs av root. Kopiera den i stället *som*
  nykomlingen – med `su -` eller `sudo -u` – så ägs den av rätt person från
  början.
- Hamnade det redan en kopia som ägs av root där? `{{newUser}}` får ta bort den – den
  ligger i den egna hemkatalogen – och kopiera igen.
- Säger `umount` *target is busy*? Ditt eget skal står i katalogen: `cd ~`
  först.
- `start` och `enable` är två olika saker. `systemctl is-active` och
  `systemctl is-enabled` visar läget.
- Efter en omstart visar `journalctl -b` bara den nuvarande uppstarten.

## Vill du göra mer?

När delmålen är klara kan du fortsätta. Får nykomlingens filer plats? Det vet
`df -h` och `du -sh`. Lås kontot med `usermod -L` fram till måndag morgon,
kontrollera med `passwd -S` och lås upp med `usermod -U`. Och titta på ditt
arbete från systemets sida: raderna för `{{newUser}}` i `/etc/passwd` och
`/etc/group`, och `systemctl status myserver`.
