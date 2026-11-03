# Flatpak, Snap y AppImage

Un paquete normal está compilado para una distribución y una versión
concretas. Para quien hace un programa de escritorio, eso es un problema: el
mismo programa hay que volver a empaquetarlo para Debian, Ubuntu, Fedora, Arch
y todas sus versiones. Los **formatos de paquete universales** lo resuelven
metiendo dentro del paquete casi todo lo que el programa necesita, de modo que
un mismo paquete funciona en cualquier distribución.

Los tres grandes son **Flatpak**, **Snap** y **AppImage**. No sustituyen al
gestor de paquetes de la distribución, sino que lo complementan, sobre todo
para programas de escritorio.

> El simulador solo tiene una terminal. Cuando inicias un programa gráfico,
> aparece una línea que dice que se habría abierto en una ventana.

## Cuatro maneras de instalar un programa

| | Paquete de la distribución | Flatpak | Snap | AppImage |
|---|---|---|---|---|
| Viene de | Los repositorios de la distribución | Flathub (u otros *remotes*) | Snap Store (Canonical) | El sitio web del desarrollador |
| Funciona en | Una distribución y versión | Todas | Todas las que tienen `snapd` | Todas (necesita FUSE) |
| Sandbox | No | Sí | Sí (salvo *classic*) | No |
| Tamaño | Pequeño: comparte bibliotecas con el sistema | Grande la primera vez (runtimes), luego compartido | Grande: cada snap y su base | Grande: todo en un archivo |
| Actualizaciones | Con el sistema (`apt upgrade` …) | `flatpak update` | Automáticas, en segundo plano | Tú mismo: descargas un archivo nuevo |
| Ideal para | Programas del sistema, herramientas de línea de comandos, servidores | Programas de escritorio | Ubuntu, escritorios y servidores | Programas sueltos, probar versiones nuevas |

Un **sandbox** (entorno aislado) significa que el programa solo puede acceder
a lo que se le ha permitido, por ejemplo la red o tu carpeta de descargas, en
lugar de a todo tu directorio personal.

```quiz
¿Qué formato se actualiza automáticamente en segundo plano?
- [ ] Flatpak
- [x] Snap
- [ ] AppImage
---
Los programas Flatpak se actualizan con `flatpak update`, y una AppImage se
sustituye descargando un archivo nuevo.
```

## Flatpak

Flatpak es el formato en el que la mayoría de las distribuciones se han puesto
de acuerdo para los programas de escritorio. Los programas se descargan de un
**remote** –casi siempre **Flathub**– y comparten **runtimes** comunes (por
ejemplo `org.gnome.Platform`), para que no todos los programas tengan que
traerlo todo consigo.

:::debian
### Instalar Flatpak

Flatpak no viene preinstalado en {{distro}}:

```sh
sudo apt update
sudo apt install flatpak
```
:::

:::arch
### Instalar Flatpak

Flatpak está en los repositorios de Arch:

```sh
sudo pacman -S flatpak
```
:::

:::redhat
### Flatpak en {{distro}}

Fedora Workstation trae Flatpak, con el remote propio de Fedora, `fedora`, ya
añadido:

```sh
flatpak --version
flatpak remotes
```
:::

### Añadir Flathub

```sh
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remotes
```

`--if-not-exists` hace que el comando no falle si Flathub ya está añadido, algo
útil en scripts y guías de instalación.

### Buscar, instalar y ejecutar

Cada programa tiene un **ID** escrito como un nombre de dominio al revés, por
ejemplo `org.gimp.GIMP`:

```sh
flatpak search gimp
flatpak install flathub org.gimp.GIMP
```

Flatpak muestra qué **permisos** quiere el programa y qué runtimes vienen con
él. Fíjate en el tamaño: el primer programa arrastra un runtime de varios
cientos de megabytes, pero el siguiente programa que use el mismo runtime
ocupa poco.

```sh
flatpak list
flatpak run org.gimp.GIMP
flatpak info --show-permissions org.gimp.GIMP
```

### Para todo el sistema o solo para ti

Sin opciones, Flatpak instala para **todo el sistema** (en
`/var/lib/flatpak`). En un escritorio, Flatpak te pide la contraseña en una
ventana, así que no hace falta sudo. Con `--user`, el programa se instala en tu
directorio personal (`~/.local/share/flatpak`) y ningún otro usuario lo ve. La
instalación de usuario tiene **sus propios remotes**, así que Flathub también
hay que añadirlo con `--user`:

```sh
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.videolan.VLC
flatpak list --user
```

```quiz
¿Qué pasa cuando instalas un Flatpak con `--user`?
- [ ] Se instala para todo el sistema, en `/var/lib/flatpak`
- [x] Acaba en tu directorio personal, y ningún otro usuario lo ve
- [ ] Se ejecuta sin sandbox
---
Recuerda que la instalación de usuario tiene sus propios remotes: Flathub
también hay que añadirlo con `--user`.
```

### Actualizar y desinstalar

```sh
flatpak update
flatpak uninstall --user org.videolan.VLC
flatpak uninstall --unused
```

`--unused` elimina los runtimes que ya no usa ningún programa instalado.

## Snap

Snap es el formato de **Canonical** y el predeterminado en Ubuntu; allí, por
ejemplo, Firefox es un snap. Los snaps vienen de la **Snap Store**, que
gestiona Canonical, y los administra el servicio `snapd`. Se actualizan
automáticamente en segundo plano.

:::debian
### Snap en Ubuntu y Debian

Ubuntu ya trae Snap. En Debian, primero instalas `snapd`:

```sh
sudo apt update
sudo apt install snapd
```
:::

