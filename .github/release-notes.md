## Ladda ner

| System | Fil | Så installerar du |
|---|---|---|
| **Windows** 10/11 (x64) | `codestead-linux-<version>-win-x64-Setup.exe` | Kör filen. Appen installeras för din användare och läggs i Start-menyn. Den uppdaterar sig själv. |
| **Windows** (utan installation) | `codestead-linux-<version>-win-x64.zip` | Packa upp och starta `Codestead.Linux.exe`. |
| **Ubuntu / Debian** | `codestead-linux_<version>_amd64.deb` | `sudo apt install ./codestead-linux_<version>_amd64.deb` |
| **Fedora** | `codestead-linux-<version>-1.x86_64.rpm` | `sudo dnf install ./codestead-linux-<version>-1.x86_64.rpm` |
| **Arch Linux / CachyOS** | `codestead-linux-<version>-1-x86_64.pkg.tar.zst` | `sudo pacman -U codestead-linux-<version>-1-x86_64.pkg.tar.zst` |
| **Alla Linux** | `codestead-linux-<version>-linux-x86_64.AppImage` | `chmod +x` på filen och starta den. Den uppdaterar sig själv. |

`SHA256SUMS.txt` innehåller kontrollsummor för alla filer.

På Arch Linux och CachyOS behövs typsnitt för att kinesiska, japanska, arabiska och hindi ska visas:
`sudo pacman -S noto-fonts noto-fonts-cjk`. Paketen för Ubuntu och Fedora föreslår dem automatiskt.

### Första starten

Appen är ännu inte signerad med något utvecklarcertifikat:

- **Windows**: SmartScreen kan visa "Windows skyddade datorn". Klicka på **Mer information** → **Kör ändå**.
- **AppImage**: vissa distributioner behöver FUSE 2 (Ubuntu: `sudo apt install libfuse2t64`).
