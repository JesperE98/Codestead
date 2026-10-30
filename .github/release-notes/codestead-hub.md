**Codestead** är hubben för Codestead-verktygen. Den installerar, startar och uppdaterar till exempel
Codestead Linux, för din användare och utan administratörsrättigheter.

## Ladda ner

| System | Fil | Så installerar du |
|---|---|---|
| **Windows** 10/11 (x64) | `codestead-hub-<version>-win-x64-Setup.exe` | Kör filen. Hubben installeras för din användare och läggs i Start-menyn. Den uppdaterar sig själv. |
| **Windows** (utan installation) | `codestead-hub-<version>-win-x64.zip` | Packa upp och starta `Codestead.Hub.exe`. |
| **Ubuntu / Debian** | `codestead-hub_<version>_amd64.deb` | `sudo apt install ./codestead-hub_<version>_amd64.deb` |
| **Fedora** | `codestead-hub-<version>-1.x86_64.rpm` | `sudo dnf install ./codestead-hub-<version>-1.x86_64.rpm` |
| **Arch Linux / CachyOS** | `codestead-hub-<version>-1-x86_64.pkg.tar.zst` | `sudo pacman -U codestead-hub-<version>-1-x86_64.pkg.tar.zst` |
| **Alla Linux** | `codestead-hub-<version>-linux-x86_64.AppImage` | `chmod +x` på filen och starta den. Den uppdaterar sig själv. |

`SHA256SUMS.txt` innehåller kontrollsummor för alla filer.

## Så fungerar hubben

- Listan över verktyg (`catalog.json` i releasen "catalog") är signerad. Hubben kontrollerar signaturen
  och varje nedladdad fil (storlek och SHA-256) innan något installeras.
- Verktygen installeras i `%LOCALAPPDATA%\Codestead\tools` (Windows) respektive
  `~/.local/share/codestead/tools` (Linux). Den föregående versionen sparas, så du kan gå tillbaka.
- Avinstallerar du ett verktyg finns dina framsteg kvar.

### Första starten

Hubben är ännu inte signerad med något utvecklarcertifikat:

- **Windows**: SmartScreen kan visa "Windows skyddade datorn". Klicka på **Mer information** → **Kör ändå**.
- **AppImage**: vissa distributioner behöver FUSE 2 (Ubuntu: `sudo apt install libfuse2t64`).