:::arch
### Snap en Arch

Snap no está en los repositorios de Arch, solo en el AUR. Compílalo como en el
capítulo sobre la familia Arch:

```sh
sudo pacman -S --needed git base-devel
cd ~
git clone https://aur.archlinux.org/snapd.git
cd snapd
makepkg -si
```

En un sistema real también tienes que iniciar el servicio con
`sudo systemctl enable --now snapd.socket`. Es una señal de que Snap no se
siente en casa en Arch: allí casi todo el mundo usa Flatpak.
:::

:::redhat
### Snap en Fedora

Fedora apuesta por Flatpak, pero Snap está en los repositorios:

```sh
sudo dnf install snapd
```
:::

### Usar snap

```sh
snap list
snap find vlc
sudo snap install hello-world
hello-world
snap info hello-world
```

Los snaps instalados aparecen como programas en `/snap/bin`. Instalar y
desinstalar requiere root.

### Strict o classic

La mayoría de los snaps se ejecutan de forma **estricta** (*strict*) dentro de
un sandbox. Los programas que necesitan acceso a todo el sistema, como los
editores de código, se publican con **classic confinement**. En ese caso
tienes que aprobarlo tú mismo con `--classic`:

```sh
sudo snap install code
sudo snap install code --classic
```

```quiz
Un snap se publica con classic confinement. ¿Qué tienes que añadir para
instalarlo?
- [ ] `--user`
- [x] `--classic`
- [ ] `--channel=edge`
```

### Canales y actualizaciones

Cada snap tiene **canales** (*channels*): `stable`, `candidate`, `beta` y
`edge` (la última versión, sin probar). `snap info` los muestra y
`--channel=beta` elige otro. Las actualizaciones son automáticas, pero puedes
forzarlas y desinstalar snaps:

```sh
sudo snap refresh
sudo snap remove hello-world
```

Snap también tiene críticos: la Snap Store la gestiona solo Canonical, las
actualizaciones automáticas no se pueden desactivar del todo y los programas
pueden tardar en arrancar la primera vez.

## AppImage

Una **AppImage** es un programa entero en **un único archivo**. La descargas
del sitio web del programa, la haces ejecutable y la inicias: sin instalación
y sin root. Para deshacerte del programa, borras el archivo.

Ya hay una AppImage descargada en tu directorio personal, en
`~/{{downloads}}`:

```sh
cd ~/{{downloads}}
ls -l
```

```text
total 47184
-rw-r--r-- 1 {{user}} {{user}} 48312832 Oct 30 12:00 {{calculator}}
```

Los mensajes de error de bash tienen la forma `bash: RUTA: MOTIVO`, y la ruta
se muestra tal como la ve bash: con `~` ya sustituido por `/home/{{user}}`.
¿Qué pasa si inicias el archivo directamente?

```predict
$ ~/{{downloads}}/{{calculator}}
bash: /home/{{user}}/{{downloads}}/{{calculator}}: Permission denied
---
El archivo no tiene el permiso `x`.
```

Los archivos descargados nunca son ejecutables de entrada. Hazla ejecutable e
iníciala:

```sh
chmod +x {{calculator}}
./{{calculator}}
```

```try
chmod +x ~/{{downloads}}/{{calculator}}
---
Ahora el archivo es ejecutable. Compruébalo con `ls -l ~/{{downloads}}`.
```

### FUSE

Una AppImage se monta a sí misma como sistema de archivos mediante **FUSE**, y
necesita la versión antigua 2 de la biblioteca (`libfuse.so.2`). Sin ella
obtienes el error *"AppImages require FUSE to run"*.

:::debian
En Ubuntu 24.04 y Debian 13 el paquete se llama `libfuse2t64` (*t64* viene de
la transición al tiempo de 64 bits; en versiones anteriores se llamaba
`libfuse2`):

```sh
sudo apt update
sudo apt install libfuse2t64
./{{calculator}}
```

> **No** instales el paquete `fuse` en Ubuntu: sustituye a `fuse3`, que el
> escritorio necesita.
:::

:::arch
En Arch el paquete se llama `fuse2`:

```sh
sudo pacman -S fuse2
./{{calculator}}
```
:::

:::redhat
En Fedora el paquete se llama `fuse-libs`:

```sh
sudo dnf install fuse-libs
./{{calculator}}
```
:::

### Mirar por dentro

Una AppImage también se puede desempaquetar. Eso funciona incluso sin FUSE:

```sh
./{{calculator}} --appimage-extract
ls squashfs-root
./squashfs-root/AppRun
```

`--appimage-extract-and-run` la desempaqueta temporalmente y la inicia
enseguida.

### Ten en cuenta

- AppImage **no tiene sandbox**: el programa se ejecuta como tú y puede
  acceder a todo lo que puedes acceder tú. Descárgalas solo del sitio web
  oficial del programa.
- **No hay actualizaciones automáticas**. Descargas un archivo nuevo cuando
  sale una versión nueva (algunos programas pueden actualizarse solos).
- El programa no aparece por sí solo en el menú de aplicaciones.
  Herramientas como *Gear Lever* o *AppImageLauncher* pueden arreglarlo.

## ¿Cuál elijo?

1. **Los paquetes de la distribución** para programas del sistema y de línea
   de comandos: son los más pequeños y rápidos, y se actualizan con el resto
   del sistema.
2. **Flatpak** para programas de escritorio cuando quieres una versión más
   nueva o un programa que no está en los repositorios.
3. **Snap** si usas Ubuntu, o cuando el programa solo existe como snap.
4. **AppImage** para probar rápidamente un programa, o cuando el desarrollador
   solo ofrece ese formato.
