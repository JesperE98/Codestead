# familj-debian – The Debian family: apt and PPAs

Status: **ogranskad**

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Debian, Ubuntu och t.ex. Linux Mint hör till Debian-familjen och använder apt och `.deb` | | ogranskad | 2026-10-30 |
| apt-kommandon: `update`, `upgrade`, `install`, `remove`, `search`, `show`, `list --installed` | | ogranskad | 2026-10-30 |
| Kommandon som ändrar systemet kräver root; `apt search` och `apt show` gör det inte | | ogranskad | 2026-10-30 |
| `apt update` hämtar listan över paket och versioner men installerar inget | | ogranskad | 2026-10-30 |
| `apt upgrade` installerar nya versioner av det som redan är installerat | | ogranskad | 2026-10-30 |
| Innan `apt update` har körts är paketlistan tom och apt hittar inga paket | | ogranskad | 2026-10-30 |
| `apt remove` lämnar inställningsfilerna kvar; `apt purge` tar bort även dem | | ogranskad | 2026-10-30 |
| `[Y/n]`: stort Y betyder att Enter svarar ja; `-y` svarar ja automatiskt | | ogranskad | 2026-10-30 |
| `apt` är den moderna varianten med förloppsindikator och färger; `apt-get`/`apt-cache` har stabilare utdata och används i skript | | ogranskad | 2026-10-30 |
| `dpkg` packar upp `.deb`-filerna; apt sköter nedladdning, beroenden och uppdateringar | | ogranskad | 2026-10-30 |
| Distributionens förråd har tiotusentals paket som är testade, signerade och granskade | | ogranskad | 2026-10-30 |
| Paket från extra förråd installeras som root, kan krocka med systemets bibliotek och kan sluta uppdateras | | ogranskad | 2026-10-30 |
| Ett PPA (*Personal Package Archive*) är ett förråd på Launchpad, Canonicals tjänst; Launchpad bygger `.deb`-paket för olika Ubuntu-versioner | | ogranskad | 2026-10-30 |
| Ett PPA skrivs `ppa:användare/namn` och granskas inte av distributionen | | ogranskad | 2026-10-30 |
| `add-apt-repository` finns i paketet `software-properties-common`, förinstallerat i Ubuntu men inte i Debian | | ogranskad | 2026-10-30 |
| `add-apt-repository` skapar en fil i `/etc/apt/sources.list.d/` med förrådets adress och signeringsnyckel, och kör `apt update` | | ogranskad | 2026-10-30 |
| `-y` hoppar över frågan i `add-apt-repository` | | ogranskad | 2026-10-30 |
| En källa som läggs till för hand kräver `sudo apt update` efteråt | | ogranskad | 2026-10-30 |
| PPA-filen heter `lunatool-ubuntu-moonphase-noble.sources` och har `Suites: noble` (Ubuntu 24.04) – simulatorns påhittade PPA | | ogranskad | 2026-10-30 |
| `apt policy` visar vilka förråd ett paket finns i; `***` = installerad version, `500` = förrådets prioritet, `100` = det som redan är installerat | | ogranskad | 2026-10-30 |
| Finns ett paket i flera förråd väljer apt den högsta versionen | | ogranskad | 2026-10-30 |
| PPA:er är byggda för Ubuntu; en blandning av Debian- och Ubuntu-paket kallas *FrankenDebian* | | ogranskad | 2026-10-30 |
| I Debian är *backports*, Flatpak eller utvecklarens eget förråd bättre än PPA | | ogranskad | 2026-10-30 |
| `add-apt-repository --remove` tar bort PPA:t; programmet blir kvar utan uppdateringar | | ogranskad | 2026-10-30 |
| Paket från ett PPA uppdateras med `sudo apt update && sudo apt upgrade` | | ogranskad | 2026-10-30 |
