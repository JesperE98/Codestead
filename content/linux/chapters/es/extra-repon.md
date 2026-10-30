# AUR, PPA y COPR

Los repositorios de la distribución contienen decenas de miles de paquetes,
pero no todo. Puede que un programa de nicho no esté, o que solo esté en una
versión antigua. Por eso existen los **repositorios adicionales**, donde
desarrolladores y usuarios comparten sus propios paquetes. Cada familia tiene
el suyo: los **PPA** en Ubuntu, el **AUR** en Arch y **COPR** en Fedora.

En este capítulo instalas el mismo programa inventado, `moonphase` (muestra la
fase de la luna en la terminal), desde el repositorio adicional de
{{distro}}. Cambia de distribución en el menú si quieres comparar cómo
funciona en las otras familias.

## Cómodo, pero bajo tu propia responsabilidad

Los paquetes de los repositorios propios de la distribución se prueban juntos,
están firmados y los revisan los desarrolladores de la distribución. Un
repositorio adicional, en cambio, lo puede crear cualquiera. Tenlo en cuenta
antes de añadir uno:

- **Los paquetes se instalan como root.** Un paquete puede hacerle cualquier
  cosa al ordenador. Confías en quien lo ha creado tanto como en la
  distribución.
- **Puede haber choques.** Un paquete de un repositorio adicional puede
  sustituir bibliotecas del propio sistema o necesitar otras versiones de las
  que tienes.
- **Puede dejar de actualizarse.** Si quien mantiene el repositorio pierde el
  interés, ya no recibirás actualizaciones de seguridad del programa.

Una buena regla práctica: busca primero en los repositorios de la
distribución, después un Flatpak (siguiente capítulo) y, solo después, en un
repositorio adicional de alguien de confianza.

## Tres familias, tres soluciones

| | PPA | AUR | COPR |
|---|---|---|---|
| Familia | Ubuntu (y, por ejemplo, Linux Mint) | Arch (y, por ejemplo, Manjaro, EndeavourOS) | Fedora (y la familia RHEL) |
| Sitio web | launchpad.net | aur.archlinux.org | copr.fedorainfracloud.org |
| Qué descargas | Paquetes `.deb` ya hechos | Una receta de compilación (`PKGBUILD`): la compilas tú | Paquetes `.rpm` ya hechos |
| Cómo se añade | `add-apt-repository ppa:…` | `git clone …` y `makepkg -si` | `dnf copr enable …` |
| Revisado por la distribución | No | No | No |

:::debian
## PPA en {{distro}}

Un **PPA** (*Personal Package Archive*) es un pequeño repositorio en
Launchpad, el servicio de Canonical para Ubuntu. El desarrollador sube el
código fuente y Launchpad compila paquetes `.deb` para distintas versiones de
Ubuntu. Un PPA se escribe `ppa:usuario/nombre`.

### La herramienta add-apt-repository

Los PPA se añaden con `add-apt-repository`, que está en el paquete
`software-properties-common`. Viene preinstalado en Ubuntu, pero no en Debian:

```sh
sudo apt update
sudo apt install software-properties-common
```

### Añadir el PPA

```sh
sudo add-apt-repository ppa:lunatool/moonphase
```

Verás qué se añade y una descripción del PPA. Pulsa Intro para continuar (con
`-y` te saltas la pregunta). Pasan dos cosas:

1. Se crea un archivo en `/etc/apt/sources.list.d/`. Indica dónde está el
   repositorio y contiene la clave con la que se firman los paquetes.
2. `add-apt-repository` ejecuta `apt update` por ti; si no, apt no sabría
   nada de los paquetes nuevos. Si añades una fuente a mano (creando un
   archivo), tienes que ejecutar tú mismo `sudo apt update` después.

Mira el archivo:

```sh
ls /etc/apt/sources.list.d
cat /etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources
```

Fíjate en `Suites: noble`: los paquetes están compilados para Ubuntu 24.04.

### Instalar y ejecutar

Ahora el paquete se instala como cualquier otro:

```sh
sudo apt install moonphase
moonphase
```

### ¿De dónde viene el paquete?

`apt policy` muestra en qué repositorios está un paquete y cuál gana:

```sh
apt policy moonphase
```

`***` marca la versión instalada. El número `500` es la prioridad del
repositorio y `100` significa «lo que ya está instalado». Si el mismo paquete
está en varios repositorios, apt elige la versión más alta, así que un PPA
puede sustituir uno de los paquetes propios de la distribución por su propia
versión.

### ¿PPA en Debian?

Los PPA se compilan para Ubuntu, no para Debian. En Debian puede que
funcionen, pero los paquetes pueden necesitar otras versiones de bibliotecas
que las que tiene Debian. A una mezcla de paquetes de Debian y Ubuntu se la
llama en broma *FrankenDebian*, y es una forma habitual de romper el sistema.
En Debian es mejor usar los *backports*, un Flatpak o el repositorio propio
del desarrollador para Debian.

### Eliminar un PPA

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

El programa se queda, pero ya no recibe actualizaciones. Para quitarlo del
todo, ejecuta también `sudo apt remove moonphase`.
:::

:::arch
## El AUR en {{distro}}

