# Distribuciones y familias

Ya conoces lo básico, y funciona igual en todas las distribuciones. Entonces,
¿qué es lo que las diferencia?

:::debian
Ahora mismo estás usando **{{distro}}**, de la **familia Debian**.
:::

:::arch
Ahora mismo estás usando **{{distro}}**, de la **familia Arch**.
:::

:::redhat
Ahora mismo estás usando **{{distro}}**, de la **familia Red Hat**.
:::

Este capítulo es una visión general. Puedes cambiar de distribución en el menú
de la parte superior y volver a hacer las tareas: verás las diferencias
enseguida. Después de este capítulo viene un capítulo para cada familia: la
**familia Debian** (apt), la **familia Arch** (pacman) y la **familia Red
Hat** (dnf). Cada uno se ejecuta siempre en una distribución de esa familia,
así que puedes hacer los tres.

## ¿Qué es igual en todas partes?

- **El kernel Linux**, aunque en distintas versiones.
- **La shell bash** y las herramientas básicas (`ls`, `cp`, `grep` ...) de GNU.
- **La estructura de directorios**: `/etc`, `/home`, `/usr/bin`, etc.
- **systemd**, que arranca el sistema y gestiona los servicios, en casi todas
  las distribuciones importantes.

```predict
$ echo $SHELL
/bin/bash
---
La shell es bash en todas las distribuciones del simulador, elijas la que
elijas.
```

## ¿Qué cambia?

| | Familia Debian | Familia Arch | Familia Red Hat |
|---|---|---|---|
| Gestor de paquetes | `apt` | `pacman` | `dnf` |
| Formato de paquete | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Herramienta de bajo nivel | `dpkg` | (pacman) | `rpm` |
| Grupo de sudo | `sudo` | `wheel` | `wheel` |
| Publicaciones | Versiones estables | Continuas (*rolling*) | Una versión nueva cada 6 meses (Fedora) |

```quiz
¿En qué familias se llama `wheel` el grupo que puede usar sudo?
- [ ] La familia Debian
- [x] La familia Arch
- [x] La familia Red Hat
---
La familia Debian llama al grupo `sudo`; Arch y Red Hat lo llaman `wheel`.
```

### Modelos de publicación

- **Estable con versiones fijas**: Debian publica una versión nueva más o menos
  cada dos años, y Ubuntu LTS (*Long Term Support*) sale cada dos años con
  cinco años de soporte. Los programas reciben correcciones de seguridad, pero
  rara vez se sustituyen por versiones más nuevas. Ideal para servidores.
- **Continua (*rolling*)**: Arch no tiene versiones. Actualizas de forma
  continua y siempre tienes lo último. Te exige un poco más como usuario.
- **De ritmo rápido**: Fedora publica una versión nueva aproximadamente cada
  seis meses y sirve como una especie de banco de pruebas para Red Hat
  Enterprise Linux (RHEL), que a su vez tiene diez años de soporte y lo usan
  las empresas.

```quiz
¿Qué distribución no tiene versiones, sino que se actualiza de forma continua
(*rolling*)?
- [ ] Debian
- [ ] Ubuntu LTS
- [x] Arch
- [ ] Fedora
```

## ¿Qué distribución estoy usando?

El archivo `/etc/os-release` existe en todas las distribuciones modernas e
indica el nombre y la versión:

```sh
cat /etc/os-release
```

La versión del kernel se muestra con `uname -r`:

```sh
uname -r
```

```try
cat /etc/os-release
---
Las líneas `NAME` y `PRETTY_NAME` te dicen qué distribución es.
```

## Paquetes, repositorios y dependencias

En Windows y macOS es habitual descargar los programas de una página web. En
Linux, en cambio, casi todo se instala con un **gestor de paquetes**. Esta es
la mayor diferencia entre las familias de distribuciones.

- Un **paquete** es un programa (o una biblioteca) empaquetado en un archivo,
  junto con información sobre su versión y lo que necesita.
- Un **repositorio** es un servidor en el que la distribución publica todos
  sus paquetes. Están probados y firmados, así que sabes que nadie los ha
  manipulado.
- Una **dependencia** es otro paquete que hace falta. El gestor de paquetes
  instala las dependencias automáticamente.

El gestor de paquetes también lleva la cuenta de lo que está instalado y puede
actualizar *todo* el ordenador con un solo comando. Los comandos que modifican
el sistema requieren root, así que se ejecutan con `sudo`.

```quiz
Un paquete necesita otro paquete que no tienes. ¿Qué pasa cuando lo instalas
con el gestor de paquetes?
- [ ] La instalación se detiene y tienes que buscar tú el otro paquete
- [x] El gestor de paquetes instala la dependencia automáticamente
- [ ] El paquete se instala, pero no funciona hasta que descargues el otro
```

### El mismo programa, nombres distintos

Los paquetes suelen llamarse igual en todas partes, pero no siempre. Algunos
ejemplos:

| Programa | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| Cliente SSH | `openssh-client` | `openssh` | `openssh-clients` |

Si no estás seguro del nombre, búscalo siempre con el gestor de paquetes.

## La configuración del gestor de paquetes

:::debian
En la familia Debian, los archivos de `/etc/apt/sources.list.d/` indican de
qué *repositorios* obtiene apt los paquetes:

```sh
ls /etc/apt/sources.list.d
```
:::

:::arch
En la familia Arch, pacman se configura en `/etc/pacman.conf`, y la lista de
servidores espejo (*mirrors*) está en `/etc/pacman.d/mirrorlist`:

```sh
cat /etc/pacman.conf
```
:::

:::redhat
En la familia Red Hat, la configuración de dnf está en `/etc/dnf/dnf.conf`, y
los *repositorios* se describen en archivos de `/etc/yum.repos.d/`:

```sh
ls /etc/yum.repos.d
```
:::

## ¿Cuál debería elegir?

No hay una respuesta correcta, pero aquí tienes una regla general:

- **¿Eres nuevo en Linux?** Ubuntu, Linux Mint o Fedora.
- **¿Un servidor?** Debian, Ubuntu LTS o un clon de RHEL como Rocky Linux.
- **¿Quieres aprender cómo encaja todo?** Arch, y su excelente wiki.
