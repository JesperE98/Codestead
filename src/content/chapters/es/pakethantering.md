# Gestión de paquetes

En Windows y macOS es habitual descargar los programas de una página web. En
Linux, en cambio, casi todo se instala con un **gestor de paquetes**. Esta es
la mayor diferencia entre las familias de distribuciones, y este capítulo
cambia según la distribución que hayas elegido. Ahora mismo es **{{pm}}** en
{{distro}}.

## Paquetes, repositorios y dependencias

- Un **paquete** es un programa (o una biblioteca) empaquetado en un archivo,
  junto con información sobre su versión y lo que necesita.
- Un **repositorio** es un servidor en el que la distribución publica todos
  sus paquetes. Están probados y firmados, así que sabes que nadie los ha
  manipulado.
- Una **dependencia** es otro paquete que hace falta. El gestor de paquetes
  instala las dependencias automáticamente.

El gestor de paquetes también lleva la cuenta de lo que está instalado y puede
actualizar *todo* el ordenador con un solo comando.

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

Los comandos que modifican el sistema requieren root, así que se ejecutan con
`sudo`.

:::debian
## apt en {{distro}}

### update y upgrade son cosas distintas

Esto confunde a casi todo el mundo al principio:

- `apt update` descarga la **lista** de paquetes y versiones disponibles. No
  instala nada.
- `apt upgrade` **instala** las versiones nuevas de lo que ya tienes.

Así que ejecuta siempre `update` primero. La forma más habitual de actualizar
el sistema es:

```sh
sudo apt update && sudo apt upgrade
```

Antes de ejecutar `apt update` (por ejemplo, en un servidor recién instalado),
la lista de paquetes está vacía y apt no encuentra ningún paquete.

### Instalar y desinstalar

```sh
sudo apt install htop
```

`apt remove` desinstala un programa, pero deja sus archivos de configuración.
`apt purge` también los elimina. Cuando apt pregunta
`Do you want to continue? [Y/n]`, la `Y` mayúscula significa que con solo
pulsar Enter respondes que sí. Con la opción `-y`, apt responde que sí
automáticamente.

### ¿apt o apt-get?

`apt` es la variante moderna y fácil de usar, con barra de progreso y colores.
`apt-get` y `apt-cache` son más antiguos, pero su salida es más estable, por
eso se siguen usando en scripts.

### Por debajo: dpkg y .deb

Los paquetes son archivos `.deb`, y en realidad es el programa `dpkg` el que
los desempaqueta. apt se encarga de todo lo demás: la descarga, las
dependencias y las actualizaciones.
:::

:::arch
## pacman en {{distro}}

pacman usa opciones cortas en las que la **letra mayúscula** es la operación y
las minúsculas son modificadores:

| Opción | Significa |
|---|---|
| `-S` | Sync: instalar desde los repositorios |
| `-R` | Remove: desinstalar |
| `-Q` | Query: consultar los paquetes instalados |
| `y` | Refrescar la base de datos de paquetes |
| `u` | Actualizar todos los paquetes |
| `s` | Buscar (con -S y -Q), o eliminar dependencias (con -R) |
| `i` | Información |

### Actualizar el sistema

```sh
sudo pacman -Syu
```

`-Syu` significa: sincronizar (`S`), refrescar la base de datos (`y`) y
actualizar todo (`u`). Arch es una *rolling release*, así que lo ejecutarás a
menudo.

> **¡Importante!** Nunca ejecutes solo `pacman -Sy` seguido de
> `pacman -S paquete`. El paquete nuevo podría necesitar bibliotecas más
> nuevas que las que tienes: es lo que se llama una *actualización parcial*
> (*partial upgrade*), y puede romper el sistema. Usa siempre `-Syu`.

### Instalar y desinstalar

```sh
sudo pacman -S htop
```

`pacman -R paquete` desinstala un paquete, y `pacman -Rs paquete` también
elimina las dependencias que ya no necesita nadie.

### El AUR

Además de los repositorios oficiales existe el **AUR** (*Arch User
Repository*), donde los usuarios comparten recetas de compilación para miles
de programas. A menudo se usa un asistente como `yay` o `paru` para instalar
desde él. Arch no revisa los paquetes del AUR: lee siempre antes la receta de
compilación (el PKGBUILD).
:::

:::redhat
## dnf en {{distro}}

### Metadatos automáticos

dnf obtiene por sí solo la información nueva de los paquetes cuando la
necesita, así que no hay un paso aparte como `apt update`. Si quieres ver qué
actualizaciones hay disponibles, ejecuta:

```sh
dnf check-update
```

El código de salida es `100` si hay actualizaciones, algo útil en scripts.

### Instalar y desinstalar

```sh
sudo dnf install htop
```

Fíjate en la pregunta `Is this ok [y/N]`. La `N` mayúscula significa que **No**
es la respuesta por defecto: si solo pulsas Enter, la instalación se cancela.
Escribe `y` y pulsa Enter, o usa `-y`.

### Actualizar el sistema

```sh
sudo dnf upgrade
```

### Por debajo: rpm

Los paquetes son archivos `.rpm` y la herramienta de bajo nivel se llama
`rpm`. dnf sustituyó al antiguo `yum`, y Fedora 41 trajo la nueva versión
**dnf5**, que es bastante más rápida. En RHEL, Rocky y AlmaLinux el comando
también se llama `dnf`.
:::

## El mismo programa, nombres distintos

Los paquetes suelen llamarse igual en todas partes, pero no siempre. Algunos
ejemplos:

| Programa | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| Cliente SSH | `openssh-client` | `openssh` | `openssh-clients` |

Si no estás seguro del nombre, búscalo siempre con el gestor de paquetes.

## Formatos de paquete universales

También hay formatos que funcionan en todas las distribuciones: **Flatpak**
(habitual para aplicaciones de escritorio, a través de Flathub), **Snap** (de
Canonical, el predeterminado en Ubuntu) y **AppImage** (un único archivo
ejecutable). Tienen sus propios comandos y complementan al gestor de paquetes
de la distribución.
