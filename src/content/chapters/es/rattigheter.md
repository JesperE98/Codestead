# Usuarios, permisos y sudo

Linux está pensado para que varios usuarios puedan compartir el mismo
ordenador. Por eso cada archivo tiene un propietario y unas reglas sobre quién
puede hacer qué.

## Usuarios y grupos

Has iniciado sesión como el usuario `elev`. Cada usuario pertenece a uno o
más **grupos**:

```sh
id
```

El usuario más importante es **root**: el administrador, que tiene permiso
para hacerlo todo. Rara vez se inicia sesión como root. En su lugar se usa
`sudo` (ver más abajo).

## Leer los permisos

Ejecuta `ls -l` y fíjate en la primera columna:

```text
-rw-r--r-- 1 elev elev  174 Oct 29 13:55 anteckningar.txt
drwxr-xr-x 2 elev elev 4096 Oct 29 13:55 dokument
```

El primer carácter es el tipo: `-` para un archivo, `d` para un directorio.
Después vienen tres grupos de tres caracteres cada uno:

```text
-     rw-          r--     r--
tipo  propietario  grupo   otros
```

| Carácter | En un archivo | En un directorio |
|---|---|---|
| `r` (read, leer) | Leer el contenido | Listar el contenido |
| `w` (write, escribir) | Modificar el contenido | Crear y eliminar archivos dentro |
| `x` (execute, ejecutar) | Ejecutar el archivo como programa | Entrar en el directorio con `cd` |

A continuación vienen el propietario (`elev`) y el grupo (`elev`).

## Cambiar los permisos – `chmod`

Los permisos se pueden indicar con **números**. Cada grupo recibe una cifra
que es la suma de r = 4, w = 2 y x = 1:

| Número | Permisos | Típico para |
|---|---|---|
| `755` | `rwxr-xr-x` | Programas y directorios |
| `644` | `rw-r--r--` | Archivos normales |
| `600` | `rw-------` | Archivos secretos |

```sh
chmod 644 anteckningar.txt
```

O con **símbolos**: `u` (el propietario), `g` (el grupo), `o` (los otros), `a`
(todos), seguidos de `+`, `-` o `=` y los permisos:

```sh
chmod u+x skript.sh
chmod go-w fil.txt
```

## Scripts

Un **script** es un archivo de texto que contiene comandos. La primera línea,
`#!/bin/bash`, se llama *shebang* e indica al sistema qué programa debe
ejecutar el archivo:

```sh
echo '#!/bin/bash' > datum.sh
echo 'echo "Hoy es:"; date' >> datum.sh
cat datum.sh
```

Para ejecutar el script como un programa, tiene que ser ejecutable:

```sh
chmod +x datum.sh
./datum.sh
```

El `./` es necesario porque el directorio en el que estás no forma parte de
`PATH`.

## root y sudo

Algunos archivos, como `/etc/shadow`, donde se guardan las contraseñas, solo
los puede leer root. Con `sudo` (*superuser do*) ejecutas un solo comando como
root:

```sh
sudo whoami
```

La primera vez, `sudo` te pide **tu propia** contraseña. Solo los usuarios del
grupo de administradores pueden usar sudo. En {{distro}} ese grupo se llama
**{{adminGroup}}**:

:::debian
En la familia Debian el grupo se llama `sudo`.
:::

:::arch
En la familia Arch el grupo se llama `wheel`, un antiguo nombre de Unix para
«los que mandan» (en inglés, un *big wheel* es un pez gordo).
:::

:::redhat
En la familia Red Hat el grupo se llama `wheel`, un antiguo nombre de Unix para
«los que mandan» (en inglés, un *big wheel* es un pez gordo).
:::

Si necesitas ejecutar muchos comandos como root, puedes abrir una shell de
root con `sudo -i`. El prompt cambia entonces a `#`. Vuelves con `exit`.

> **¡Ten en cuenta!** Con sudo no hay red de seguridad. Ejecuta solo comandos
> que entiendas.

### Una trampa habitual

```text
sudo echo "texto" > /etc/archivo     # NO funciona
```

Es *tu* shell –no sudo– la que abre el archivo para `>`. Usa `tee` en su
lugar, que se ejecuta con sudo:

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```
