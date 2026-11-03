## Download

| System | File | How to install |
|---|---|---|
| **Windows** 10/11 (x64) | `codestead-linux-<version>-win-x64-Setup.exe` | Run the file. The app is installed for your user and added to the Start menu. It updates itself. |
| **Windows** (no installation) | `codestead-linux-<version>-win-x64.zip` | Unzip it and start `Codestead.Linux.exe`. |
| **Ubuntu / Debian** | `codestead-linux_<version>_amd64.deb` | `sudo apt install ./codestead-linux_<version>_amd64.deb` |
| **Fedora** | `codestead-linux-<version>-1.x86_64.rpm` | `sudo dnf install ./codestead-linux-<version>-1.x86_64.rpm` |
| **Arch Linux / CachyOS** | `codestead-linux-<version>-1-x86_64.pkg.tar.zst` | `sudo pacman -U codestead-linux-<version>-1-x86_64.pkg.tar.zst` |
| **Any Linux** | `codestead-linux-<version>-linux-x86_64.AppImage` | Run `chmod +x` on the file and start it. It updates itself. |

`SHA256SUMS.txt` contains checksums for all files.

On Arch Linux and CachyOS, fonts are needed to display Chinese, Japanese, Arabic and Hindi:
`sudo pacman -S noto-fonts noto-fonts-cjk`. The Ubuntu and Fedora packages suggest them automatically.

On Fedora 45 and later, the AppImage needs OpenSSL 3, which .NET still uses:
`sudo dnf install openssl3-libs`. The `.rpm` package installs it automatically.

### First start

The app is not yet signed with a developer certificate:

- **Windows**: SmartScreen may show "Windows protected your PC". Click **More info** → **Run anyway**.
- **AppImage**: some distributions need FUSE 2 (Ubuntu: `sudo apt install libfuse2t64`).
