# familj-redhat – The Red Hat family: dnf and COPR

Status: **ogranskad**

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Fedora, RHEL och RHEL-kloner som Rocky Linux hör till Red Hat-familjen och använder dnf och `.rpm` | | ogranskad | 2026-10-30 |
| dnf-kommandon: `check-update`, `upgrade`, `install`, `remove`, `search`, `info`, `list --installed` | | ogranskad | 2026-10-30 |
| dnf hämtar ny paketinformation själv; inget separat steg som `apt update` | | ogranskad | 2026-10-30 |
| `dnf check-update` behöver inte root | | ogranskad | 2026-10-30 |
| `dnf check-update` avslutas med kod `100` när det finns uppdateringar | | ogranskad | 2026-10-30 |
| Kontrollfråga: `dnf check-update > /dev/null; echo $?` ger `100` i simulatorn (det finns väntande uppdateringar) | | ogranskad | 2026-10-30 |
| `Is this ok [y/N]`: Enter avbryter (Nej är standard); `-y` svarar ja | | ogranskad | 2026-10-30 |
| Paketen är `.rpm`-filer och lågnivåverktyget heter `rpm` | | ogranskad | 2026-10-30 |
| dnf ersatte `yum`; Fedora 41 kom med dnf5, som är betydligt snabbare | | ogranskad | 2026-10-30 |
| Kommandot heter `dnf` även i RHEL, Rocky och AlmaLinux | | ogranskad | 2026-10-30 |
| Paket från extra förråd installeras som root, kan krocka och kan sluta uppdateras | | ogranskad | 2026-10-30 |
| COPR (*Cool Other Package Repo*) är Fedoras byggtjänst; alla med Fedora-konto kan bygga `.rpm`-paket där | | ogranskad | 2026-10-30 |
| Varje COPR-projekt blir ett eget förråd, `användare/projekt`, och granskas inte av distributionen | | ogranskad | 2026-10-30 |
| `dnf repolist` visar förråden | | ogranskad | 2026-10-30 |
| `dnf copr enable` påminner om att förrådet inte är en del av Fedora; frågan har Nej som standard | | ogranskad | 2026-10-30 |
| `dnf copr enable` skapar en fil i `/etc/yum.repos.d/` | | ogranskad | 2026-10-30 |
| `dnf info` visar `From repository` | | ogranskad | 2026-10-30 |
| Paket från COPR uppdateras med `sudo dnf upgrade` | | ogranskad | 2026-10-30 |
| `dnf copr disable` stänger av förrådet men lämnar filen; `remove` tar bort den | | ogranskad | 2026-10-30 |
| RPM Fusion är ett stort gemensamt extra förråd med bl.a. vissa mediecodecs och drivrutiner | | ogranskad | 2026-10-30 |
