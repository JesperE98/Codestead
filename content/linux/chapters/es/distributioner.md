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

Puedes cambiar de distribución en el menú de la parte superior y volver a
hacer las tareas: verás las diferencias enseguida.

## ¿Qué es igual en todas partes?

- **El kernel Linux**, aunque en distintas versiones.
- **La shell bash** y las herramientas básicas (`ls`, `cp`, `grep` ...) de GNU.
- **La estructura de directorios**: `/etc`, `/home`, `/usr/bin`, etc.
- **systemd**, que arranca el sistema y gestiona los servicios, en casi todas
  las distribuciones importantes.

## ¿Qué cambia?

| | Familia Debian | Familia Arch | Familia Red Hat |
|---|---|---|---|
| Gestor de paquetes | `apt` | `pacman` | `dnf` |
| Formato de paquete | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Herramienta de bajo nivel | `dpkg` | (pacman) | `rpm` |
| Grupo de sudo | `sudo` | `wheel` | `wheel` |
| Publicaciones | Versiones estables | Continuas (*rolling*) | Una versión nueva cada 6 meses (Fedora) |

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
