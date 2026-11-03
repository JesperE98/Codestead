**Codestead** is the hub for the Codestead tools. It installs, starts and updates tools such as
Codestead Linux, for your user and without administrator rights.

## Download

| System | File | How to install |
|---|---|---|
| **Windows** 10/11 (x64) | `codestead-hub-<version>-win-x64-Setup.exe` | Run the file. The hub is installed for your user and added to the Start menu. It updates itself. |
| **Windows** (no installation) | `codestead-hub-<version>-win-x64.zip` | Unzip it and start `Codestead.Hub.exe`. |
| **Ubuntu / Debian** | `codestead-hub_<version>_amd64.deb` | `sudo apt install ./codestead-hub_<version>_amd64.deb` |
| **Fedora** | `codestead-hub-<version>-1.x86_64.rpm` | `sudo dnf install ./codestead-hub-<version>-1.x86_64.rpm` |
| **Arch Linux / CachyOS** | `codestead-hub-<version>-1-x86_64.pkg.tar.zst` | `sudo pacman -U codestead-hub-<version>-1-x86_64.pkg.tar.zst` |
| **Any Linux** | `codestead-hub-<version>-linux-x86_64.AppImage` | Run `chmod +x` on the file and start it. It updates itself. |

`SHA256SUMS.txt` contains checksums for all files.

## How the hub works

- The list of tools (`catalog.json` in the "catalog" release) is signed. The hub checks the signature
  and every downloaded file (size and SHA-256) before anything is installed.
- Tools are installed in `%LOCALAPPDATA%\Codestead\tools` (Windows) or
  `~/.local/share/codestead/tools` (Linux). The previous version is kept, so you can go back.
- If you uninstall a tool, your progress is kept.

### First start

The hub is not yet signed with a developer certificate:

- **Windows**: SmartScreen may show "Windows protected your PC". Click **More info** → **Run anyway**.
- **AppImage**: some distributions need FUSE 2 (Ubuntu: `sudo apt install libfuse2t64`).
- **AppImage on Fedora 45 and later**: install OpenSSL 3, which .NET still uses: `sudo dnf install openssl3-libs`
  (the `.rpm` package does this automatically).
