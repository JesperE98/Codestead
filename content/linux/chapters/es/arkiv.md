# Archivadores y compresión

Tarde o temprano querrás enviarle a alguien un directorio entero, hacer una
copia de seguridad o descargar el código fuente de un programa. Entonces
muchos archivos tienen que convertirse en **uno solo**, y preferiblemente más
pequeño. En Linux esto suele hacerse con dos programas distintos que
colaboran.

## Archivar y comprimir: dos cosas distintas

- **Archivar** significa reunir muchos archivos y directorios en un único
  archivo, un *archivador* (*archive*). Los permisos, los propietarios y las
  fechas también se guardan. El programa se llama `tar` (de *tape archive*: se
  escribió para unidades de cinta en los años setenta). Un archivador **no** es
  más pequeño que los archivos que contiene; si acaso, es más grande.
- **Comprimir** significa hacer un archivo más pequeño codificando las
  repeticiones de forma más inteligente. El programa más común es `gzip`. Solo
  maneja un archivo cada vez y no sabe nada de directorios.

Por eso se usan juntos: primero `tar` para obtener un único archivo, y luego
`gzip` para hacerlo más pequeño. El resultado se llama `.tar.gz`, o `.tgz`
para abreviar. Es la filosofía Unix en pocas palabras: programas pequeños que
hacen una sola cosa cada uno y se pueden combinar.

```quiz
¿Por qué `tar` y `gzip` suelen usarse juntos?
- [ ] `gzip` no puede leer archivos que no haya creado `tar`
- [x] `tar` reúne muchos archivos en uno, y `gzip` hace que ese archivo sea más pequeño
- [ ] `tar` hace los archivos más pequeños, y `gzip` les da los permisos correctos
---
gzip solo maneja un archivo cada vez y no sabe nada de directorios, y
un archivador tar por sí solo no es más pequeño que los archivos que contiene.
```

| Extensión | ¿Qué es? | Se descomprime con |
|---|---|---|
| `.tar` | Archivador sin comprimir | `tar -xf` |
| `.gz` | Un único archivo comprimido | `gunzip` |
| `.tar.gz`, `.tgz` | Archivador comprimido | `tar -xzf` |
| `.zip` | Archivador y compresión en uno (habitual en Windows) | `unzip` |

También te encontrarás con `.tar.xz`, `.tar.bz2` y `.tar.zst`. Es la misma
idea, pero con otros programas de compresión (`xz`, `bzip2` y `zstd`).

## Empaquetar con `tar`

Ve a tu directorio personal y empaqueta el directorio `dokument`:

```sh
cd ~
tar -cvf dokument.tar dokument
```

```text
dokument/
dokument/betyg.csv
dokument/frukter.txt
dokument/server.log
```

`-c` significa *crear un archivador*, `-v` le dice a tar que muestre lo que
hace y `-f` indica que a continuación viene el nombre del archivador. Todo lo
que va después del nombre del archivador se empaqueta: tantos archivos y
directorios como quieras.

> **¡Ojo!** El orden es *primero el archivador y luego los archivos*. Si te
> equivocas de orden, como en `tar -cvf dokument dokument.tar`, tar intenta
> sobrescribir el directorio o, peor aún, un archivo que querías conservar.

## Las opciones que hay que recordar

| Opción | Viene de | Significa |
|---|---|---|
| `c` | **c**reate | Crear un archivador nuevo |
| `x` | e**x**tract | Extraer |
| `t` | lis**t** (*table of contents*) | Listar el contenido |
| `v` | **v**erbose | Mostrar los archivos que se procesan |
| `f` | **f**ile | A continuación viene el nombre del archivador |
| `z` | g**z**ip | Comprimir o descomprimir con gzip |

Tiene que haber exactamente **una** de `c`, `x` y `t`: le dice a tar *qué*
hacer. Las demás son modificadores. Una regla mnemotécnica habitual (en
inglés):

- **c**reate **z**ipped **v**erbose **f**ile → `tar -czvf`
- e**x**tract **z**ipped **v**erbose **f**ile → `tar -xzvf`
- lis**t** **z**ipped **v**erbose **f**ile → `tar -tzvf`

Pon siempre la `f` **al final** cuando escribas las opciones juntas, ya que el
nombre del archivo tiene que ir justo después. Por razones históricas también
puedes omitir el guion: `tar czvf` significa lo mismo que `tar -czvf`.

