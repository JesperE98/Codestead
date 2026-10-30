# Release-checklista (manuell)

Release-flödet testar automatiskt på Windows Server 2022/2025, Ubuntu 22.04/24.04, Fedora, Arch och
CachyOS. Det här görs för hand på riktiga datorer före en större release.

## Windows 10 och Windows 11 (x64, ren användare)

- [ ] Ladda ner `codestead-linux-<version>-win-x64-Setup.exe` från codestead-releases.
- [ ] SmartScreen: "Mer information" → "Kör ändå" fungerar.
- [ ] Appen startar efter installationen och finns i Start-menyn.
- [ ] Byt språk till arabiska: allt vänds höger-till-vänster.
- [ ] Byt språk till japanska och kinesiska: tecknen visas (inga tomma rutor).
- [ ] Lös en uppgift i kapitel 1. Stäng appen, starta igen: framstegen finns kvar.
- [ ] Mörkt tema i Windows-inställningarna → appen följer med (tema "System").
- [ ] Avinstallera via Inställningar → Appar. Mappen `%LOCALAPPDATA%\codestead-linux` är borta.

## Linux-skrivbord (Ubuntu LTS, Fedora, Arch/CachyOS)

- [ ] Installera paketet med pakethanteraren. Appen finns i programmenyn med ikon.
- [ ] Wayland-session: appen startar (via XWayland).
- [ ] Språk med andra skrivsystem (arabiska, hindi, japanska) visas rätt.
- [ ] AppImage: starta, kontrollera att den hittar uppdateringar.
- [ ] Avinstallera med pakethanteraren.
