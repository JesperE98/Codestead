# Enlaces e información de archivos

En Linux, el nombre de un archivo y su contenido son dos cosas distintas. En
este capítulo lo aprovechas para crear accesos directos con **enlaces**,
aprendes a examinar archivos con `stat` y `file`, y decides con `umask` qué
permisos reciben los archivos nuevos.

## Nombres e inodos

El contenido de un archivo – junto con su propietario, sus permisos y sus
fechas – se guarda en un **inodo**. Un directorio no es más que una lista de
nombres, y cada nombre apunta a un inodo. `ls -i` muestra el número de inodo
delante de cada nombre:

```sh
ls -i
```

## Enlaces simbólicos – `ln -s`

Un **enlace simbólico** (*symlink*) es un archivo pequeño que contiene la ruta
a otra cosa: un acceso directo. El destino va primero y el nombre del enlace
al final, igual que con `cp`:

```sh
ln -s /var/log ~/log
ls -l ~/log
```

```text
lrwxrwxrwx 1 {{user}} {{user}} 8 Nov  3 10:15 /home/{{user}}/log -> /var/log
```

La `l` al principio de la línea y la flecha `->` muestran que es un enlace.
Sus permisos son siempre `rwxrwxrwx`: no importan, lo que cuenta son los
permisos del destino.

Casi todos los comandos siguen el enlace: `ls ~/log/`, `cat`, `cd`, etc. `cd`
recuerda el camino por el que llegaste, y `pwd -P` muestra dónde estás de
verdad:

```sh
cd ~/log
pwd
pwd -P
```

### Enlaces relativos

Una ruta relativa en un enlace se cuenta desde el directorio **donde está el
enlace**, no desde donde estás tú cuando lo creas:

```sh
cd ~
ln -s {{documents}}/{{fruits}} {{fruits}}
cat {{fruits}}
```

Funciona, porque el enlace está en tu directorio personal y
`{{documents}}/{{fruits}}` está ahí. Un enlace `/tmp/f` con el mismo contenido
buscaría `/tmp/{{documents}}/{{fruits}}`, y estaría roto.

`readlink` muestra lo que hay en un enlace, y `realpath` muestra la ruta
completa con todos los enlaces resueltos:

```sh
readlink {{fruits}}
realpath {{fruits}}
```

### Enlaces rotos

Un enlace puede apuntar a algo que no existe:

```predict
$ ln -s nowhere.txt broken
$ cat broken
cat: broken: No such file or directory
---
El enlace existe, pero no el archivo al que apunta. `ls -l` muestra un enlace
roto en rojo, y `find ~ -type l` encuentra todos los enlaces de tu directorio
personal.
```

`rm` elimina el propio enlace, nunca aquello a lo que apunta.

```quiz
Tienes el enlace `~/log -> /var/log` y ejecutas `rm ~/log`. ¿Qué ocurre?
- [ ] Se eliminan `/var/log` y todo lo que contiene
- [x] Solo se elimina el enlace; `/var/log` queda intacto
- [ ] `rm` se niega, porque `~/log` es un directorio
---
`rm` actúa sobre el propio enlace. Para eliminar el destino tendrías que
nombrar el destino.
```

### Dónde te encuentras enlaces

Los enlaces están por todas partes en un sistema Linux. `python3` suele ser un
enlace a una versión concreta, como `python3.12`, y cuando más adelante hagas
que un servicio arranque al encender con `systemctl enable`, systemd creará un
enlace a su archivo de unidad. Mira los servicios que arrancan al encender:

```try
ls -l /etc/systemd/system/multi-user.target.wants
```

## Enlaces duros – `ln`

Sin `-s`, `ln` crea un **enlace duro**: un nombre más para el mismo inodo.

```sh
ln {{notes}} {{todo}}
ls -li {{notes}} {{todo}}
```

```text
1310722 -rw-r--r-- 2 {{user}} {{user}} 205 Nov  3 10:20 {{notes}}
1310722 -rw-r--r-- 2 {{user}} {{user}} 205 Nov  3 10:20 {{todo}}
```

Los dos nombres tienen el mismo número de inodo, y el número que sigue a los
permisos – el **contador de enlaces** – ahora es 2. Es el mismo archivo: un
cambio hecho a través de un nombre se ve a través del otro. Si eliminas uno de
los nombres, el contenido sigue vivo mientras al archivo le quede al menos un
nombre.