```quiz
¿Qué hace `tar -xzvf backup.tar.gz`?
- [ ] Crea el archivador comprimido `backup.tar.gz`
- [ ] Lista el contenido de `backup.tar.gz` sin extraerlo
- [x] Extrae `backup.tar.gz` con gzip y muestra cada archivo
---
`x` es la operación (extraer), `z` significa gzip, `v` muestra los archivos y
después de `f` va el nombre del archivador.
```

## Comprimir con `-z`

Añade `z` y el archivador pasa por gzip por el camino:

```sh
tar -czvf dokument.tar.gz dokument
ls -l dokument.tar dokument.tar.gz
```

```text
-rw-r--r-- 1 elev elev 10240 Oct 30 12:00 dokument.tar
-rw-r--r-- 1 elev elev   837 Oct 30 12:00 dokument.tar.gz
```

El archivador sin comprimir ocupa nada menos que 10 240 bytes, aunque los
archivos suman algo más de 1000 bytes. Esto se debe a que tar pone una
cabecera de 512 bytes delante de cada archivo y rellena el archivador hasta
completar bloques enteros. Todo ese espacio vacío desaparece al comprimir con
gzip.

El comando `du` (*disk usage*) muestra cuánto espacio ocupa algo en el disco.
Con `-h` obtienes tamaños fáciles de leer, y con `-s` un total para un
directorio entero:

```sh
du -h dokument.tar dokument.tar.gz
du -sh dokument
```

```text
12K	dokument.tar
4.0K	dokument.tar.gz
16K	dokument
```

El disco se divide en bloques de 4 KiB, así que `du` nunca muestra menos de
`4.0K` para un archivo que no esté vacío. Para ver el tamaño exacto, usa
`ls -l` (o `ls -lh`).

## Mira dentro de un archivador antes de extraerlo

```sh
tar -tzvf dokument.tar.gz
```

```text
drwxr-xr-x elev/elev         0 2026-10-30 12:00 dokument/
-rw-r--r-- elev/elev       146 2026-10-30 12:00 dokument/betyg.csv
-rw-r--r-- elev/elev        64 2026-10-30 12:00 dokument/frukter.txt
-rw-r--r-- elev/elev       848 2026-10-30 12:00 dokument/server.log
```

Con `v`, el contenido se muestra como en `ls -l`, con permisos, propietario y
tamaño. Mirar primero es una buena costumbre: algunos archivadores no tienen un
directorio principal común y desparramarán cientos de archivos allí donde
estés cuando los extraigas.

## Extraer

```sh
mkdir uppackat
tar -xzvf dokument.tar.gz -C uppackat
```

`-C` (C mayúscula) elige el directorio en el que tar extrae los archivos
(*uppackat* significa «desempaquetado»). Sin esta opción, todo acaba en el directorio
en el que estás. Las versiones modernas de tar detectan por sí solas si un
archivador está comprimido al extraerlo, así que `tar -xf dokument.tar.gz`
también funciona.

> **¡Cuidado!** tar no pregunta antes de sobrescribir archivos que ya existen.
> Si no estás seguro, lista primero el contenido.

### Rutas absolutas

Si empaquetas una ruta absoluta, se quita la `/` inicial para que el
archivador se pueda extraer en cualquier sitio:

```sh
tar -czf backup.tar.gz ~/dokument
```

