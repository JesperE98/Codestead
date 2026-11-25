# Projekt: Den begagnade datorn

Din kompis Alex har köpt en begagnad bärbar dator och – efter lite övertalning –
låtit dig installera {{distro}} på den. Installationen gick bra. Nu har Alex
skickat en önskelista:

> 1. Uppdaterad, tack. Jag vill inte ha en dator full av säkerhetshål.
> 2. Nästa vecka börjar jag en kurs i programspråket Go.
> 3. Något som visar vad som gör datorn seg.
> 4. En riktig editor. Alla säger Vim.
> 5. Film! Den måste kunna spela film.

Allt du behöver har du från *Distributioner och paket*. Ingenting här är nytt;
utmaningen är att själv hitta rätt kommandon för pakethanteraren – och rätt
paketnamn.

## Uppdraget

1. **Gör datorn uppdaterad.** Hämta de senaste paketlistorna och uppgradera alla
   installerade paket.
2. **Hitta Go.** Sök i paketlistorna och ta reda på vad paketet med
   programspråket Go heter i din distribution. Det heter inte likadant överallt!
3. **Installera önskelistan.** Processvisaren `htop`, programspråket Go och
   texteditorn Vim.
4. **Dubbelkolla.** Leta upp Go i listan över *installerade* paket.
5. **Ta bort Vim.** Alex provade Vim och hittade inte ut igen. – Ta bort den!
   Avinstallera Vim igen.
6. **Film.** Installera mediaspelaren VLC (`org.videolan.VLC`) som Flatpak från
   Flathub.
7. **Provkör.** Innan du lämnar tillbaka datorn: låt Go visa sin version, så att
   Alex ser att kursen kan börja.

Delmålen i listan bredvid kontrolleras automatiskt när du kör dina kommandon. De
räknas per familj – gör projektet en gång till i en distribution från en annan
familj, så lär du känna en ny dialekt.

## Tips på vägen

:::debian
- I {{distro}} är pakethanteraren `apt`. Kommandon som ändrar systemet körs med
  `sudo`, och `apt update` hämtar bara listorna – `apt upgrade` installerar de
  nya versionerna.
:::
:::arch
- I {{distro}} är pakethanteraren `pacman`. Den stora bokstaven är operationen
  (`-S`, `-R`, `-Q`) och de små bokstäverna är tillägg. Uppgradera alltid med
  `-Syu`.
:::
:::redhat
- I {{distro}} är pakethanteraren `dnf`. Kom ihåg att `[y/N]` betyder att Enter
  svarar **nej**.
:::
- En sökning tittar både i namn och beskrivningar. Blir resultatet långt hjälper
  en mer exakt sökning – eller `grep`.
- Paketnamnen är oftast desamma överallt, men inte alltid. När du är osäker: sök.
- Saknas Flatpak, eller känner den inte till Flathub? Installera paketet
  `flatpak` och lägg till Flathub med `flatpak remote-add`, som du gjorde i
  kapitlet om universella paket.

## Vill du göra mer?

När delmålen är klara har Alex förstås fler önskemål. Starta `htop` och se vad
som körs. Titta på informationen om Go-paketet och ta reda på hur stort det är.
Fråga Flatpak vilka behörigheter VLC har. Och om det visar sig att Alex älskar
terminalen ändå: installera Vim igen.