```predict
$ echo hello > a.txt
$ ln a.txt b.txt
$ echo again >> b.txt
$ rm b.txt
$ cat a.txt
hello
again
---
`a.txt` y `b.txt` eran el mismo archivo. La línea escrita a través de `b.txt`
sigue ahí después de eliminar `b.txt`.
```

| | Enlace simbólico (`ln -s`) | Enlace duro (`ln`) |
|---|---|---|
| Es | Un archivo pequeño con una ruta | Un nombre más para el mismo inodo |
| A un directorio | Sí | No |
| A otro sistema de archivos | Sí | No: los inodos pertenecen a un solo sistema de archivos |
| Si se elimina el original | El enlace se rompe | El archivo sigue vivo |
| En `ls -l` | `l` y `->` | El contador de enlaces sube |

```quiz
¿Qué tipo de enlace puede apuntar a un directorio?
- [x] Solo un enlace simbólico
- [ ] Solo un enlace duro
- [ ] Los dos
---
Los enlaces duros a directorios no están permitidos. Para un acceso directo a
un directorio se usa `ln -s`.
```

## Todo sobre un archivo – `stat`

`stat` muestra todo lo que sabe el inodo:

```sh
stat /etc/hostname
```

```text
  File: /etc/hostname
  Size: 7         	Blocks: 8          IO Block: 4096   regular file
Device: 8,3	Inode: 1310755     Links: 1
Access: (0644/-rw-r--r--)  Uid: (    0/    root)   Gid: (    0/    root)
Access: 2026-11-03 10:15:22.000000000 +0100
Modify: 2026-11-03 10:15:22.000000000 +0100
Change: 2026-11-03 10:15:22.000000000 +0100
 Birth: 2026-11-03 10:15:22.000000000 +0100
```

Obtienes el tamaño, el número de inodo, el número de enlaces, los permisos
tanto en cifras (`0644`) como en letras, el propietario y el grupo, y cuándo
se leyó el archivo, cuándo se modificó su contenido y cuándo cambiaron sus
propiedades. Con `-c` eliges exactamente qué mostrar: `%a` son los permisos en
cifras, `%U` el propietario y `%n` el nombre.

```predict
$ stat -c '%a %U' /etc/shadow
640 root
```

## ¿Qué hay dentro? – `file`

A Linux no le importan las extensiones de los nombres de archivo: un archivo
llamado `.jpg` puede contener cualquier cosa. `file` mira el contenido en su
lugar:

```sh
file /usr/bin/ls {{documents}}/{{grades}} /etc
```

```predict
$ echo hello > {{vacationPic}}
$ file {{vacationPic}}
{{vacationPic}}: ASCII text
---
El nombre termina en `.jpg`, pero el contenido es texto, y eso es lo que tiene
en cuenta `file`.
```

## Permisos para archivos nuevos – `umask`

Los archivos nuevos reciben los permisos `rw-rw-rw-` (666) y los directorios
nuevos `rwxrwxrwx` (777), menos los bits de la **umask**. `umask` la muestra:

```sh
umask
```

La umask habitual, `0022`, quita el permiso de escritura al grupo y a los
demás; por eso tus archivos reciben `644` y tus directorios `755`.

| umask | Archivos nuevos | Directorios nuevos | Significa |
|---|---|---|---|
| `022` | `644` `rw-r--r--` | `755` `rwxr-xr-x` | Lo habitual |
| `027` | `640` `rw-r-----` | `750` `rwxr-x---` | El grupo puede leer, los demás nada |
| `077` | `600` `rw-------` | `700` `rwx------` | Solo tú |

```predict
$ umask 027
$ touch plan.txt
$ stat -c %a plan.txt
640
---
666 menos 027: el grupo pierde la `w` y los demás lo pierden todo.
```

`umask` solo afecta a los archivos que se crean después, y solo en la shell en
la que la ejecutaste. Para conservar una umask, pon la línea en `~/.bashrc`.

```quiz
Tu umask es `077`. ¿Qué permisos recibe un directorio nuevo?
- [ ] `755`
- [ ] `600`
- [x] `700`
---
Los directorios parten de 777. 777 menos 077 deja 700: todo para ti, nada para
nadie más.
```