El **AUR** (*Arch User Repository*) es distinto de los demás: no hay paquetes
ya hechos, solo **recetas de compilación**. Una receta se llama `PKGBUILD` y
es un pequeño script de bash que dice dónde está el código fuente y cómo se
compila el programa. Descargas la receta, compilas tú mismo el paquete y lo
instalas con pacman. El AUR es enorme –casi todo lo que existe para Linux está
ahí–, pero cualquiera puede subir una receta.

### Preparativos

Para descargar recetas y compilar paquetes necesitas `git` y `base-devel` (un
compilador, `make`, `fakeroot` y más):

```sh
sudo pacman -S --needed git base-devel
```

`--needed` se salta lo que ya está instalado.

### Descargar la receta

Cada paquete del AUR es un repositorio git propio:

```sh
cd ~
git clone https://aur.archlinux.org/moonphase.git
cd moonphase
ls
```

> Si escribes mal el nombre del paquete, git dice *"You appear to have cloned
> an empty repository"* y el directorio queda vacío. ¡El AUR te deja clonar
> cualquier cosa!

### Lee el PKGBUILD, siempre

```sh
less PKGBUILD
```

`PKGBUILD` es un script que se ejecuta en tu ordenador. Comprueba al menos:

- que `source=` descarga desde el sitio web real del programa,
- que `build()` y `package()` solo compilan y copian archivos, y que no, por
  ejemplo, descargan y ejecutan otra cosa (`curl … | sh`),
- que el paquete parece mantenido (fechas, comentarios en aur.archlinux.org).

### Compilar e instalar

```sh
makepkg -si
```

`makepkg` lee `PKGBUILD`, descarga el código fuente, lo compila y lo empaqueta
en un archivo `.pkg.tar.zst`. `-s` instala las dependencias que falten e `-i`
instala el paquete con pacman cuando termina. **No** ejecutes makepkg con
sudo: se niega a ejecutarse como root y usa sudo por su cuenta cuando hace
falta.

```sh
ls
moonphase
```

### Paquetes «foreign»

pacman no sabe nada del AUR. Los paquetes que no vienen de los repositorios se
llaman *foreign* (ajenos) y se listan con:

```sh
pacman -Qm
```

Eso también significa que `sudo pacman -Syu` **no** actualiza los paquetes del
AUR. Tienes que descargar tú la receta nueva (`git pull`) y volver a
compilar, o dejar que lo haga un AUR helper.

### El AUR helper yay

Un AUR helper hace todo esto por ti: busca, descarga, muestra el `PKGBUILD`,
compila e instala. El más habitual es **yay** (otro es *paru*). El propio yay
solo existe en el AUR, así que se instala a mano una vez. El paquete `yay-bin`
viene precompilado y es el más rápido:

```sh
cd ~
git clone https://aur.archlinux.org/yay-bin.git
cd yay-bin
makepkg -si
```

Después, yay se usa de forma muy parecida a pacman, pero sin sudo:

```sh
yay -Ss snowfall
yay -S snowfall
snowfall
yay -Syu
```

`yay -Syu` (o simplemente `yay`) actualiza tanto los paquetes de los
repositorios como tus paquetes del AUR. ¡Que sea cómodo no significa que
puedas dejar de leer las recetas!
:::

:::redhat
## COPR en {{distro}}

**COPR** (*Cool Other Package Repo*) es el servicio de compilación de Fedora.
Cualquiera con una cuenta de Fedora puede compilar paquetes `.rpm` allí, y cada
proyecto se convierte en un repositorio propio llamado `usuario/proyecto`.

### Los repositorios que tienes ahora

```sh
dnf repolist
```

### Activar un repositorio COPR

```sh
sudo dnf copr enable lunatool/moonphase
```

dnf te recuerda que el repositorio no forma parte de Fedora y que la calidad
puede variar. La respuesta por defecto es **No**, así que responde `y`. Se crea
un archivo nuevo en `/etc/yum.repos.d/`:

```sh
ls /etc/yum.repos.d
dnf copr list
dnf repolist
```

### Instalar y ejecutar

dnf obtiene por su cuenta la información del repositorio nuevo, así que el
paquete se puede instalar enseguida:

```sh
sudo dnf install moonphase
moonphase
```

### ¿De dónde viene el paquete?

```sh
dnf info moonphase
```

La línea `From repository` muestra que el paquete viene de COPR. Los paquetes
de COPR se actualizan como siempre, con `sudo dnf upgrade`.

### Desactivar o eliminar

```sh
sudo dnf copr disable lunatool/moonphase
dnf copr list
```

`disable` deja el archivo en su sitio pero desactiva el repositorio; `remove`
lo elimina por completo. El programa se queda, pero ya no recibe
actualizaciones.

### RPM Fusion

Otro repositorio adicional habitual en Fedora es **RPM Fusion**. Tiene cosas
que Fedora no puede o no quiere incluir, como ciertos códecs multimedia y
drivers. Es un proyecto grande y compartido, no el repositorio de un solo
usuario como en COPR.
:::

## Actualizaciones y mantenimiento

| | Se actualiza con | Eliminar el repositorio |
|---|---|---|
| PPA | `sudo apt update && sudo apt upgrade` | `sudo add-apt-repository --remove ppa:…` |
| AUR | `yay -Syu`, o compilando tú de nuevo | – (no hay repositorio que eliminar) |
| COPR | `sudo dnf upgrade` | `sudo dnf copr remove …` |

Los repositorios adicionales son una herramienta potente, pero cada
repositorio que añades es un remitente más en el que confías. Mantén la lista
corta y elimina lo que ya no uses.
