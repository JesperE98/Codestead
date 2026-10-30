## Ladda ner

Välj filen för ditt operativsystem. En macOS-version kommer senare.

| Operativsystem | Fil | Så installerar du |
|---|---|---|
| **Windows** 10/11 | `LinuxLearningTool-Setup-Windows.exe` | Kör filen och följ installationsguiden. |
| **Linux** (x86_64) | `LinuxLearningTool-Linux-x86_64.AppImage` | Gör filen körbar (`chmod +x`) och starta den. |

### Första starten

Appen är ännu inte signerad med något utvecklarcertifikat, så operativsystemet varnar första gången:

- **Windows**: SmartScreen visar "Windows skyddade datorn". Klicka på **Mer information** → **Kör ändå**.
- **Linux**: Vissa distributioner behöver paketet `libfuse2` (Ubuntu: `sudo apt install libfuse2t64`) för att köra AppImage-filer.
