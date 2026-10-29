## Ladda ner

Välj filen för ditt operativsystem:

| Operativsystem | Fil | Så installerar du |
|---|---|---|
| **Windows** 10/11 | `LinuxLearningTool-Setup-Windows.exe` | Kör filen och följ installationsguiden. |
| **macOS** (Intel och Apple Silicon) | `LinuxLearningTool-macOS.dmg` | Öppna filen och dra appen till Program. |
| **Linux** (x86_64) | `LinuxLearningTool-Linux-x86_64.AppImage` | Gör filen körbar (`chmod +x`) och starta den. |

### Första starten

Appen är ännu inte signerad med något utvecklarcertifikat, så operativsystemet varnar första gången:

- **Windows**: SmartScreen visar "Windows skyddade datorn". Klicka på **Mer information** → **Kör ändå**.
- **macOS**: Om appen inte går att öppna, gå till **Systeminställningar → Integritet och säkerhet** och klicka **Öppna ändå**.
  Säger macOS att appen är "skadad" kör du `xattr -cr /Applications/LinuxLearningTool.app` i Terminal.
- **Linux**: Vissa distributioner behöver paketet `libfuse2` (Ubuntu: `sudo apt install libfuse2t64`) för att köra AppImage-filer.
