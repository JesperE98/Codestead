# Resumen: Distribuciones y paquetes

## Familias

Lo básico es igual en todas las distribuciones: el núcleo Linux, bash y las
herramientas GNU, la estructura de directorios y (casi en todas partes)
systemd. Lo que distingue a las familias es sobre todo cómo se instalan los
programas.

| | Familia Debian | Familia Arch | Familia Red Hat |
|---|---|---|---|
| Ejemplos | Debian, Ubuntu, Linux Mint | Arch, Manjaro, EndeavourOS | Fedora, RHEL, Rocky Linux |
| Gestor de paquetes | `apt` | `pacman` | `dnf` |
| Formato de paquete | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Herramienta de bajo nivel | `dpkg` | (pacman) | `rpm` |
| Grupo de sudo | `sudo` | `wheel` | `wheel` |
| Publicaciones | Versiones estables | Continuas (*rolling*) | Una versión nueva cada 6 meses (Fedora) |

- `cat /etc/os-release` muestra qué distribución estás usando, y `uname -r`
  muestra la versión del núcleo.
- Un **paquete** es un programa empaquetado en un archivo, un **repositorio**
  es un servidor con los paquetes probados y firmados de la distribución, y
  una **dependencia** es otro paquete que hace falta: el gestor de paquetes lo
  instala automáticamente.
- Los comandos que modifican el sistema requieren root, así que se ejecutan
  con `sudo`.

## Lo mismo en tres dialectos

| Qué | apt (Debian) | pacman (Arch) | dnf (Red Hat) |
|---|---|---|---|
| Refrescar la lista de paquetes | `apt update` | `pacman -Sy` | `dnf check-update` |
| Actualizar todo | `apt upgrade` | `pacman -Syu` | `dnf upgrade` |
| Instalar | `apt install X` | `pacman -S X` | `dnf install X` |
| Desinstalar | `apt remove X` | `pacman -R X` | `dnf remove X` |
| Buscar | `apt search X` | `pacman -Ss X` | `dnf search X` |
| Información del paquete | `apt show X` | `pacman -Si X` | `dnf info X` |
| Listar los instalados | `apt list --installed` | `pacman -Q` | `dnf list --installed` |

Cosas que debes recordar:

- **apt**: `apt update` solo descarga la lista de paquetes; `apt upgrade`
  instala las versiones nuevas. Ejecuta `update` primero. `[Y/n]` significa
  que Intro responde que sí.
- **pacman**: la letra mayúscula es la operación (`-S`, `-R`, `-Q`) y las
  minúsculas son modificadores. Actualiza siempre con `-Syu`, nunca con `-Sy`
  seguido de `-S paquete` (una actualización parcial puede romper el sistema).
- **dnf**: obtiene la información de los paquetes por sí mismo.
  `dnf check-update` termina con `100` cuando hay actualizaciones. `[y/N]`
  significa que Intro responde que **no**.

Los nombres de los paquetes suelen ser iguales en todas partes, pero no
siempre: Vim se llama `vim-enhanced` en Fedora. Busca si no estás seguro.

## Repositorios adicionales

| | PPA | AUR | COPR |
|---|---|---|---|
| Familia | Ubuntu (y p. ej. Linux Mint) | Arch (y p. ej. Manjaro, EndeavourOS) | Fedora (y la familia RHEL) |
| Qué descargas | Paquetes `.deb` ya hechos | Una receta de compilación (`PKGBUILD`): lo compilas tú | Paquetes `.rpm` ya hechos |
| Cómo se añade | `add-apt-repository ppa:…` | `git clone …` y `makepkg -si` | `dnf copr enable …` |
| Se actualiza con | `sudo apt update && sudo apt upgrade` | `yay -Syu`, o recompilando tú mismo | `sudo dnf upgrade` |
| Eliminar el repositorio | `sudo add-apt-repository --remove ppa:…` | – (no hay ningún repositorio que eliminar) | `sudo dnf copr remove …` |
| Revisado por la distribución | No | No | No |

- Los paquetes de un repositorio adicional se instalan como root, pueden
  chocar con los paquetes propios del sistema y pueden dejar de actualizarse.
  Busca primero en los repositorios de la distribución, luego un Flatpak, y
  solo después en un repositorio adicional de alguien en quien confíes.
- `apt policy` muestra de dónde viene un paquete; apt elige la versión más
  alta.
- Lee siempre el `PKGBUILD` antes de compilar. No ejecutes `makepkg` con
  sudo. `pacman -Qm` lista los paquetes *foreign*, y `pacman -Syu` no los
  actualiza; un AUR helper como `yay` sí lo hace.

## Paquetes universales

| | Flatpak | Snap | AppImage |
|---|---|---|---|
| Viene de | Flathub (u otros *remotes*) | Snap Store (Canonical) | El sitio web del desarrollador |
| Sandbox | Sí | Sí (salvo *classic*) | No |
| Actualizaciones | `flatpak update` | Automáticas, en segundo plano | Tú mismo: descargas un archivo nuevo |
| Instalar | `flatpak install flathub ID` | `sudo snap install name` | `chmod +x file` y ejecutarlo |

- Los programas Flatpak tienen un ID escrito como un nombre de dominio al
  revés (`org.gimp.GIMP`) y se inician con `flatpak run`. `--user` instala en
  tu directorio personal, con sus propios remotes.
- Snap es lo predeterminado en Ubuntu. Los snaps con confinamiento classic
  necesitan `--classic`, y cada snap tiene canales como `stable` y `edge`.
- Un AppImage necesita FUSE 2 (`libfuse2t64` en Ubuntu 24.04 y Debian 13,
  `fuse2` en Arch, `fuse-libs` en Fedora) y no tiene sandbox ni
  actualizaciones automáticas.

**Regla general:** los paquetes de la distribución para programas del sistema
y de línea de comandos, Flatpak para programas de escritorio, Snap en Ubuntu o
cuando un programa solo existe como snap, y AppImage para probar un programa
rápidamente.
