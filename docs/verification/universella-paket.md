# universella-paket – Flatpak, Snap and AppImage

Status: **ogranskad**

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Universella paketformat buntar det mesta programmet behöver och fungerar i alla distributioner | | ogranskad | 2026-10-30 |
| Flatpak, Snap och AppImage kompletterar distributionens pakethanterare, främst för skrivbordsprogram | | ogranskad | 2026-10-30 |
| Jämförelsetabellen: källa, vilka system, sandlåda, storlek, uppdateringar och användning för distributionspaket, Flatpak, Snap och AppImage | | ogranskad | 2026-10-30 |
| Snap uppdateras automatiskt i bakgrunden; Flatpak med `flatpak update`; AppImage genom att ladda ner en ny fil | | ogranskad | 2026-10-30 |
| Flatpak-program hämtas från en *remote*, nästan alltid Flathub, och delar *runtimes* (t.ex. `org.gnome.Platform`) | | ogranskad | 2026-10-30 |
| Flatpak är inte förinstallerat i Ubuntu/Debian; finns i Archs förråd; Fedora Workstation har Flatpak med remoten `fedora` | | ogranskad | 2026-10-30 |
| `flatpak remote-add --if-not-exists` misslyckas inte om remoten redan finns | | ogranskad | 2026-10-30 |
| Program-ID skrivs som omvänt domännamn, t.ex. `org.gimp.GIMP` | | ogranskad | 2026-10-30 |
| Utan flaggor installerar Flatpak för hela systemet i `/var/lib/flatpak`; `--user` i `~/.local/share/flatpak` med egna remotes | | ogranskad | 2026-10-30 |
| `flatpak uninstall --unused` tar bort oanvända runtimes | | ogranskad | 2026-10-30 |
| Snap är Canonicals format och standard i Ubuntu (t.ex. Firefox); snaps kommer från Snap Store och hanteras av `snapd` | | ogranskad | 2026-10-30 |
| Snap finns inte i Archs förråd, bara i AUR; finns i Fedoras förråd | | ogranskad | 2026-10-30 |
| Installerade snaps hamnar i `/snap/bin`; installera/ta bort kräver root | | ogranskad | 2026-10-30 |
| Snaps med *classic confinement* kräver `--classic` | | ogranskad | 2026-10-30 |
| Kanalerna `stable`, `candidate`, `beta` och `edge`; `--channel=beta` | | ogranskad | 2026-10-30 |
| En AppImage är ett helt program i en fil; ingen installation och ingen root | | ogranskad | 2026-10-30 |
| Kontrollfråga: en nedladdad fil utan körrättighet ger `Permission denied` när den startas | | ogranskad | 2026-10-30 |
| AppImage behöver FUSE 2 (`libfuse.so.2`); paketet heter `libfuse2t64` i Ubuntu 24.04 och Debian 13, `fuse2` i Arch, `fuse-libs` i Fedora | | ogranskad | 2026-10-30 |
| Installera inte paketet `fuse` i Ubuntu – det ersätter `fuse3` | | ogranskad | 2026-10-30 |
| `--appimage-extract` packar upp utan FUSE; `--appimage-extract-and-run` packar upp tillfälligt och startar | | ogranskad | 2026-10-30 |
| AppImage har ingen sandlåda och inga automatiska uppdateringar | | ogranskad | 2026-10-30 |
| Gear Lever och AppImageLauncher kan lägga AppImages i programmenyn | | ogranskad | 2026-10-30 |
