# Usuarios, permisos y sudo

Linux está pensado para que varios usuarios puedan compartir el mismo
ordenador. Por eso cada archivo tiene un propietario y unas reglas sobre quién
puede hacer qué.

## Usuarios y grupos

Has iniciado sesión como el usuario `{{user}}`. Cada usuario pertenece a uno o
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
-rw-r--r-- 1 {{user}} {{user}}  205 Oct 29 13:55 {{notes}}
drwxr-xr-x 2 {{user}} {{user}} 4096 Oct 29 13:55 {{documents}}
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

A continuación vienen el propietario (`{{user}}`) y el grupo (`{{user}}`).

```quiz
Un directorio tiene los permisos `drwxr-x---`. ¿Qué pueden hacer los miembros de su grupo?
- [ ] Nada en absoluto
- [x] Listar el contenido y entrar con `cd`, pero no crear ni eliminar archivos dentro
- [ ] Todo lo que puede hacer el propietario
---
El grupo tiene `r-x`: `r` permite listar el contenido y `x` permite
entrar en el directorio. Sin `w` no puedes crear ni eliminar archivos dentro.
```

## Cambiar los permisos – `chmod`

Los permisos se pueden indicar con **números**. Cada grupo recibe una cifra
que es la suma de r = 4, w = 2 y x = 1:

| Número | Permisos | Típico para |
|---|---|---|
| `755` | `rwxr-xr-x` | Programas y directorios |
| `644` | `rw-r--r--` | Archivos normales |
| `600` | `rw-------` | Archivos secretos |

```sh
chmod 644 {{notes}}
```

O con **símbolos**: `u` (el propietario), `g` (el grupo), `o` (los otros), `a`
(todos), seguidos de `+`, `-` o `=` y los permisos:

```sh
chmod u+x script.sh
chmod go-w archivo.txt
```

```predict
$ touch plan.txt
$ chmod 600 plan.txt
$ chmod g+r plan.txt
$ ls -l plan.txt | cut -d' ' -f1
-rw-r-----
```

## Scripts

Un **script** es un archivo de texto que contiene comandos. La primera línea,
`#!/bin/bash`, se llama *shebang* e indica al sistema qué programa debe
ejecutar el archivo:

```sh
echo '#!/bin/bash' > fecha.sh
echo 'echo "Hoy es:"; date' >> fecha.sh
cat fecha.sh
```

Para ejecutar el script como un programa, tiene que ser ejecutable:

```sh
chmod +x fecha.sh
./fecha.sh
```

El `./` es necesario porque el directorio en el que estás no forma parte de
`PATH`.

```quiz
Has escrito el script `test.sh` y ejecutas `./test.sh`, pero obtienes
`Permission denied`. ¿Qué falta?
- [ ] Un `sudo` delante
- [x] El permiso de ejecución: ejecuta primero `chmod +x test.sh`
- [ ] El `./` sobra: debería ser `test.sh`
---
Para ejecutar un archivo como programa, necesita el permiso `x`. El `./` es correcto:
sin él, la shell solo busca en los directorios de `PATH`.
```

## root y sudo

Algunos archivos, como `/etc/shadow`, donde se guardan las contraseñas, solo
los puede leer root. Con `sudo` (*superuser do*) ejecutas un solo comando como
root:

```sh
sudo whoami
```

La primera vez, `sudo` te pide **tu propia** contraseña. Solo los usuarios del
grupo de administradores pueden usar sudo. En Ubuntu ese grupo se llama **sudo**:
puedes verlo entre tus grupos cuando ejecutas `id`. Algunas otras distribuciones
llaman al grupo `wheel`; leerás más sobre las diferencias entre
distribuciones en la parte sobre distribuciones.

Si necesitas ejecutar muchos comandos como root, puedes abrir una shell de
root con `sudo -i`. El prompt cambia entonces a `#`. Vuelves con `exit`.

> **¡Ten en cuenta!** Con sudo no hay red de seguridad. Ejecuta solo comandos
> que entiendas.

```quiz
`sudo` te pide una contraseña. ¿Qué contraseña debes escribir?
- [ ] La contraseña de root
- [x] Tu propia contraseña
- [ ] Ninguna: basta con pulsar Enter
---
`sudo` te pide **tu propia** contraseña, y solo te deja pasar si estás
en el grupo de administradores.
```

### Una trampa habitual

```text
sudo echo "texto" > /etc/archivo     # NO funciona
```

Es *tu* shell –no sudo– la que abre el archivo para `>`. Usa `tee` en su
lugar, que se ejecuta con sudo:

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```

```quiz
¿Por qué no funciona `sudo echo "text" > /etc/file`?
- [ ] `echo` no se puede ejecutar con sudo
- [x] Es tu propia shell la que abre el archivo para `>`, y no se ejecuta como root
- [ ] Los archivos de `/etc` no se pueden modificar nunca
---
sudo solo se aplica al comando (`echo`). La redirección la gestiona tu
shell, que se ejecuta como tú. `tee` es el programa que escribe el archivo, así que es
`tee` el que necesita sudo.
```
