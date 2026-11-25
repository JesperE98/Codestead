# Release-checklista (manuell)

Release-flödet testar automatiskt på Windows Server 2022/2025, Ubuntu 22.04/24.04, Fedora, Arch och
CachyOS, provar Chromiums sandlåda under AppArmor med hubbens `.deb` på en Ubuntu 24.04-runner, och uppdaterar en installation av den sista C#-releasen och av den föregående releasen till den nya
versionen (AppImage och Setup.exe). Uppdateringen av ett native-paket med pkexec provas i docker
(`packaging/native-update-test.sh`, med en låtsas-pkexec). Det här görs för hand på riktiga datorer före en större
release.

## Windows 10 och Windows 11 (x64, ren användare)

- [ ] Ladda ner `codestead-linux-<version>-win-x64-Setup.exe` från codestead-releases.
- [ ] SmartScreen: "Mer information" → "Kör ändå" fungerar.
- [ ] Appen startar efter installationen och finns i Start-menyn.
- [ ] Byt språk till japanska och kinesiska: tecknen visas (inga tomma rutor).
- [ ] Lös en uppgift i kapitel 1. Stäng appen, starta igen: framstegen finns kvar.
- [ ] Mörkt tema i Windows-inställningarna → appen följer med (tema "System").
- [ ] Avinstallera via Inställningar → Appar. Mappen `%LOCALAPPDATA%\codestead-linux` är borta.

## Linux-skrivbord (Ubuntu LTS, Fedora, Arch/CachyOS)

- [ ] Installera paketet med pakethanteraren. Appen finns i programmenyn med ikon.
- [ ] Wayland-session: appen startar (via XWayland).
- [ ] Ubuntu 24.04 och senare (AppArmor begränsar användarnamnrymderna): `.deb` och AppImage startar som vanlig
      användare (paketen gör `chrome-sandbox` setuid root; AppImagen startar utan sandlåda där den inte går).
- [ ] **Chromiums sandlåda med AppArmor** (ett riktigt Ubuntu 24.04-skrivbord;
      [DEVELOPMENT.md](DEVELOPMENT.md#chromiums-sandlåda-på-linux)). Hubbens `.deb` provas av release-flödets jobb
      **test-sandbox** (`packaging/sandbox-test.sh` på GitHubs ubuntu-24.04-runner: profilen installerad och laddad,
      hubben kör med sandlådan med och utan setuid-`chrome-sandbox`, profilen kvar efter en ominstallation och borta
      efter `apt remove`). Kvar för hand, det som behöver ett skrivbord eller pkexec:
      - Starta hubben (paketet) från programmenyn: `ps -o args= -p $(pgrep -f -o Codestead.Hub.bin)` har **inte**
        `--no-sandbox`.
      - Med hubben som paket: installera Codestead Linux i hubben och öppna den. Dess process har etiketten
        `codestead-hub (unconfined)` (ärvd) och startas utan `--no-sandbox`.
      - Hubben som AppImage (avinstallera paketet först), med Codestead Linux installerat i hubben: erbjudandet
        **Slå på Chromiums sandlåda för dina verktyg?** visas. **Slå på** → systemets lösenordsruta → aviseringen;
        `/etc/apparmor.d/codestead-user-$(id -u)` finns och `sudo aa-status` visar `codestead-user-<uid>`. Öppna Codestead
        Linux: etiketten är `codestead-user-<uid> (unconfined)`, ingen `--no-sandbox`. Inställningarna säger "På".
        Avbryt lösenordsrutan en gång först: felet visas, inget installeras. **Inte nu** döljer erbjudandet även efter
        omstart. Hubben själv (AppImage) kör med `--no-sandbox`.
      - Uppgradera paketet en gång från den föregående versionens `.deb`: profilen finns kvar efteråt (jobbet provar
        en ominstallation av samma version).
- [ ] Språk med andra skrivsystem (kinesiska, japanska) visas rätt.
- [ ] AppImage: starta, kontrollera att den hittar uppdateringar.
- [ ] **Uppdatering av ett native-paket** (Ubuntu med GNOME, vars polkit-agent visar lösenordsrutan; gärna även
      Fedora/KDE): installera den *föregående* versionen av hubben (och Codestead Linux) som `.deb`/`.rpm` med
      pakethanteraren och starta den som vanlig användare. Hubben visar **Uppdatera och starta om** med raden om
      lösenordet (verktyget: erbjudandet med samma rad). Klicka: förloppet visas, sedan systemets lösenordsruta.
      - Avbryt rutan: fönstret säger att uppdateringen inte installerades och visar **Ladda ner den nya versionen**
        (releasesidan); `dpkg -l`/`rpm -q` visar fortfarande den gamla versionen.
      - Försök igen och skriv lösenordet: appen stängs och startar om som den nya versionen ("Vad är nytt" visas),
        `dpkg -l codestead-hub`/`rpm -q codestead-hub` visar den nya versionen, framstegen finns kvar och inget
        `codestead-hub-update-*` ligger kvar i `/tmp`.
- [ ] Avinstallera med pakethanteraren.

## Hubben Codestead (Windows 10/11 och ett Linux-skrivbord)

- [ ] Installera hubben (`codestead-hub-…-Setup.exe` / paket / AppImage) och starta den.
- [ ] Listan visar Codestead Linux med beskrivning på valt språk.
- [ ] **Installera** → förloppet visas → **Öppna** startar Codestead Linux.
- [ ] Släpp en ny version av Codestead Linux: hubben visar **Uppdatera till …**, uppdaterar,
      och **Gå tillbaka till …** återställer den förra versionen.
- [ ] Koppla från nätet och starta hubben: den sparade listan visas och installerade verktyg kan startas.
- [ ] **Avinstallera**: verktyget försvinner, framstegen finns kvar efter en ny installation.

## Första TypeScript-releasen (Codestead Linux 0.6.6, Codestead GP 0.2.6, hubben 0.2.5)

Den första releasen efter bytet till TypeScript/Electron. Uppgraderingstestet i release-flödet gör detta på
Windows Server och i containrar; gör det en gång på riktiga datorer med en användares riktiga installation.

- [ ] Windows 10/11 med C#-versionerna installerade (Codestead Linux 0.6.5 och GP 0.2.5 med Setup.exe, hubben 0.2.4)
      och lite framsteg i dem: **Uppdatera** i appen → den startar om som den nya versionen, "Vad är nytt" visar
      0.6.6/0.2.6, framsteg, XP, utmärkelser, språk och tema finns kvar; genvägen i Start-menyn och "Installerade
      appar" visar den nya versionen.
- [ ] Samma med AppImage på ett Linux-skrivbord (den uppdaterar sig själv på plats).
- [ ] `.deb`/`.rpm`/Arch-paketet: installera den nya versionen över C#-versionen med pakethanteraren; appen startar
      och framstegen finns kvar.
- [ ] Hubben 0.2.4 (C#): den uppdaterar sig själv till 0.2.5 (Setup.exe, AppImage) eller erbjuder den som
      nedladdning; den nya hubben ser de installerade verktygen och uppdaterar Codestead Linux och GP till de nya
      versionerna, och **Gå tillbaka** på Codestead Linux startar C#-versionen 0.6.5 igen.
- [ ] Texten ser rimlig ut på kinesiska och japanska (Inter saknar de tecknen, så de tas från systemets typsnitt, som i C#-apparna).