```text
tar: Removing leading `/' from member names
```

Ahora el archivador contiene `home/elev/dokument/...`. Si solo quieres
`dokument/` en el archivador, puedes hacer que tar cambie antes de directorio
con `-C`:

```sh
tar -czf backup.tar.gz -C ~ dokument
tar -tzf backup.tar.gz
```

```quiz
Ejecutas `tar -czf backup.tar.gz -C ~ dokument`. ¿Qué contiene el archivador?
- [x] `dokument/` y los archivos que contiene
- [ ] `home/elev/dokument/` y los archivos que contiene
- [ ] `/home/elev/dokument/` y los archivos que contiene
---
`-C ~` hace que tar cambie primero a tu directorio personal, así que los nombres
del archivador empiezan en `dokument/`.
```

## Comprimir archivos sueltos con `gzip`

`gzip` comprime un archivo y lo **sustituye** por un archivo `.gz`. Los
permisos y la fecha se conservan:

```sh
cp dokument/server.log .
gzip -v server.log
```

```text
server.log:	 39.0% -- replaced with server.log.gz
```

`gzip -l` muestra el tamaño antes y después, y `gunzip` vuelve a descomprimir
el archivo:

```sh
gzip -l server.log.gz
gunzip server.log.gz
```

Si quieres conservar el original, usa `gzip -k` (*keep*). Pruébalo con un
archivo muy pequeño: en realidad se hace **más grande**, porque gzip añade una
cabecera que contiene, entre otras cosas, el nombre del archivo:

```sh
cp dokument/frukter.txt .
gzip -kv frukter.txt
```

```text
frukter.txt:	-20.3% -- created frukter.txt.gz
```

```predict
$ cp dokument/frukter.txt .
$ cp dokument/server.log .
$ gzip frukter.txt
$ gzip -k server.log
$ ls frukter* server*
frukter.txt.gz  server.log  server.log.gz
---
`gzip` a secas sustituye el archivo por un archivo `.gz`; `-k` conserva el original.
```

### Leer archivos comprimidos directamente

Los archivos de registro antiguos de `/var/log` suelen guardarse como `.gz`
para ahorrar espacio. Con `zcat` puedes leerlos sin descomprimirlos, y el
resultado se puede enviar por una pipe como siempre:

```sh
gzip server.log
zcat server.log.gz | grep ERROR
```

`zcat` es lo mismo que `gzip -dc`: descomprime (`d`) a la salida estándar
(`c`). En un sistema real también existen `zless` y `zgrep`.

## zip: para compartir con Windows

El formato `.zip` hace las dos cosas a la vez: reúne archivos *y* los
comprime. Windows y macOS pueden abrir archivos zip sin ningún software
adicional, así que es la opción obvia cuando envías archivos a alguien que no
usa Linux. Dentro del mundo Linux es más común `.tar.gz`, porque conserva
mejor los propietarios y los permisos.

Los programas `zip` y `unzip` no siempre vienen preinstalados, y en esta
terminal tienes que instalarlos primero. Eso se hace con el gestor de paquetes:
lo aprenderás todo sobre él en la parte sobre distribuciones y paquetes. En
Ubuntu se hace así:

```sh
sudo apt update
sudo apt install zip unzip
```

`apt update` descarga la lista de paquetes disponibles. Sin este paso, apt no
encuentra ningún paquete.

Después empaqueta el directorio. No olvides `-r` (*recursive*): sin esta opción, zip
solo añade el directorio vacío, no los archivos que contiene:

```sh
zip -r dokument.zip dokument
```

```text
  adding: dokument/ (stored 0%)
  adding: dokument/betyg.csv (deflated 17%)
  adding: dokument/frukter.txt (deflated 27%)
  adding: dokument/server.log (deflated 42%)
```

Fíjate en que el orden es el mismo que con tar: primero el archivador y luego
los archivos. `unzip -l` lista el contenido, y `-d` elige dónde extraer (el
directorio se crea si no existe):

```sh
unzip -l dokument.zip
unzip dokument.zip -d fran-zip
```

Si los archivos ya existen, unzip se los salta. Con `unzip -o` se
sobrescriben.

```quiz
Ejecutas `zip dokument.zip dokument` sin `-r`. ¿Qué acaba en el archivo zip?
- [ ] Todos los archivos de `dokument`
- [x] Solo el directorio vacío `dokument/`
- [ ] Nada: zip se niega a ejecutarse
---
Sin `-r` (*recursive*), zip no entra en el directorio.
```

## Resumen

| Si quieres ... | Comando |
|---|---|
| empaquetar y comprimir un directorio | `tar -czvf archivador.tar.gz directorio` |
| ver qué contiene un archivador | `tar -tzvf archivador.tar.gz` |
| extraer un archivador | `tar -xzvf archivador.tar.gz` (añade `-C directorio`) |
| comprimir un archivo | `gzip archivo` (o `gzip -k archivo`) |
| descomprimir un archivo `.gz` | `gunzip archivo.gz` |
| leer directamente un archivo `.gz` | `zcat archivo.gz` |
| crear o extraer un archivo zip | `zip -r archivador.zip directorio` · `unzip archivador.zip` |
| ver cuánto ocupa algo | `du -sh directorio` · `ls -lh` |
